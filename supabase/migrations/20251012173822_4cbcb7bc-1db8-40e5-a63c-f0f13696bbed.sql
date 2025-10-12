-- Remover função existente
DROP FUNCTION IF EXISTS get_compatible_freights_for_driver(uuid);

-- Criar função RPC para buscar fretes compatíveis para motorista
-- Usa a estrutura hierárquica de cidades para encontrar fretes relevantes

CREATE OR REPLACE FUNCTION get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  destination_address text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  price_per_km numeric,
  urgency text,
  status text,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamp with time zone,
  match_distance_m numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_service_types text[];
BEGIN
  -- Buscar tipos de serviço do motorista
  SELECT service_types INTO driver_service_types
  FROM profiles
  WHERE id = p_driver_id;
  
  -- Retornar fretes que atendem aos critérios:
  -- 1. Status OPEN
  -- 2. Ainda tem vagas (accepted_trucks < required_trucks)
  -- 3. Tipo de serviço compatível
  -- 4. Origem ou destino dentro das áreas de atendimento do motorista
  RETURN QUERY
  SELECT DISTINCT
    f.id as freight_id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.price_per_km,
    f.urgency,
    f.status,
    COALESCE(f.service_type, 'CARGA') as service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at,
    NULL::numeric as match_distance_m
  FROM freights f
  WHERE f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks
    AND (
      driver_service_types IS NULL 
      OR array_length(driver_service_types, 1) IS NULL
      OR COALESCE(f.service_type, 'CARGA') = ANY(driver_service_types)
    )
    AND (
      -- Match por origin_city_id usando hierarquia
      EXISTS (
        SELECT 1 FROM driver_service_areas dsa
        JOIN cities c ON c.id = dsa.city_id
        WHERE dsa.driver_id = p_driver_id
          AND dsa.is_active = true
          AND (
            f.origin_city_id = c.id
            OR f.destination_city_id = c.id
          )
      )
      OR
      -- Fallback: Match por nome de cidade/estado se city_id não existe
      EXISTS (
        SELECT 1 FROM driver_service_areas dsa
        WHERE dsa.driver_id = p_driver_id
          AND dsa.is_active = true
          AND (
            (LOWER(TRIM(f.origin_city)) = LOWER(TRIM(dsa.city_name)) AND LOWER(TRIM(f.origin_state)) = LOWER(TRIM(dsa.state)))
            OR
            (LOWER(TRIM(f.destination_city)) = LOWER(TRIM(dsa.city_name)) AND LOWER(TRIM(f.destination_state)) = LOWER(TRIM(dsa.state)))
          )
      )
    )
  ORDER BY 
    f.urgency DESC,
    f.created_at DESC;
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_compatible_freights_for_driver(uuid) TO authenticated;