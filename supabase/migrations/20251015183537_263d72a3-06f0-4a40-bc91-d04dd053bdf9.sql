-- Dropar funções existentes para recriá-las com user_cities
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);
DROP FUNCTION IF EXISTS public.get_freights_in_radius(uuid);
DROP FUNCTION IF EXISTS public.find_drivers_by_origin(text, text);
DROP FUNCTION IF EXISTS public.find_drivers_by_route(text, text, text, text);

-- Recriar get_compatible_freights_for_driver usando user_cities
CREATE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  id uuid,
  producer_id uuid,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  cargo_type text,
  weight numeric,
  price numeric,
  pickup_date date,
  delivery_date date,
  status freight_status,
  created_at timestamp with time zone,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  service_type text,
  urgency text,
  distance_km numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  driver_services text[];
  driver_user_id uuid;
BEGIN
  SELECT service_types, user_id INTO driver_services, driver_user_id
  FROM profiles WHERE id = p_driver_id;
  
  IF driver_user_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT
    f.id, f.producer_id, f.origin_city, f.origin_state,
    f.destination_city, f.destination_state, f.cargo_type, f.weight,
    f.price, f.pickup_date, f.delivery_date, f.status, f.created_at,
    f.origin_lat, f.origin_lng, f.destination_lat, f.destination_lng,
    f.service_type, f.urgency, f.distance_km
  FROM freights f
  WHERE f.status = 'OPEN' AND f.driver_id IS NULL
    AND is_service_compatible(driver_services, f.service_type)
    AND EXISTS (
      SELECT 1 FROM user_cities uc
      JOIN cities c ON uc.city_id = c.id
      WHERE uc.user_id = driver_user_id
        AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
        AND uc.is_active = true
        AND (
          (LOWER(TRIM(c.name)) = LOWER(TRIM(f.origin_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.origin_state)))
          OR (LOWER(TRIM(c.name)) = LOWER(TRIM(f.destination_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.destination_state)))
          OR (f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL AND
              ST_DWithin(ST_SetSRID(ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::geography,
                         ST_SetSRID(ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::geography,
                         (uc.radius_km * 1000)::double precision))
          OR (f.destination_lat IS NOT NULL AND f.destination_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL AND
              ST_DWithin(ST_SetSRID(ST_MakePoint(f.destination_lng::double precision, f.destination_lat::double precision), 4326)::geography,
                         ST_SetSRID(ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::geography,
                         (uc.radius_km * 1000)::double precision))
        )
    )
  ORDER BY f.created_at DESC;
END;
$$;

-- Recriar get_freights_in_radius usando user_cities
CREATE FUNCTION public.get_freights_in_radius(p_driver_id uuid)
RETURNS TABLE(
  id uuid, producer_id uuid, origin_city text, origin_state text,
  destination_city text, destination_state text, cargo_type text, weight numeric,
  price numeric, pickup_date date, delivery_date date, status freight_status,
  created_at timestamp with time zone, origin_lat numeric, origin_lng numeric,
  destination_lat numeric, destination_lng numeric, service_type text,
  urgency text, distance_km numeric, distance_from_driver numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  driver_services text[];
  driver_user_id uuid;
BEGIN
  SELECT service_types, user_id INTO driver_services, driver_user_id
  FROM profiles WHERE id = p_driver_id;
  
  IF driver_user_id IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  SELECT DISTINCT f.id, f.producer_id, f.origin_city, f.origin_state,
    f.destination_city, f.destination_state, f.cargo_type, f.weight, f.price,
    f.pickup_date, f.delivery_date, f.status, f.created_at, f.origin_lat, f.origin_lng,
    f.destination_lat, f.destination_lng, f.service_type, f.urgency, f.distance_km,
    LEAST(
      COALESCE(extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography
      ) / 1000.0, 999999),
      COALESCE(extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(f.destination_lng::double precision, f.destination_lat::double precision), 4326)::extensions.geography
      ) / 1000.0, 999999)
    )::numeric AS distance_from_driver
  FROM freights f
  CROSS JOIN LATERAL (
    SELECT c.lat, c.lng, uc.radius_km FROM user_cities uc
    JOIN cities c ON uc.city_id = c.id
    WHERE uc.user_id = driver_user_id
      AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
      AND uc.is_active = true LIMIT 1
  ) c
  WHERE f.status = 'OPEN' AND f.driver_id IS NULL
    AND is_service_compatible(driver_services, f.service_type)
    AND (
      (f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL AND
       extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography,
                            extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
                            (c.radius_km * 1000)::double precision))
      OR (f.destination_lat IS NOT NULL AND f.destination_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL AND
          extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(f.destination_lng::double precision, f.destination_lat::double precision), 4326)::extensions.geography,
                               extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
                               (c.radius_km * 1000)::double precision))
    )
  ORDER BY distance_from_driver ASC, f.created_at DESC;
END;
$$;

-- Recriar find_drivers_by_origin usando user_cities
CREATE FUNCTION public.find_drivers_by_origin(origin_city_param text, origin_state_param text)
RETURNS TABLE(driver_id uuid, driver_name text, driver_rating numeric, distance_km numeric, service_types text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id, p.full_name, p.rating, 0::numeric, p.service_types
  FROM profiles p
  JOIN user_cities uc ON uc.user_id = p.user_id
  JOIN cities c ON uc.city_id = c.id
  WHERE p.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO') AND p.status = 'APPROVED'
    AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO') AND uc.is_active = true
    AND LOWER(TRIM(c.name)) = LOWER(TRIM(origin_city_param))
    AND LOWER(TRIM(c.state)) = LOWER(TRIM(origin_state_param))
  ORDER BY p.rating DESC NULLS LAST;
END;
$$;

-- Recriar find_drivers_by_route usando user_cities
CREATE FUNCTION public.find_drivers_by_route(origin_city_param text, origin_state_param text, destination_city_param text, destination_state_param text)
RETURNS TABLE(driver_id uuid, driver_name text, driver_rating numeric, match_score numeric, service_types text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH driver_matches AS (
    SELECT DISTINCT p.id, p.full_name, p.rating, p.service_types, COUNT(DISTINCT uc.id) AS matching_cities
    FROM profiles p
    JOIN user_cities uc ON uc.user_id = p.user_id
    JOIN cities c ON uc.city_id = c.id
    WHERE p.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO') AND p.status = 'APPROVED'
      AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO') AND uc.is_active = true
      AND (
        (LOWER(TRIM(c.name)) = LOWER(TRIM(origin_city_param)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(origin_state_param)))
        OR (LOWER(TRIM(c.name)) = LOWER(TRIM(destination_city_param)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(destination_state_param)))
      )
    GROUP BY p.id, p.full_name, p.rating, p.service_types
  )
  SELECT id, full_name, rating, (matching_cities::numeric * 50.0), service_types
  FROM driver_matches
  ORDER BY match_score DESC, rating DESC NULLS LAST;
END;
$$;