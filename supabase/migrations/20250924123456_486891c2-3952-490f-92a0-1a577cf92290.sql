-- Corrigir problemas na função RPC e inserir dados na tabela service_providers

-- 1. Verificar se já existe o prestador e inserir se não existir
INSERT INTO service_providers (
  profile_id,
  service_type,
  service_radius_km,
  base_price,
  hourly_rate,
  created_at,
  updated_at
) 
SELECT 
  '95bad341-4546-4d32-b711-95d45f54c5b6',
  'BORRACHEIRO',
  30,
  50.00,
  80.00,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM service_providers WHERE profile_id = '95bad341-4546-4d32-b711-95d45f54c5b6'
);

-- 2. Corrigir a função RPC para usar status 'OPEN' e remover JOIN desnecessário
CREATE OR REPLACE FUNCTION get_service_requests_in_radius(provider_profile_id uuid)
RETURNS TABLE (
  id uuid,
  client_id uuid,
  service_type text,
  location_address text,
  location_city text,
  location_state text,
  location_lat numeric,
  location_lng numeric,
  problem_description text,
  urgency text,
  contact_phone text,
  contact_name text,
  is_emergency boolean,
  estimated_price numeric,
  status text,
  service_radius_km numeric,
  created_at timestamp with time zone,
  distance_m double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    sr.id,
    sr.client_id,
    sr.service_type,
    sr.location_address,
    sr.location_city,
    sr.location_state,
    sr.location_lat,
    sr.location_lng,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.is_emergency,
    sr.estimated_price,
    sr.status,
    sr.service_radius_km,
    sr.created_at,
    -- ST_Distance retorna double precision, não numeric
    ST_Distance(
      ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
      spa.geom::geography
    ) as distance_m
  FROM service_requests sr
  CROSS JOIN service_provider_areas spa
  WHERE 
    spa.provider_id = provider_profile_id
    AND spa.is_active = true
    AND sr.status = 'OPEN'  -- Corrigido de 'PENDING' para 'OPEN'
    AND sr.location_lat IS NOT NULL 
    AND sr.location_lng IS NOT NULL
    -- Verificar se a solicitação está dentro do raio do prestador
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
      spa.geom::geography,
      spa.radius_km * 1000  -- converter km para metros
    )
    -- Validação adicional: se a solicitação tem raio definido, verificar se o prestador está dentro
    AND (
      sr.service_radius_km IS NULL OR
      ST_DWithin(
        spa.geom::geography,
        ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
        sr.service_radius_km * 1000  -- converter km para metros
      )
    )
    -- Filtrar por tipo de serviço compatível
    AND (
      spa.service_types IS NULL OR
      sr.service_type = ANY(spa.service_types)
    )
  ORDER BY distance_m ASC;
END;
$$;