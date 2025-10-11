-- Adicionar search_path a funções sem essa configuração (segurança)

-- 1. Função mask_sensitive_request_data
DROP TRIGGER IF EXISTS mask_sensitive_request_trigger ON public.urban_service_requests;

CREATE OR REPLACE FUNCTION public.mask_sensitive_request_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 2. Função get_public_service_requests
CREATE OR REPLACE FUNCTION public.get_public_service_requests()
RETURNS TABLE(
  id uuid,
  service_type text,
  origin_lat_approx numeric,
  origin_lng_approx numeric,
  destination_lat_approx numeric,
  destination_lng_approx numeric,
  distance_km numeric,
  pickup_date date,
  estimated_weight numeric,
  estimated_volume numeric,
  price numeric,
  status text,
  created_at timestamp with time zone,
  origin_city text,
  destination_city text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

-- 3. Função log_sensitive_data_access (segunda versão)
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