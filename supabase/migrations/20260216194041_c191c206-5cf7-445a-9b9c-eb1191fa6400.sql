
-- Drop the existing function first, then recreate with pricing fields
DROP FUNCTION IF EXISTS public.get_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  destination_address text,
  destination_city text,
  destination_state text,
  price numeric,
  distance_km numeric,
  pickup_date timestamptz,
  delivery_date timestamptz,
  urgency text,
  status text,
  service_type text,
  created_at timestamptz,
  distance_to_origin_km numeric,
  required_trucks integer,
  accepted_trucks integer,
  minimum_antt_price numeric,
  origin_city_id uuid,
  pricing_type text,
  price_per_km numeric,
  vehicle_type_required text,
  vehicle_axles_required integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT p.user_id INTO v_user_id FROM profiles p WHERE p.id = p_driver_id;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (f.id)
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.price,
    f.distance_km,
    f.pickup_date,
    f.delivery_date,
    f.urgency::TEXT,
    f.status::TEXT,
    f.service_type,
    f.created_at,
    ROUND(CAST(
      6371 * acos(
        GREATEST(-1, LEAST(1,
          cos(radians(COALESCE(f.origin_lat, fc.lat))) *
          cos(radians(c.lat)) *
          cos(radians(c.lng) - radians(COALESCE(f.origin_lng, fc.lng))) +
          sin(radians(COALESCE(f.origin_lat, fc.lat))) *
          sin(radians(c.lat))
        ))
      ) AS NUMERIC
    ), 2) AS distance_to_origin_km,
    f.required_trucks,
    f.accepted_trucks,
    f.minimum_antt_price,
    COALESCE(f.origin_city_id, fc.id) AS origin_city_id,
    f.pricing_type::TEXT,
    f.price_per_km,
    f.vehicle_type_required,
    f.vehicle_axles_required
  FROM freights f
  INNER JOIN user_cities uc
    ON uc.user_id = v_user_id
   AND uc.is_active = true
  INNER JOIN cities c
    ON c.id = uc.city_id
  LEFT JOIN cities fc
    ON fc.id = f.origin_city_id
  WHERE f.status = 'OPEN'::freight_status
    AND c.lat IS NOT NULL
    AND c.lng IS NOT NULL
    AND (
      (f.origin_city_id IS NOT NULL AND f.origin_city_id = uc.city_id)
      OR
      (LOWER(f.origin_city) = LOWER(c.name) AND LOWER(f.origin_state) = LOWER(c.state))
      OR
      (
        COALESCE(f.origin_lat, fc.lat) IS NOT NULL
        AND COALESCE(f.origin_lng, fc.lng) IS NOT NULL
        AND 6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians(COALESCE(f.origin_lat, fc.lat))) *
            cos(radians(c.lat)) *
            cos(radians(c.lng) - radians(COALESCE(f.origin_lng, fc.lng))) +
            sin(radians(COALESCE(f.origin_lat, fc.lat))) *
            sin(radians(c.lat))
          ))
        ) <= LEAST(COALESCE(uc.radius_km, 50), 300)
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM match_exposures me
      WHERE me.viewer_user_id = v_user_id
        AND me.item_type = 'FREIGHT'
        AND me.item_id = f.id
        AND me.expires_at > now()
        AND me.status IN ('SEEN', 'DISMISSED', 'ACCEPTED')
    )
  ORDER BY f.id, distance_to_origin_km ASC NULLS LAST;
END;
$$;
