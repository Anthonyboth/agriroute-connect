
DROP FUNCTION IF EXISTS public.get_freights_for_driver(UUID);

CREATE FUNCTION public.get_freights_for_driver(p_driver_id UUID)
RETURNS TABLE (
  id UUID,
  cargo_type TEXT,
  weight NUMERIC,
  origin_address TEXT,
  origin_city TEXT,
  origin_state TEXT,
  destination_address TEXT,
  destination_city TEXT,
  destination_state TEXT,
  price NUMERIC,
  distance_km NUMERIC,
  pickup_date DATE,
  delivery_date DATE,
  urgency TEXT,
  status TEXT,
  service_type TEXT,
  created_at TIMESTAMPTZ,
  distance_to_origin_km NUMERIC,
  required_trucks INTEGER,
  accepted_trucks INTEGER,
  minimum_antt_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_role TEXT;
  driver_rating NUMERIC;
  driver_is_company BOOLEAN;
  driver_user_id UUID;
  user_type TEXT;
  has_cities BOOLEAN;
  driver_service_types TEXT[];
BEGIN
  SELECT 
    p.role,
    COALESCE(p.rating, 0),
    p.user_id,
    p.service_types,
    EXISTS(SELECT 1 FROM transport_companies WHERE profile_id = p_driver_id)
  INTO driver_role, driver_rating, driver_user_id, driver_service_types, driver_is_company
  FROM profiles p
  WHERE p.id = p_driver_id;

  IF driver_user_id IS NULL THEN
    RETURN;
  END IF;

  IF driver_is_company OR driver_role = 'TRANSPORTADORA' THEN
    user_type := 'TRANSPORTADORA';
  ELSE
    user_type := 'AUTONOMO';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_cities uc
    WHERE uc.user_id = driver_user_id
      AND uc.is_active = true
      AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  ) INTO has_cities;

  IF NOT has_cities THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
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
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.created_at,
    CASE 
      WHEN f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL 
           AND uc_city.lat IS NOT NULL AND uc_city.lng IS NOT NULL
      THEN ROUND(
        (6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(uc_city.lat)) * cos(radians(f.origin_lat)) *
            cos(radians(f.origin_lng) - radians(uc_city.lng)) +
            sin(radians(uc_city.lat)) * sin(radians(f.origin_lat))
          ))
        ))::numeric, 1
      )
      ELSE NULL
    END AS distance_to_origin_km,
    f.required_trucks,
    f.accepted_trucks,
    f.minimum_antt_price
  FROM freights f
  INNER JOIN user_cities uc ON uc.user_id = driver_user_id
    AND uc.is_active = true
    AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  INNER JOIN cities uc_city ON uc_city.id = uc.city_id
  WHERE f.status = 'OPEN'
    AND f.driver_id IS NULL
    AND (
      f.origin_city_id = uc.city_id
      OR f.destination_city_id = uc.city_id
      OR (
        f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL
        AND uc_city.lat IS NOT NULL AND uc_city.lng IS NOT NULL
        AND (6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians(uc_city.lat)) * cos(radians(f.origin_lat)) *
            cos(radians(f.origin_lng) - radians(uc_city.lng)) +
            sin(radians(uc_city.lat)) * sin(radians(f.origin_lat))
          ))
        )) <= LEAST(COALESCE(uc.radius_km, 50), 300)
      )
    )
    AND (
      (driver_service_types IS NOT NULL AND array_length(driver_service_types, 1) > 0
       AND f.service_type = ANY(driver_service_types))
      OR (uc.service_types IS NOT NULL AND array_length(uc.service_types, 1) > 0
          AND f.service_type = ANY(uc.service_types))
      OR (
        (driver_service_types IS NULL OR array_length(driver_service_types, 1) IS NULL)
        AND (uc.service_types IS NULL OR array_length(uc.service_types, 1) IS NULL)
        AND f.service_type = 'CARGA'
      )
    )
    AND (
      COALESCE(f.visibility_filter, 'ALL') = 'ALL'
      OR (f.visibility_filter = 'TRANSPORTADORAS' AND user_type = 'TRANSPORTADORA')
      OR (f.visibility_filter = 'AUTONOMOS' AND user_type = 'AUTONOMO')
      OR (f.visibility_filter = 'AVALIACAO_3' AND driver_rating >= 3)
      OR (f.visibility_filter = 'AVALIACAO_4' AND driver_rating >= 4)
    )
  ORDER BY f.created_at DESC
  LIMIT 100;
END;
$$;
