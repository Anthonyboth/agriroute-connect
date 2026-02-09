
-- 1) Restrict antifraud_nfe_rules to authenticated users only
CREATE POLICY "antifraud_rules_authenticated_select"
ON public.antifraud_nfe_rules
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2) Fix get_freights_for_driver to filter by driver's configured cities AND service types
-- Currently it only returns service_type='CARGA' and does NO city filtering
DROP FUNCTION IF EXISTS public.get_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
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
  distance_to_origin_km numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
  -- Get driver info
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

  -- Determine user type for visibility filter
  IF driver_is_company OR driver_role = 'TRANSPORTADORA' THEN
    user_type := 'TRANSPORTADORA';
  ELSE
    user_type := 'AUTONOMO';
  END IF;

  -- Check if driver has configured cities
  SELECT EXISTS(
    SELECT 1 FROM user_cities uc
    WHERE uc.user_id = driver_user_id
      AND uc.is_active = true
      AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  ) INTO has_cities;

  -- If no cities configured, return empty (driver must configure cities first)
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
    -- Calculate distance if coordinates available
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
    END AS distance_to_origin_km
  FROM freights f
  -- Join to find matching cities
  INNER JOIN user_cities uc ON uc.user_id = driver_user_id
    AND uc.is_active = true
    AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  INNER JOIN cities uc_city ON uc_city.id = uc.city_id
  WHERE f.status = 'OPEN'
    AND f.driver_id IS NULL
    -- City matching: by city_id or by spatial radius (max 300km)
    AND (
      -- Exact city_id match (origin or destination)
      f.origin_city_id = uc.city_id
      OR f.destination_city_id = uc.city_id
      -- Spatial match within configured radius (max 300km cap)
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
    -- Service type filtering: match driver's configured types
    AND (
      -- If driver has service_types on profile, use those
      (driver_service_types IS NOT NULL AND array_length(driver_service_types, 1) > 0
       AND f.service_type = ANY(driver_service_types))
      -- If driver has service_types on user_cities, use those  
      OR (uc.service_types IS NOT NULL AND array_length(uc.service_types, 1) > 0
          AND f.service_type = ANY(uc.service_types))
      -- Fallback: if no types configured anywhere, show CARGA only (safe default)
      OR (
        (driver_service_types IS NULL OR array_length(driver_service_types, 1) IS NULL)
        AND (uc.service_types IS NULL OR array_length(uc.service_types, 1) IS NULL)
        AND f.service_type = 'CARGA'
      )
    )
    -- Visibility filter
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
