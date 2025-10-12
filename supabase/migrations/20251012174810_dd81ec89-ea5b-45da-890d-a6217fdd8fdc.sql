-- Etapa 1: Atualizar get_compatible_freights_for_driver para usar user_cities
DROP FUNCTION IF EXISTS get_compatible_freights_for_driver(UUID);

CREATE OR REPLACE FUNCTION get_compatible_freights_for_driver(p_driver_id UUID)
RETURNS TABLE(
  freight_id UUID,
  cargo_type TEXT,
  weight NUMERIC,
  origin_address TEXT,
  origin_city TEXT,
  origin_state TEXT,
  destination_address TEXT,
  destination_city TEXT,
  destination_state TEXT,
  pickup_date DATE,
  delivery_date DATE,
  price NUMERIC,
  pricing_type TEXT,
  price_per_km NUMERIC,
  urgency TEXT,
  status freight_status,
  service_type TEXT,
  distance_km NUMERIC,
  minimum_antt_price NUMERIC,
  required_trucks INTEGER,
  accepted_trucks INTEGER,
  created_at TIMESTAMPTZ,
  match_distance_m NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (f.id)
    f.id AS freight_id,
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
    f.pricing_type,
    f.price_per_km,
    f.urgency,
    f.status,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at,
    COALESCE(
      -- Match por city_id (hierárquico)
      (SELECT MIN(
        CASE 
          WHEN uc.type = 'MOTORISTA_ORIGEM' AND f.origin_city_id = uc.city_id THEN 0
          WHEN uc.type = 'MOTORISTA_DESTINO' AND f.destination_city_id = uc.city_id THEN 0
          ELSE NULL
        END
      )
      FROM user_cities uc
      WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
        AND uc.is_active = true
        AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
        AND (
          (uc.type = 'MOTORISTA_ORIGEM' AND f.origin_city_id = uc.city_id) OR
          (uc.type = 'MOTORISTA_DESTINO' AND f.destination_city_id = uc.city_id)
        )
      ),
      -- Fallback: Match por city_name e state (dados antigos)
      (SELECT MIN(999999)
      FROM user_cities uc
      JOIN cities c ON uc.city_id = c.id
      WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
        AND uc.is_active = true
        AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
        AND (
          (uc.type = 'MOTORISTA_ORIGEM' AND LOWER(TRIM(c.name)) = LOWER(TRIM(f.origin_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.origin_state))) OR
          (uc.type = 'MOTORISTA_DESTINO' AND LOWER(TRIM(c.name)) = LOWER(TRIM(f.destination_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.destination_state)))
        )
      )
    ) AS match_distance_m
  FROM freights f
  WHERE f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks
    AND (
      -- Match hierárquico por city_id
      EXISTS (
        SELECT 1
        FROM user_cities uc
        WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
          AND uc.is_active = true
          AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
          AND (
            (uc.type = 'MOTORISTA_ORIGEM' AND f.origin_city_id = uc.city_id) OR
            (uc.type = 'MOTORISTA_DESTINO' AND f.destination_city_id = uc.city_id)
          )
      )
      OR
      -- Fallback: Match por city_name e state
      EXISTS (
        SELECT 1
        FROM user_cities uc
        JOIN cities c ON uc.city_id = c.id
        WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
          AND uc.is_active = true
          AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
          AND (
            (uc.type = 'MOTORISTA_ORIGEM' AND LOWER(TRIM(c.name)) = LOWER(TRIM(f.origin_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.origin_state))) OR
            (uc.type = 'MOTORISTA_DESTINO' AND LOWER(TRIM(c.name)) = LOWER(TRIM(f.destination_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.destination_state)))
          )
      )
    )
  ORDER BY f.id, match_distance_m ASC NULLS LAST, f.created_at DESC;
END;
$$;

-- Etapa 2: Script de migração de dados (se existirem)
-- Migrar dados de driver_service_areas para user_cities
INSERT INTO user_cities (user_id, city_id, type, radius_km, is_active, created_at)
SELECT 
  p.user_id,
  COALESCE(
    c.id,
    -- Se não encontrar, tentar criar a cidade (fallback)
    (SELECT id FROM cities WHERE LOWER(TRIM(name)) = LOWER(TRIM(dsa.city_name)) AND LOWER(TRIM(state)) = LOWER(TRIM(dsa.state)) LIMIT 1)
  ) as city_id,
  'MOTORISTA_ORIGEM'::user_city_type as type,
  dsa.radius_km,
  dsa.is_active,
  dsa.created_at
FROM driver_service_areas dsa
JOIN profiles p ON dsa.driver_id = p.id
LEFT JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(dsa.city_name)) 
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(dsa.state))
WHERE NOT EXISTS (
  -- Evitar duplicatas
  SELECT 1 FROM user_cities uc
  WHERE uc.user_id = p.user_id
    AND uc.city_id = c.id
    AND uc.type = 'MOTORISTA_ORIGEM'
)
AND c.id IS NOT NULL
ON CONFLICT (user_id, city_id, type) DO NOTHING;