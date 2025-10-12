-- 1. Criar função RPC para buscar service requests baseado em user_cities
CREATE OR REPLACE FUNCTION get_service_requests_for_provider_cities(p_provider_id UUID)
RETURNS TABLE(
  request_id UUID,
  service_type TEXT,
  location_address TEXT,
  city_name TEXT,
  state TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  problem_description TEXT,
  urgency TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  vehicle_info TEXT,
  additional_info TEXT,
  is_emergency BOOLEAN,
  estimated_price NUMERIC,
  client_id UUID,
  distance_m NUMERIC,
  provider_city TEXT,
  provider_radius_km NUMERIC
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (sr.id)
    sr.id AS request_id,
    sr.service_type,
    sr.location_address,
    sr.city_name,
    sr.state,
    sr.location_lat,
    sr.location_lng,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.status,
    sr.created_at,
    sr.vehicle_info,
    sr.additional_info,
    sr.is_emergency,
    sr.estimated_price,
    sr.client_id,
    CASE 
      WHEN sr.location_lat IS NOT NULL AND sr.location_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL THEN
        extensions.ST_Distance(
          extensions.ST_SetSRID(extensions.ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision), 4326)::extensions.geography,
          extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography
        )::numeric
      ELSE NULL
    END AS distance_m,
    c.name AS provider_city,
    uc.radius_km AS provider_radius_km
  FROM service_requests sr
  INNER JOIN user_cities uc ON uc.user_id IN (
    SELECT user_id FROM profiles WHERE id = p_provider_id
  )
  INNER JOIN cities c ON c.id = uc.city_id
  WHERE uc.type = 'PRESTADOR_SERVICO'
    AND uc.is_active = true
    AND sr.status = 'OPEN'
    AND sr.provider_id IS NULL
    AND (
      -- Match por coordenadas geográficas dentro do raio
      (sr.location_lat IS NOT NULL 
       AND sr.location_lng IS NOT NULL 
       AND c.lat IS NOT NULL 
       AND c.lng IS NOT NULL
       AND extensions.ST_DWithin(
         extensions.ST_SetSRID(extensions.ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision), 4326)::extensions.geography,
         extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
         (uc.radius_km * 1000)::double precision
       ))
      OR
      -- Match por cidade/estado
      (LOWER(sr.city_name) = LOWER(c.name) AND LOWER(sr.state) = LOWER(c.state))
    )
  ORDER BY sr.id, distance_m NULLS LAST;
END;
$$;

-- 2. Migrar dados de service_provider_areas para user_cities
INSERT INTO user_cities (user_id, city_id, type, radius_km, is_active, created_at, updated_at)
SELECT DISTINCT
  p.user_id,
  c.id AS city_id,
  'PRESTADOR_SERVICO'::user_city_type,
  spa.radius_km,
  spa.is_active,
  spa.created_at,
  spa.updated_at
FROM service_provider_areas spa
INNER JOIN profiles p ON spa.provider_id = p.id
INNER JOIN cities c ON LOWER(c.name) = LOWER(spa.city_name) 
  AND (spa.state IS NULL OR LOWER(c.state) = LOWER(spa.state))
WHERE NOT EXISTS (
  SELECT 1 FROM user_cities uc
  WHERE uc.user_id = p.user_id
    AND uc.city_id = c.id
    AND uc.type = 'PRESTADOR_SERVICO'
)
ON CONFLICT (user_id, city_id, type) DO UPDATE SET
  radius_km = EXCLUDED.radius_km,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 3. Atualizar função de matching espacial para usar user_cities
CREATE OR REPLACE FUNCTION execute_service_matching_with_user_cities(
  p_service_request_id UUID,
  p_request_lat NUMERIC,
  p_request_lng NUMERIC,
  p_service_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  provider_id UUID,
  provider_city_id UUID,
  match_type TEXT,
  distance_m NUMERIC,
  match_score NUMERIC,
  service_compatibility_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Limpar matches existentes
  DELETE FROM service_matches WHERE service_request_id = p_service_request_id;
  
  -- Encontrar prestadores por localização e tipo de serviço usando user_cities
  INSERT INTO service_matches (
    service_request_id,
    provider_id,
    provider_area_id,
    match_type,
    distance_m,
    match_score,
    service_compatibility_score
  )
  SELECT
    p_service_request_id,
    p.id AS provider_id,
    uc.id AS provider_area_id,
    CASE 
      WHEN p_service_type IS NOT NULL 
           AND p.service_types IS NOT NULL 
           AND p_service_type = ANY(p.service_types) THEN 'BOTH'
      ELSE 'LOCATION'
    END AS match_type,
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_request_lng::double precision, p_request_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography
    )::numeric AS distance_m,
    GREATEST(0.1, 1.0 - (
      extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(p_request_lng::double precision, p_request_lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography
      ) / (uc.radius_km * 1000)
    )) AS match_score,
    CASE 
      WHEN p_service_type IS NOT NULL 
           AND p.service_types IS NOT NULL 
           AND p_service_type = ANY(p.service_types) THEN 1.0
      ELSE 0.5
    END AS service_compatibility_score
  FROM user_cities uc
  INNER JOIN profiles p ON p.user_id = uc.user_id AND p.role = 'PRESTADOR_SERVICOS'
  INNER JOIN cities c ON c.id = uc.city_id
  WHERE uc.type = 'PRESTADOR_SERVICO'
    AND uc.is_active = true
    AND p.status = 'APPROVED'
    AND c.lat IS NOT NULL
    AND c.lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_request_lng::double precision, p_request_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
      (uc.radius_km * 1000)::double precision
    )
    AND (
      p_service_type IS NULL
      OR p.service_types IS NULL
      OR array_length(p.service_types, 1) IS NULL
      OR p_service_type = ANY(p.service_types)
    )
  ON CONFLICT (service_request_id, provider_id, provider_area_id) DO NOTHING;
  
  -- Retornar todos os matches
  RETURN QUERY
  SELECT 
    sm.provider_id,
    sm.provider_area_id,
    sm.match_type,
    sm.distance_m,
    sm.match_score,
    sm.service_compatibility_score
  FROM service_matches sm
  WHERE sm.service_request_id = p_service_request_id
  ORDER BY 
    sm.service_compatibility_score DESC,
    sm.match_score DESC,
    sm.distance_m ASC;
END;
$$;