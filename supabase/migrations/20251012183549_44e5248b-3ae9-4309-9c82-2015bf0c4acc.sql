-- Etapa 1: Adicionar coluna service_types em user_cities para permitir serviços específicos por cidade
ALTER TABLE user_cities 
ADD COLUMN IF NOT EXISTS service_types text[] DEFAULT '{}';

-- Comentário explicativo
COMMENT ON COLUMN user_cities.service_types IS 
'Tipos de serviço que o usuário presta NESTA cidade específica. Permite que prestadores tenham diferentes serviços em diferentes cidades.';

-- Criar índice GIN para busca eficiente em arrays
CREATE INDEX IF NOT EXISTS idx_user_cities_service_types ON user_cities USING GIN (service_types);

-- Etapa 2: Backfill - Copiar service_types de profiles para user_cities existentes
UPDATE user_cities uc
SET service_types = p.service_types
FROM profiles p
WHERE uc.user_id = p.user_id
  AND uc.type = 'PRESTADOR_SERVICO'
  AND p.role = 'PRESTADOR_SERVICOS'
  AND p.service_types IS NOT NULL
  AND array_length(p.service_types, 1) > 0
  AND (uc.service_types IS NULL OR array_length(uc.service_types, 1) IS NULL);

-- Etapa 3: Atualizar RPC para usar user_cities.service_types no matching
CREATE OR REPLACE FUNCTION public.execute_service_matching_with_user_cities(
  p_service_request_id uuid, 
  p_request_lat numeric, 
  p_request_lng numeric, 
  p_service_type text DEFAULT NULL
)
RETURNS TABLE(
  provider_id uuid, 
  provider_city_id uuid, 
  match_type text, 
  distance_m numeric, 
  match_score numeric, 
  service_compatibility_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  DELETE FROM service_matches WHERE service_request_id = p_service_request_id;
  
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
           AND uc.service_types IS NOT NULL 
           AND p_service_type = ANY(uc.service_types) THEN 'BOTH'
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
           AND uc.service_types IS NOT NULL 
           AND p_service_type = ANY(uc.service_types) THEN 1.0
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
      OR uc.service_types IS NULL
      OR array_length(uc.service_types, 1) IS NULL
      OR p_service_type = ANY(uc.service_types)
    )
  ON CONFLICT (service_request_id, provider_id, provider_area_id) DO NOTHING;
  
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
$function$;

-- Etapa 4: Criar RPC helper para listar serviços por cidade
CREATE OR REPLACE FUNCTION get_provider_services_by_city(p_provider_id uuid)
RETURNS TABLE(
  city_id uuid,
  city_name text,
  city_state text,
  service_types text[],
  radius_km numeric,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    c.id AS city_id,
    c.name AS city_name,
    c.state AS city_state,
    uc.service_types,
    uc.radius_km,
    uc.is_active
  FROM user_cities uc
  INNER JOIN cities c ON c.id = uc.city_id
  INNER JOIN profiles p ON p.user_id = uc.user_id
  WHERE p.id = p_provider_id
    AND uc.type = 'PRESTADOR_SERVICO'
  ORDER BY c.state, c.name;
$$;