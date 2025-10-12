-- Limpar dados órfãos antes de adicionar FKs
DELETE FROM service_requests 
WHERE client_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = service_requests.client_id
  );

DELETE FROM service_requests 
WHERE provider_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = service_requests.provider_id
  );

-- Adicionar foreign keys
ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS fk_service_requests_client;

ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS fk_service_requests_provider;

ALTER TABLE service_requests
  ADD CONSTRAINT fk_service_requests_client
  FOREIGN KEY (client_id) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

ALTER TABLE service_requests
  ADD CONSTRAINT fk_service_requests_provider
  FOREIGN KEY (provider_id) 
  REFERENCES profiles(id) 
  ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_service_requests_client_id 
  ON service_requests(client_id);

CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id 
  ON service_requests(provider_id);

CREATE INDEX IF NOT EXISTS idx_service_requests_status_type 
  ON service_requests(status, service_type) 
  WHERE provider_id IS NULL;

-- Drop e recriar a função RPC com client_id
DROP FUNCTION IF EXISTS public.get_compatible_service_requests_for_provider(uuid);

CREATE FUNCTION public.get_compatible_service_requests_for_provider(p_provider_id uuid)
RETURNS TABLE(
  request_id uuid, 
  client_id uuid,
  service_type text, 
  location_address text,
  city_name text,
  state text,
  problem_description text,
  urgency text,
  contact_phone text,
  contact_name text,
  status text,
  created_at timestamp with time zone,
  location_lat numeric,
  location_lng numeric,
  vehicle_info text,
  additional_info text,
  is_emergency boolean,
  estimated_price numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  provider_service_types text[];
BEGIN
  SELECT service_types INTO provider_service_types
  FROM public.profiles 
  WHERE id = p_provider_id AND role = 'PRESTADOR_SERVICOS';
  
  IF provider_service_types IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    sr.id AS request_id,
    sr.client_id,
    sr.service_type,
    sr.location_address,
    sr.city_name,
    sr.state,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.status,
    sr.created_at,
    sr.location_lat,
    sr.location_lng,
    sr.vehicle_info,
    sr.additional_info,
    sr.is_emergency,
    sr.estimated_price
  FROM public.service_requests sr
  WHERE 
    sr.status = 'OPEN'
    AND sr.provider_id IS NULL
    AND (
      array_length(provider_service_types, 1) IS NULL
      OR sr.service_type = ANY(provider_service_types)
    )
    AND (
      EXISTS (
        SELECT 1 
        FROM public.service_provider_areas spa
        WHERE spa.provider_id = p_provider_id
          AND spa.is_active = true
          AND (
            (
              sr.city_name IS NOT NULL 
              AND sr.state IS NOT NULL
              AND LOWER(TRIM(spa.city_name)) = LOWER(TRIM(sr.city_name))
              AND LOWER(TRIM(spa.state)) = LOWER(TRIM(sr.state))
            )
            OR
            (
              sr.location_lat IS NOT NULL
              AND sr.location_lng IS NOT NULL
              AND spa.geom IS NOT NULL
              AND extensions.ST_DWithin(
                spa.geom::extensions.geography,
                extensions.ST_SetSRID(
                  extensions.ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision),
                  4326
                )::extensions.geography,
                COALESCE(spa.radius_m, spa.radius_km * 1000)::double precision
              )
            )
          )
      )
    )
  ORDER BY 
    sr.is_emergency DESC,
    sr.created_at DESC;
END;
$function$;