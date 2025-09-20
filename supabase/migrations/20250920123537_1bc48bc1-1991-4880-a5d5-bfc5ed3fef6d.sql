-- Fix remaining security vulnerabilities - Function search paths

-- Update remaining functions with proper immutable search_path
CREATE OR REPLACE FUNCTION public.update_tracking_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_freight_on_proposal_accept()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    UPDATE public.freights 
    SET 
      driver_id = NEW.driver_id,
      status = 'ACCEPTED'::freight_status,
      updated_at = now()
    WHERE id = NEW.freight_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_secure_request_details(request_id uuid)
 RETURNS TABLE(contact_phone text, origin_address text, destination_address text, origin_lat numeric, origin_lng numeric, destination_lat numeric, destination_lng numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  is_authorized boolean := false;
BEGIN
  -- Verifica autorização
  SELECT EXISTS(
    SELECT 1 FROM public.urban_service_requests r
    LEFT JOIN public.urban_service_providers usp ON r.provider_id = usp.id
    LEFT JOIN public.profiles p ON usp.profile_id = p.id
    WHERE r.id = request_id 
    AND (
      -- É o cliente
      r.client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR 
      -- É o provedor atribuído
      p.user_id = auth.uid()
      OR
      -- É admin
      public.is_admin()
    )
  ) INTO is_authorized;
  
  IF is_authorized THEN
    RETURN QUERY
    SELECT 
      public.decrypt_sensitive_data(r.contact_phone_encrypted) as contact_phone,
      public.decrypt_sensitive_data(r.origin_address_encrypted) as origin_address,
      public.decrypt_sensitive_data(r.destination_address_encrypted) as destination_address,
      r.origin_lat,
      r.origin_lng,
      r.destination_lat,
      r.destination_lng
    FROM public.urban_service_requests r
    WHERE r.id = request_id;
  ELSE
    -- Dados mascarados para usuários não autorizados
    RETURN QUERY
    SELECT 
      '***-****-****'::text as contact_phone,
      'Acesso restrito'::text as origin_address,
      'Acesso restrito'::text as destination_address,
      NULL::numeric as origin_lat,
      NULL::numeric as origin_lng, 
      NULL::numeric as destination_lat,
      NULL::numeric as destination_lng;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_accepted_trucks_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Atualizar contador quando proposta é aceita
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    UPDATE public.freights 
    SET accepted_trucks = accepted_trucks + 1
    WHERE id = NEW.freight_id;
    
    -- Verificar se atingiu o limite e marcar frete como completo
    UPDATE public.freights 
    SET status = 'IN_NEGOTIATION'
    WHERE id = NEW.freight_id 
    AND accepted_trucks >= required_trucks 
    AND status = 'OPEN';
    
  -- Decrementar contador quando proposta aceita é rejeitada
  ELSIF OLD.status = 'ACCEPTED' AND NEW.status != 'ACCEPTED' THEN
    UPDATE public.freights 
    SET accepted_trucks = GREATEST(0, accepted_trucks - 1)
    WHERE id = NEW.freight_id;
    
    -- Reabrir frete se estava completo e agora tem vaga
    UPDATE public.freights 
    SET status = 'OPEN'
    WHERE id = NEW.freight_id 
    AND accepted_trucks < required_trucks 
    AND status = 'IN_NEGOTIATION';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_checkin_as_counterpart(p_checkin_id uuid, p_observations text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  checkin_record RECORD;
  current_user_profile_id UUID;
BEGIN
  -- Buscar perfil do usuário atual
  SELECT id INTO current_user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF current_user_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar o checkin e verificar se o usuário pode confirmar
  SELECT fc.*, f.producer_id, f.driver_id
  INTO checkin_record
  FROM public.freight_checkins fc
  JOIN public.freights f ON fc.freight_id = f.id
  WHERE fc.id = p_checkin_id
    AND fc.requires_counterpart_confirmation = true
    AND fc.counterpart_confirmed_by IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se o usuário é a counterpart válida
  -- Se o checkin foi feito pelo motorista, o produtor pode confirmar e vice-versa
  IF NOT (
    (checkin_record.user_id = checkin_record.driver_id AND current_user_profile_id = checkin_record.producer_id)
    OR
    (checkin_record.user_id = checkin_record.producer_id AND current_user_profile_id = checkin_record.driver_id)
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Confirmar o checkin
  UPDATE public.freight_checkins
  SET 
    counterpart_confirmed_by = current_user_profile_id,
    counterpart_confirmed_at = now(),
    status = 'CONFIRMED',
    observations = CASE 
      WHEN p_observations IS NOT NULL THEN 
        COALESCE(observations, '') || CASE WHEN observations IS NOT NULL THEN E'\n---\nConfirmação: ' ELSE 'Confirmação: ' END || p_observations
      ELSE observations
    END,
    updated_at = now()
  WHERE id = p_checkin_id;
  
  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT 'agri_key_2024'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  -- Usar AES para criptografia real (reversível)
  RETURN encode(pgp_sym_encrypt(data, key), 'base64');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text DEFAULT 'agri_key_2024'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  -- Descriptografar usando AES
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), key);
EXCEPTION WHEN OTHERS THEN
  RETURN 'Dados criptografados';
END;
$function$;