-- Fix remaining functions with search_path issues

CREATE OR REPLACE FUNCTION public.get_public_service_requests()
 RETURNS TABLE(id uuid, service_type text, origin_lat_approx numeric, origin_lng_approx numeric, destination_lat_approx numeric, destination_lng_approx numeric, distance_km numeric, pickup_date date, estimated_weight numeric, estimated_volume numeric, price numeric, status text, created_at timestamp with time zone, origin_city text, destination_city text)
 LANGUAGE plpgsql
 STABLE
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.service_type,
    -- Coordenadas aproximadas (reduzir precisão)
    ROUND(r.origin_lat::numeric, 2) as origin_lat_approx,
    ROUND(r.origin_lng::numeric, 2) as origin_lng_approx,
    ROUND(r.destination_lat::numeric, 2) as destination_lat_approx,
    ROUND(r.destination_lng::numeric, 2) as destination_lng_approx,
    r.distance_km,
    r.pickup_date,
    r.estimated_weight,
    r.estimated_volume,
    r.price,
    r.status,
    r.created_at,
    -- Endereços mascarados (apenas cidade/bairro)
    CASE 
      WHEN r.origin_address IS NOT NULL 
      THEN split_part(r.origin_address, ',', -2) || ', ' || split_part(r.origin_address, ',', -1)
      ELSE 'Local não informado'
    END as origin_city,
    CASE 
      WHEN r.destination_address IS NOT NULL 
      THEN split_part(r.destination_address, ',', -2) || ', ' || split_part(r.destination_address, ',', -1)
      ELSE 'Local não informado'
    END as destination_city
  FROM public.urban_service_requests r
  WHERE r.status = 'PENDING';
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(request_id uuid, access_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.sensitive_data_access_log (
    user_id, 
    request_id, 
    access_type,
    accessed_at
  ) VALUES (
    auth.uid(),
    request_id,
    access_type,
    now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mask_sensitive_request_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  -- Se não é o cliente nem o provedor atribuído, mascarar dados
  IF NOT (
    NEW.client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR NEW.provider_id IN (
      SELECT usp.id FROM public.urban_service_providers usp
      JOIN public.profiles p ON usp.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR public.is_admin()
  ) THEN
    NEW.contact_phone := '***-****-****';
    NEW.origin_address := split_part(NEW.origin_address, ',', -1);
    NEW.destination_address := split_part(NEW.destination_address, ',', -1);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
 RETURNS TABLE(freight_id uuid, cargo_type text, weight numeric, origin_address text, destination_address text, pickup_date date, delivery_date date, price numeric, urgency text, status text, service_type text, distance_km numeric, minimum_antt_price numeric, required_trucks integer, accepted_trucks integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  driver_services text[];
  driver_cities text[];
BEGIN
  -- Buscar os tipos de serviço e cidades do motorista
  SELECT service_types, service_cities INTO driver_services, driver_cities
  FROM public.profiles 
  WHERE id = p_driver_id AND role = 'MOTORISTA';
  
  -- Se não encontrou o motorista, retorna vazio
  IF driver_services IS NULL THEN
    RETURN;
  END IF;
  
  -- Retorna fretes compatíveis que ainda têm vagas e estão na região
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at
  FROM public.freights f
  WHERE 
    f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks  -- Ainda tem vagas
    AND public.is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
    AND (
      driver_cities IS NULL 
      OR array_length(driver_cities, 1) IS NULL 
      OR EXISTS (
        SELECT 1 FROM unnest(driver_cities) AS city 
        WHERE f.origin_address ILIKE '%' || city || '%' 
           OR f.destination_address ILIKE '%' || city || '%'
      )
    )
  ORDER BY f.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_secure_service_request_details(request_id uuid)
 RETURNS TABLE(contact_phone text, location_address text, location_lat numeric, location_lng numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  is_authorized boolean := false;
BEGIN
  -- Verifica autorização
  SELECT EXISTS(
    SELECT 1 FROM public.service_requests r
    LEFT JOIN public.service_providers sp ON r.provider_id = sp.profile_id
    WHERE r.id = request_id 
    AND (
      -- É o cliente
      r.client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR 
      -- É o provedor atribuído
      sp.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR
      -- É admin
      public.is_admin()
    )
  ) INTO is_authorized;
  
  IF is_authorized THEN
    RETURN QUERY
    SELECT 
      COALESCE(public.decrypt_sensitive_data(r.contact_phone_encrypted), r.contact_phone) as contact_phone,
      COALESCE(public.decrypt_sensitive_data(r.location_address_encrypted), r.location_address) as location_address,
      r.location_lat,
      r.location_lng
    FROM public.service_requests r
    WHERE r.id = request_id;
  ELSE
    -- Dados mascarados para usuários não autorizados
    RETURN QUERY
    SELECT 
      '***-****-****'::text as contact_phone,
      'Acesso restrito'::text as location_address,
      NULL::numeric as location_lat,
      NULL::numeric as location_lng;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_advance_payment_requirement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  freight_record RECORD;
BEGIN
  -- Se um adiantamento foi aprovado/pago
  IF NEW.status IN ('APPROVED', 'PAID') AND OLD.status = 'PENDING' THEN
    -- Buscar o frete relacionado
    SELECT * INTO freight_record FROM public.freights WHERE id = NEW.freight_id;
    
    -- Se o frete estava requerendo pagamento de adiantamento, remover a obrigatoriedade
    IF freight_record.metadata->>'advance_payment_required' = 'true' THEN
      -- Remover flag de obrigatoriedade
      UPDATE public.freights 
      SET metadata = freight_record.metadata - 'advance_payment_required'
      WHERE id = NEW.freight_id;
      
      -- Marcar notificações relacionadas como lidas
      UPDATE public.notifications 
      SET read = true 
      WHERE user_id = freight_record.producer_id 
        AND type = 'advance_payment_required'
        AND data->>'freight_id' = NEW.freight_id::text;
        
      -- Criar notificação de confirmação
      INSERT INTO public.notifications (
        user_id, 
        title, 
        message, 
        type,
        data
      ) VALUES (
        freight_record.producer_id,
        'Adiantamento Aprovado',
        'Obrigação de pagamento de adiantamento cumprida. Você pode prosseguir com o frete.',
        'advance_payment_completed',
        jsonb_build_object('freight_id', NEW.freight_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_advance_payment_requirement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  pending_advances_count INTEGER;
  approved_advances_count INTEGER;
BEGIN
  -- Se o status mudou para LOADED, verificar adiantamentos
  IF NEW.status = 'LOADED' AND OLD.status != 'LOADED' THEN
    -- Contar adiantamentos pendentes
    SELECT COUNT(*) INTO pending_advances_count
    FROM public.freight_advances 
    WHERE freight_id = NEW.id AND status = 'PENDING';
    
    -- Contar adiantamentos já aprovados/pagos  
    SELECT COUNT(*) INTO approved_advances_count
    FROM public.freight_advances 
    WHERE freight_id = NEW.id AND status IN ('APPROVED', 'PAID');
    
    -- Se há adiantamentos pendentes e nenhum foi aprovado ainda, criar notificação obrigatória
    IF pending_advances_count > 0 AND approved_advances_count = 0 THEN
      -- Inserir notificação para o produtor
      INSERT INTO public.notifications (
        user_id, 
        title, 
        message, 
        type,
        data
      ) VALUES (
        NEW.producer_id,
        'Pagamento de Adiantamento Obrigatório',
        'Sua carga foi carregada. Você deve aprovar pelo menos um adiantamento antes de prosseguir.',
        'advance_payment_required',
        jsonb_build_object(
          'freight_id', NEW.id,
          'pending_advances', pending_advances_count,
          'requires_action', true
        )
      );
      
      -- Adicionar flag no frete indicando que requer pagamento de adiantamento
      NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('advance_payment_required', true);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;