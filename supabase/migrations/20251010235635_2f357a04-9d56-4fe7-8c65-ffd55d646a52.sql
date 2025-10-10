-- Fix security warnings and add service provider city matching

-- Fix search_path for the functions created earlier
DROP FUNCTION IF EXISTS find_drivers_by_origin(uuid);
CREATE OR REPLACE FUNCTION find_drivers_by_origin(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, distance_m numeric, city_name text, radius_km numeric, match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  freight_rec RECORD;
BEGIN
  SELECT origin_geog, origin_lat, origin_lng, origin_city, origin_state
  INTO freight_rec
  FROM freights WHERE id = freight_uuid;
  
  IF freight_rec.origin_lat IS NOT NULL AND freight_rec.origin_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT dsa.driver_id, dsa.id, ST_Distance(dsa.geom, freight_rec.origin_geog)::numeric, dsa.city_name, dsa.radius_km, 'GEOGRAPHIC'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true AND ST_DWithin(dsa.geom, freight_rec.origin_geog, dsa.radius_m)
    ORDER BY 3;
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.origin_state IS NOT NULL THEN
    RETURN QUERY
    SELECT dsa.driver_id, dsa.id, NULL::numeric, dsa.city_name, dsa.radius_km, 'CITY_STATE'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true AND LOWER(dsa.city_name) = LOWER(freight_rec.origin_city) AND LOWER(dsa.state) = LOWER(freight_rec.origin_state)
    ORDER BY dsa.city_name;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS find_drivers_by_route(uuid);
CREATE OR REPLACE FUNCTION find_drivers_by_route(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, distance_to_route_m numeric, city_name text, radius_km numeric, match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  freight_rec RECORD;
BEGIN
  SELECT route_geom, origin_city, origin_state, destination_city, destination_state
  INTO freight_rec
  FROM freights WHERE id = freight_uuid;
  
  IF freight_rec.route_geom IS NOT NULL THEN
    RETURN QUERY
    SELECT dsa.driver_id, dsa.id, ST_Distance(ST_ClosestPoint(freight_rec.route_geom::geography, dsa.geom), dsa.geom)::numeric, dsa.city_name, dsa.radius_km, 'ROUTE_GEOGRAPHIC'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true AND dsa.service_area IS NOT NULL AND ST_Intersects(dsa.service_area, ST_Transform(freight_rec.route_geom, 3857))
    ORDER BY 3;
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.destination_city IS NOT NULL THEN
    RETURN QUERY
    SELECT dsa.driver_id, dsa.id, NULL::numeric, dsa.city_name, dsa.radius_km, 'CITY_ROUTE'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true AND ((LOWER(dsa.city_name) = LOWER(freight_rec.origin_city) AND LOWER(dsa.state) = LOWER(freight_rec.origin_state)) OR (LOWER(dsa.city_name) = LOWER(freight_rec.destination_city) AND LOWER(dsa.state) = LOWER(freight_rec.destination_state)))
    ORDER BY dsa.city_name;
  END IF;
END;
$$;

-- Add service provider matching with city fallback
DROP FUNCTION IF EXISTS find_providers_by_location(uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION find_providers_by_location(
  request_id uuid,
  request_lat numeric,
  request_lng numeric
)
RETURNS TABLE(provider_id uuid, provider_area_id uuid, distance_m numeric, city_name text, radius_km numeric, service_types text[], match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_rec RECORD;
BEGIN
  SELECT origin_city, origin_state INTO request_rec
  FROM urban_service_requests WHERE id = request_id;
  
  IF request_lat IS NOT NULL AND request_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT spa.provider_id, spa.id, ST_Distance(spa.geom, ST_SetSRID(ST_MakePoint(request_lng, request_lat), 4326)::geography)::numeric, spa.city_name, spa.radius_km, spa.service_types, 'GEOGRAPHIC'::text
    FROM service_provider_areas spa
    WHERE spa.is_active = true AND ST_DWithin(spa.geom, ST_SetSRID(ST_MakePoint(request_lng, request_lat), 4326)::geography, spa.radius_m)
    ORDER BY 3;
  ELSIF request_rec.origin_city IS NOT NULL AND request_rec.origin_state IS NOT NULL THEN
    RETURN QUERY
    SELECT spa.provider_id, spa.id, NULL::numeric, spa.city_name, spa.radius_km, spa.service_types, 'CITY_STATE'::text
    FROM service_provider_areas spa
    WHERE spa.is_active = true AND LOWER(spa.city_name) = LOWER(request_rec.origin_city)
    ORDER BY spa.city_name;
  END IF;
END;
$$;