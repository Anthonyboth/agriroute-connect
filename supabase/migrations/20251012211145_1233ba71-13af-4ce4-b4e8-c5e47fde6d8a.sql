-- Migration: Consolidar sistema de cidades para user_cities (v2)
-- Corrige problema de tipo de retorno das funções

-- 1. Migrar TODOS os motoristas do sistema antigo para o novo
INSERT INTO user_cities (user_id, city_id, type, radius_km, is_active, created_at)
SELECT 
  p.user_id,
  c.id as city_id,
  'MOTORISTA_ORIGEM'::user_city_type,
  dsa.radius_km,
  dsa.is_active,
  dsa.created_at
FROM driver_service_areas dsa
JOIN profiles p ON dsa.driver_id = p.id
LEFT JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(dsa.city_name)) 
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(dsa.state))
WHERE c.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_cities uc 
    WHERE uc.user_id = p.user_id 
      AND uc.city_id = c.id
      AND uc.type = 'MOTORISTA_ORIGEM'
  )
ON CONFLICT (user_id, city_id, type) DO NOTHING;

-- 2. Desativar sistema antigo para evitar duplicação de notificações
UPDATE driver_service_areas 
SET is_active = false 
WHERE is_active = true;

-- 3. DROP funções antigas
DROP FUNCTION IF EXISTS find_drivers_by_origin(uuid);
DROP FUNCTION IF EXISTS find_drivers_by_route(uuid);

-- 4. Criar função find_drivers_by_origin para usar user_cities
CREATE OR REPLACE FUNCTION find_drivers_by_origin(freight_uuid uuid)
RETURNS TABLE(
  driver_id uuid,
  driver_area_id uuid,
  match_method text,
  distance_m numeric,
  radius_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id as driver_id,
    uc.id as driver_area_id,
    CASE
      WHEN f.origin_city_id = uc.city_id THEN 'CITY_STATE'
      WHEN extensions.ST_DWithin(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography,
        (uc.radius_km * 1000)::double precision
      ) THEN 'GEOGRAPHIC'
      ELSE 'NONE'
    END as match_method,
    CASE
      WHEN f.origin_city_id = uc.city_id THEN 0
      ELSE extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography
      )
    END::numeric as distance_m,
    uc.radius_km
  FROM freights f
  JOIN user_cities uc ON uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  JOIN cities c ON uc.city_id = c.id
  JOIN profiles p ON uc.user_id = p.user_id
  WHERE f.id = freight_uuid
    AND uc.is_active = true
    AND p.role = 'MOTORISTA'
    AND p.status = 'APPROVED'
    AND (
      f.origin_city_id = uc.city_id
      OR extensions.ST_DWithin(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography,
        (uc.radius_km * 1000)::double precision
      )
    );
END;
$$;

-- 5. Criar função find_drivers_by_route para usar user_cities
CREATE OR REPLACE FUNCTION find_drivers_by_route(freight_uuid uuid)
RETURNS TABLE(
  driver_id uuid,
  driver_area_id uuid,
  match_method text,
  distance_to_route_m numeric,
  radius_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id as driver_id,
    uc.id as driver_area_id,
    CASE
      WHEN f.destination_city_id = uc.city_id THEN 'CITY_ROUTE'
      WHEN extensions.ST_DWithin(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_MakeLine(
          extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326),
          extensions.ST_SetSRID(extensions.ST_MakePoint(f.destination_lng::double precision, f.destination_lat::double precision), 4326)
        )::extensions.geography,
        (uc.radius_km * 1000)::double precision
      ) THEN 'ROUTE_GEOGRAPHIC'
      ELSE 'NONE'
    END as match_method,
    CASE
      WHEN f.destination_city_id = uc.city_id THEN 0
      ELSE extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_MakeLine(
          extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326),
          extensions.ST_SetSRID(extensions.ST_MakePoint(f.destination_lng::double precision, f.destination_lat::double precision), 4326)
        )::extensions.geography
      )
    END::numeric as distance_to_route_m,
    uc.radius_km
  FROM freights f
  JOIN user_cities uc ON uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  JOIN cities c ON uc.city_id = c.id
  JOIN profiles p ON uc.user_id = p.user_id
  WHERE f.id = freight_uuid
    AND uc.is_active = true
    AND p.role = 'MOTORISTA'
    AND p.status = 'APPROVED'
    AND (
      f.destination_city_id = uc.city_id
      OR extensions.ST_DWithin(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_MakeLine(
          extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326),
          extensions.ST_SetSRID(extensions.ST_MakePoint(f.destination_lng::double precision, f.destination_lat::double precision), 4326)
        )::extensions.geography,
        (uc.radius_km * 1000)::double precision
      )
    );
END;
$$;