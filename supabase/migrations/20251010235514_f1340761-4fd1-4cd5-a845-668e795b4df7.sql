-- Add city/state fallback to freight matching functions (Fixed column names)

-- Drop and recreate find_drivers_by_origin with city fallback
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
  SELECT 
    origin_geog,
    origin_lat,
    origin_lng,
    origin_city,
    origin_state
  INTO freight_rec
  FROM freights 
  WHERE id = freight_uuid;
  
  IF freight_rec.origin_lat IS NOT NULL AND freight_rec.origin_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id,
      dsa.id AS driver_area_id,
      ST_Distance(dsa.geom, freight_rec.origin_geog)::numeric AS distance_m,
      dsa.city_name,
      dsa.radius_km,
      'GEOGRAPHIC'::text AS match_method
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true
      AND ST_DWithin(dsa.geom, freight_rec.origin_geog, dsa.radius_m)
    ORDER BY distance_m;
  
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.origin_state IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id,
      dsa.id AS driver_area_id,
      NULL::numeric AS distance_m,
      dsa.city_name,
      dsa.radius_km,
      'CITY_STATE'::text AS match_method
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true
      AND LOWER(dsa.city_name) = LOWER(freight_rec.origin_city)
      AND LOWER(dsa.state) = LOWER(freight_rec.origin_state)
    ORDER BY dsa.city_name;
  END IF;
END;
$$;

-- Drop and recreate find_drivers_by_route with city fallback
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
  SELECT 
    route_geom,
    origin_city,
    origin_state,
    destination_city,
    destination_state
  INTO freight_rec
  FROM freights 
  WHERE id = freight_uuid;
  
  IF freight_rec.route_geom IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id,
      dsa.id AS driver_area_id,
      ST_Distance(
        ST_ClosestPoint(freight_rec.route_geom::geography, dsa.geom), 
        dsa.geom
      )::numeric AS distance_to_route_m,
      dsa.city_name,
      dsa.radius_km,
      'ROUTE_GEOGRAPHIC'::text AS match_method
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true
      AND dsa.service_area IS NOT NULL
      AND ST_Intersects(dsa.service_area, ST_Transform(freight_rec.route_geom, 3857))
    ORDER BY distance_to_route_m;
  
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.destination_city IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id,
      dsa.id AS driver_area_id,
      NULL::numeric AS distance_to_route_m,
      dsa.city_name,
      dsa.radius_km,
      'CITY_ROUTE'::text AS match_method
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
$$;

-- Update execute_freight_matching
DROP FUNCTION IF EXISTS execute_freight_matching(uuid);

CREATE OR REPLACE FUNCTION execute_freight_matching(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, match_type text, distance_m numeric, match_score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  DELETE FROM freight_matches WHERE freight_id = freight_uuid;
  
  FOR rec IN SELECT * FROM find_drivers_by_origin(freight_uuid) LOOP
    INSERT INTO freight_matches (
      freight_id, driver_id, driver_area_id, match_type, distance_m, match_score
    ) VALUES (
      freight_uuid, 
      rec.driver_id, 
      rec.driver_area_id, 
      CASE 
        WHEN rec.match_method = 'GEOGRAPHIC' THEN 'ORIGIN'
        WHEN rec.match_method = 'CITY_STATE' THEN 'CITY'
        ELSE 'ORIGIN'
      END,
      rec.distance_m,
      CASE 
        WHEN rec.match_method = 'GEOGRAPHIC' AND rec.distance_m IS NOT NULL 
          THEN GREATEST(0.1, 1.0 - (rec.distance_m / (rec.radius_km * 1000)))
        WHEN rec.match_method = 'CITY_STATE' THEN 0.9
        ELSE 0.5
      END
    ) ON CONFLICT (freight_id, driver_id, driver_area_id) DO NOTHING;
  END LOOP;
  
  FOR rec IN SELECT * FROM find_drivers_by_route(freight_uuid) LOOP
    INSERT INTO freight_matches (
      freight_id, driver_id, driver_area_id, match_type, distance_m, match_score
    ) VALUES (
      freight_uuid, 
      rec.driver_id, 
      rec.driver_area_id, 
      CASE 
        WHEN rec.match_method = 'ROUTE_GEOGRAPHIC' THEN 'ROUTE'
        WHEN rec.match_method = 'CITY_ROUTE' THEN 'BOTH'
        ELSE 'ROUTE'
      END,
      rec.distance_to_route_m,
      CASE 
        WHEN rec.match_method = 'ROUTE_GEOGRAPHIC' AND rec.distance_to_route_m IS NOT NULL 
          THEN GREATEST(0.1, 1.0 - (rec.distance_to_route_m / (rec.radius_km * 1000)))
        WHEN rec.match_method = 'CITY_ROUTE' THEN 0.85
        ELSE 0.5
      END
    ) ON CONFLICT (freight_id, driver_id, driver_area_id) DO NOTHING;
  END LOOP;
  
  RETURN QUERY
  SELECT 
    fm.driver_id,
    fm.driver_area_id,
    fm.match_type,
    fm.distance_m,
    fm.match_score
  FROM freight_matches fm
  WHERE fm.freight_id = freight_uuid
  ORDER BY fm.match_score DESC, fm.distance_m ASC NULLS LAST;
END;
$$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_driver_service_areas_city_state 
ON driver_service_areas(LOWER(city_name), LOWER(state)) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_service_provider_areas_city 
ON service_provider_areas(LOWER(city_name)) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_freights_origin_city_state 
ON freights(LOWER(origin_city), LOWER(origin_state)) 
WHERE status IN ('OPEN', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS idx_freights_destination_city_state 
ON freights(LOWER(destination_city), LOWER(destination_state)) 
WHERE status IN ('OPEN', 'ACCEPTED');