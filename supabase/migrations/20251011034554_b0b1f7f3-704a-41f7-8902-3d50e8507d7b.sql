-- Fix PostGIS functions by removing geography variable declarations
-- and using inline casts only

-- 1. get_compatible_freights_for_driver (no geography vars - OK as is)
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(freight_id uuid, cargo_type text, weight numeric, origin_address text, destination_address text, pickup_date date, delivery_date date, price numeric, urgency text, status text, service_type text, distance_km numeric, minimum_antt_price numeric, required_trucks integer, accepted_trucks integer, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  driver_services text[];
BEGIN
  SELECT service_types INTO driver_services
  FROM public.profiles 
  WHERE id = p_driver_id AND role = 'MOTORISTA';
  
  IF driver_services IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at
  FROM public.freights f
  WHERE 
    f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks
    AND public.is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
    AND (
      EXISTS (
        SELECT 1 
        FROM public.driver_service_areas dsa
        WHERE dsa.driver_id = p_driver_id
          AND dsa.is_active = true
          AND (
            (
              f.origin_city IS NOT NULL 
              AND f.origin_state IS NOT NULL
              AND LOWER(TRIM(dsa.city_name)) = LOWER(TRIM(f.origin_city))
              AND LOWER(TRIM(dsa.state)) = LOWER(TRIM(f.origin_state))
            )
            OR
            (
              f.destination_city IS NOT NULL 
              AND f.destination_state IS NOT NULL
              AND LOWER(TRIM(dsa.city_name)) = LOWER(TRIM(f.destination_city))
              AND LOWER(TRIM(dsa.state)) = LOWER(TRIM(f.destination_state))
            )
            OR
            (
              f.origin_geog IS NOT NULL
              AND dsa.geom IS NOT NULL
              AND ST_DWithin(
                dsa.geom::geography, 
                f.origin_geog::geography, 
                COALESCE(dsa.radius_m, dsa.radius_km * 1000)::double precision
              )
            )
          )
      )
    )
  ORDER BY f.created_at DESC;
END;
$function$;

-- 2. find_drivers_by_origin (no geography vars - OK as is)
CREATE OR REPLACE FUNCTION public.find_drivers_by_origin(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, distance_m numeric, city_name text, radius_km numeric, match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  freight_rec RECORD;
BEGIN
  SELECT origin_geog, origin_lat, origin_lng, origin_city, origin_state
  INTO freight_rec
  FROM freights WHERE id = freight_uuid;
  
  IF freight_rec.origin_lat IS NOT NULL AND freight_rec.origin_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id, 
      dsa.id, 
      ST_Distance(dsa.geom::geography, freight_rec.origin_geog::geography)::numeric, 
      dsa.city_name, 
      dsa.radius_km, 
      'GEOGRAPHIC'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true 
      AND ST_DWithin(
        dsa.geom::geography, 
        freight_rec.origin_geog::geography, 
        COALESCE(dsa.radius_m, dsa.radius_km * 1000)::double precision
      )
    ORDER BY 3;
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.origin_state IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id, 
      dsa.id, 
      NULL::numeric, 
      dsa.city_name, 
      dsa.radius_km, 
      'CITY_STATE'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true 
      AND LOWER(dsa.city_name) = LOWER(freight_rec.origin_city) 
      AND LOWER(dsa.state) = LOWER(freight_rec.origin_state)
    ORDER BY dsa.city_name;
  END IF;
END;
$function$;

-- 3. find_drivers_by_route (no geography vars - OK as is)
CREATE OR REPLACE FUNCTION public.find_drivers_by_route(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, distance_to_route_m numeric, city_name text, radius_km numeric, match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  freight_rec RECORD;
BEGIN
  SELECT route_geom, origin_city, origin_state, destination_city, destination_state
  INTO freight_rec
  FROM freights WHERE id = freight_uuid;
  
  IF freight_rec.route_geom IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id, 
      dsa.id, 
      ST_Distance(dsa.geom::geography, freight_rec.route_geom::geography)::numeric, 
      dsa.city_name, 
      dsa.radius_km, 
      'ROUTE_GEOGRAPHIC'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true 
      AND dsa.service_area IS NOT NULL 
      AND ST_Intersects(dsa.service_area, ST_Transform(freight_rec.route_geom, 3857))
    ORDER BY 3;
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.destination_city IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id, 
      dsa.id, 
      NULL::numeric, 
      dsa.city_name, 
      dsa.radius_km, 
      'CITY_ROUTE'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true 
      AND (
        (LOWER(dsa.city_name) = LOWER(freight_rec.origin_city) AND LOWER(dsa.state) = LOWER(freight_rec.origin_state)) 
        OR 
        (LOWER(dsa.city_name) = LOWER(freight_rec.destination_city) AND LOWER(dsa.state) = LOWER(freight_rec.destination_state))
      )
    ORDER BY dsa.city_name;
  END IF;
END;
$function$;

-- 4. find_providers_by_location (no geography vars - OK as is)
CREATE OR REPLACE FUNCTION public.find_providers_by_location(request_id uuid, request_lat numeric, request_lng numeric)
RETURNS TABLE(provider_id uuid, provider_area_id uuid, distance_m numeric, city_name text, radius_km numeric, service_types text[], match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  request_rec RECORD;
BEGIN
  SELECT origin_city, origin_state INTO request_rec
  FROM urban_service_requests WHERE id = request_id;
  
  IF request_lat IS NOT NULL AND request_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      spa.provider_id, 
      spa.id, 
      ST_Distance(
        spa.geom::geography, 
        ST_SetSRID(ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::geography
      )::numeric, 
      spa.city_name, 
      spa.radius_km, 
      spa.service_types, 
      'GEOGRAPHIC'::text
    FROM service_provider_areas spa
    WHERE spa.is_active = true 
      AND ST_DWithin(
        spa.geom::geography, 
        ST_SetSRID(ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::geography,
        COALESCE(spa.radius_m, spa.radius_km * 1000)::double precision
      )
    ORDER BY 3;
  ELSIF request_rec.origin_city IS NOT NULL AND request_rec.origin_state IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      spa.provider_id, 
      spa.id, 
      NULL::numeric, 
      spa.city_name, 
      spa.radius_km, 
      spa.service_types, 
      'CITY_STATE'::text
    FROM service_provider_areas spa
    WHERE spa.is_active = true 
      AND LOWER(spa.city_name) = LOWER(request_rec.origin_city)
    ORDER BY spa.city_name;
  END IF;
END;
$function$;

-- 5. get_freights_in_radius (no geography vars - OK as is)
CREATE OR REPLACE FUNCTION public.get_freights_in_radius(p_driver_id uuid)
RETURNS TABLE(freight_id uuid, distance_m numeric, cargo_type text, origin_address text, destination_address text, price numeric, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    ST_Distance(dsa.geom::geography, f.origin_geog::geography)::numeric as distance_m,
    f.cargo_type,
    f.origin_address,
    f.destination_address,
    f.price,
    f.status::text
  FROM freights f
  CROSS JOIN driver_service_areas dsa
  WHERE dsa.driver_id = p_driver_id
    AND dsa.is_active = true
    AND f.status = 'OPEN'
    AND f.origin_geog IS NOT NULL
    AND ST_DWithin(
      f.origin_geog::geography, 
      dsa.geom::geography, 
      (dsa.radius_km * 1000)::double precision
    )
  ORDER BY distance_m;
END;
$function$;

-- 6. get_service_requests_in_radius (no geography vars - OK as is)
CREATE OR REPLACE FUNCTION public.get_service_requests_in_radius(p_provider_id uuid)
RETURNS TABLE(request_id uuid, distance_m numeric, service_type text, origin_address text, destination_address text, price numeric, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(sr.origin_lng::double precision, sr.origin_lat::double precision), 4326)::geography,
      spa.geom::geography
    )::numeric as distance_m,
    sr.service_type,
    sr.origin_address,
    sr.destination_address,
    sr.price,
    sr.status
  FROM urban_service_requests sr
  CROSS JOIN service_provider_areas spa
  WHERE spa.provider_id = p_provider_id
    AND spa.is_active = true
    AND sr.status = 'PENDING'
    AND sr.origin_lat IS NOT NULL
    AND sr.origin_lng IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(sr.origin_lng::double precision, sr.origin_lat::double precision), 4326)::geography,
      spa.geom::geography,
      (spa.radius_km * 1000)::double precision
    )
  ORDER BY distance_m;
END;
$function$;

-- 7. find_providers_by_service_and_location (REMOVE geography variable declaration)
CREATE OR REPLACE FUNCTION public.find_providers_by_service_and_location(request_id uuid, request_lat numeric, request_lng numeric, required_service_type text)
RETURNS TABLE(provider_id uuid, provider_area_id uuid, distance_m numeric, city_name text, radius_km numeric, service_types text[], service_match boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
BEGIN
  -- Use inline cast instead of declaring geography variable
  RETURN QUERY
  SELECT 
    spa.provider_id,
    spa.id AS provider_area_id,
    ST_Distance(
      spa.geom::geography, 
      ST_SetSRID(ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::geography
    )::numeric AS distance_m,
    spa.city_name,
    spa.radius_km,
    spa.service_types,
    (required_service_type = ANY(spa.service_types)) AS service_match
  FROM service_provider_areas spa
  WHERE spa.is_active = true
    AND ST_DWithin(
      spa.geom::geography, 
      ST_SetSRID(ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::geography,
      COALESCE(spa.radius_m, spa.radius_km * 1000)::double precision
    )
    AND (
      array_length(spa.service_types, 1) IS NULL
      OR required_service_type = ANY(spa.service_types)
    )
  ORDER BY 
    service_match DESC,
    distance_m ASC;
END;
$function$;

-- 8. Update triggers (geometry types, not geography - OK as is)
CREATE OR REPLACE FUNCTION public.update_service_area_polygon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
BEGIN
  NEW.service_area := ST_Buffer(
    ST_Transform(NEW.geom::geometry, 3857), 
    NEW.radius_m
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_provider_service_area_polygon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
BEGIN
  NEW.service_area := ST_Buffer(
    ST_Transform(NEW.geom::geometry, 3857), 
    NEW.radius_m
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_producer_service_area_geom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$function$;