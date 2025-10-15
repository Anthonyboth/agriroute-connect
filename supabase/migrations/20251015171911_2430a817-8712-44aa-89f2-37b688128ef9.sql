-- Fix and enhance get_compatible_freights_for_driver: type-safe returns + user_cities fallback
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  accepted_trucks integer,
  cargo_type text,
  created_at timestamptz,
  delivery_date timestamptz,
  destination_address text,
  destination_city text,
  destination_state text,
  distance_km numeric,
  freight_id uuid,
  match_distance_m numeric,
  minimum_antt_price numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  pickup_date timestamptz,
  price numeric,
  price_per_km numeric,
  pricing_type text,
  required_trucks integer,
  service_type text,
  status freight_status,
  urgency text,
  weight numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_service_types text[];
BEGIN
  -- Current user for this driver profile
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_driver_id LIMIT 1;

  -- Driver service types (normalize later)
  SELECT service_types::text[] INTO v_service_types
  FROM profiles WHERE id = p_driver_id;

  RETURN QUERY
  WITH driver_matches AS (
    SELECT fm.freight_id,
           MIN(fm.distance_m)::numeric AS match_distance_m
    FROM freight_matches fm
    WHERE fm.driver_id = p_driver_id
    GROUP BY fm.freight_id
  ),
  city_matches AS (
    SELECT f.id AS freight_id,
           0::numeric AS match_distance_m
    FROM freights f
    JOIN user_cities uc ON uc.user_id = v_user_id AND uc.is_active = true
                         AND uc.type IN ('MOTORISTA_ORIGEM','MOTORISTA_DESTINO')
    LEFT JOIN cities c ON c.id = uc.city_id
    WHERE f.status = 'OPEN'
      AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
      AND (
        (f.origin_city_id IS NOT NULL AND uc.city_id = f.origin_city_id)
        OR (f.destination_city_id IS NOT NULL AND uc.city_id = f.destination_city_id)
        OR (
          c.name IS NOT NULL AND c.state IS NOT NULL
          AND (
            (lower(c.name) = lower(coalesce(f.origin_city, '')) AND lower(c.state) = lower(coalesce(f.origin_state,'')))
            OR
            (lower(c.name) = lower(coalesce(f.destination_city,'')) AND lower(c.state) = lower(coalesce(f.destination_state,'')))
          )
        )
      )
  ),
  all_matches AS (
    SELECT dm.freight_id, dm.match_distance_m FROM driver_matches dm
    UNION
    SELECT cm.freight_id, cm.match_distance_m FROM city_matches cm
  )
  SELECT 
    f.accepted_trucks,
    COALESCE(f.cargo_type::text, '') AS cargo_type,
    f.created_at,
    f.delivery_date::timestamptz,
    COALESCE(f.destination_address, '') AS destination_address,
    COALESCE(f.destination_city, '') AS destination_city,
    COALESCE(f.destination_state, '') AS destination_state,
    CASE WHEN all_matches.match_distance_m IS NOT NULL THEN ROUND(all_matches.match_distance_m / 1000.0, 1) ELSE NULL END AS distance_km,
    f.id AS freight_id,
    all_matches.match_distance_m,
    COALESCE(f.minimum_antt_price, 0)::numeric AS minimum_antt_price,
    COALESCE(f.origin_address, '') AS origin_address,
    COALESCE(f.origin_city, '') AS origin_city,
    COALESCE(f.origin_state, '') AS origin_state,
    f.pickup_date::timestamptz,
    COALESCE(f.price, 0)::numeric AS price,
    COALESCE(f.price_per_km, 0)::numeric AS price_per_km,
    COALESCE(f.pricing_type, '') AS pricing_type,
    COALESCE(f.required_trucks, 1) AS required_trucks,
    CASE 
      WHEN f.service_type IS NULL THEN 'CARGA'
      WHEN f.service_type::text IN ('CARGA_FREIGHT') THEN 'CARGA'
      WHEN f.service_type::text IN ('GUINCHO_FREIGHT','FRETE_MOTO') THEN 'GUINCHO'
      ELSE f.service_type::text
    END AS service_type,
    f.status,
    COALESCE(f.urgency::text, 'LOW') AS urgency,
    COALESCE(f.weight, 0)::numeric AS weight
  FROM freights f
  JOIN all_matches ON all_matches.freight_id = f.id
  WHERE f.status = 'OPEN'
    AND COALESCE(f.accepted_trucks,0) < COALESCE(f.required_trucks,1)
    AND (
      v_service_types IS NULL OR array_length(v_service_types,1) IS NULL
      OR CASE 
           WHEN f.service_type IS NULL THEN 'CARGA'
           WHEN f.service_type::text IN ('CARGA_FREIGHT') THEN 'CARGA'
           WHEN f.service_type::text IN ('GUINCHO_FREIGHT','FRETE_MOTO') THEN 'GUINCHO'
           ELSE f.service_type::text
         END = ANY(v_service_types)
    )
  ORDER BY all_matches.match_distance_m NULLS LAST, f.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compatible_freights_for_driver(uuid) TO authenticated;