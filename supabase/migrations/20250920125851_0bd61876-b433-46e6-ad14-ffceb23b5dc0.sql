-- Fix remaining function security warnings by adding proper search paths
-- Need to drop trigger first, then function, then recreate both

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_update_service_area_polygon ON public.driver_service_areas;

-- Drop functions
DROP FUNCTION IF EXISTS public.find_drivers_by_origin(uuid);
DROP FUNCTION IF EXISTS public.find_drivers_by_route(uuid);
DROP FUNCTION IF EXISTS public.execute_freight_matching(uuid);
DROP FUNCTION IF EXISTS public.can_notify_driver(uuid);
DROP FUNCTION IF EXISTS update_service_area_polygon();

-- Function to update service area polygon with proper search path
CREATE OR REPLACE FUNCTION update_service_area_polygon()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Convert to Web Mercator (3857) for accurate buffer calculation
  NEW.service_area := ST_Buffer(
    ST_Transform(NEW.geom::geometry, 3857), 
    NEW.radius_m
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_update_service_area_polygon
  BEFORE INSERT OR UPDATE OF lat, lng, radius_km 
  ON public.driver_service_areas
  FOR EACH ROW 
  EXECUTE FUNCTION update_service_area_polygon();

-- Function to find drivers by freight origin point with proper search path
CREATE OR REPLACE FUNCTION public.find_drivers_by_origin(freight_uuid uuid)
RETURNS TABLE (
  driver_id uuid,
  driver_area_id uuid,
  distance_m numeric,
  city_name text,
  radius_km numeric
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dsa.driver_id,
    dsa.id AS driver_area_id,
    ST_Distance(dsa.geom, f.origin_geog)::numeric AS distance_m,
    dsa.city_name,
    dsa.radius_km
  FROM driver_service_areas dsa
  JOIN freights f ON f.id = freight_uuid
  WHERE dsa.is_active = true
    AND ST_DWithin(dsa.geom, f.origin_geog, dsa.radius_m)
  ORDER BY distance_m;
END;
$$;

-- Function to find drivers by freight route intersection with proper search path
CREATE OR REPLACE FUNCTION public.find_drivers_by_route(freight_uuid uuid)
RETURNS TABLE (
  driver_id uuid,
  driver_area_id uuid,
  distance_to_route_m numeric,
  city_name text,
  radius_km numeric
)
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dsa.driver_id,
    dsa.id AS driver_area_id,
    ST_Distance(
      ST_ClosestPoint(f.route_geom::geography, dsa.geom), 
      dsa.geom
    )::numeric AS distance_to_route_m,
    dsa.city_name,
    dsa.radius_km
  FROM driver_service_areas dsa
  JOIN freights f ON f.id = freight_uuid
  WHERE dsa.is_active = true
    AND f.route_geom IS NOT NULL
    AND dsa.service_area IS NOT NULL
    AND ST_Intersects(
      dsa.service_area, 
      ST_Transform(f.route_geom, 3857)
    )
  ORDER BY distance_to_route_m;
END;
$$;

-- Function to execute complete matching for a freight with proper search path
CREATE OR REPLACE FUNCTION public.execute_freight_matching(freight_uuid uuid)
RETURNS TABLE (
  driver_id uuid,
  driver_area_id uuid,
  match_type text,
  distance_m numeric,
  match_score numeric
)
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Clear existing matches for this freight
  DELETE FROM freight_matches WHERE freight_id = freight_uuid;
  
  -- Match by origin
  FOR rec IN SELECT * FROM find_drivers_by_origin(freight_uuid) LOOP
    INSERT INTO freight_matches (
      freight_id, driver_id, driver_area_id, match_type, distance_m, match_score
    ) VALUES (
      freight_uuid, 
      rec.driver_id, 
      rec.driver_area_id, 
      'ORIGIN', 
      rec.distance_m,
      GREATEST(0.1, 1.0 - (rec.distance_m / (rec.radius_km * 1000)))
    ) ON CONFLICT (freight_id, driver_id, driver_area_id) DO NOTHING;
  END LOOP;
  
  -- Match by route if available
  FOR rec IN SELECT * FROM find_drivers_by_route(freight_uuid) LOOP
    INSERT INTO freight_matches (
      freight_id, driver_id, driver_area_id, match_type, distance_m, match_score
    ) VALUES (
      freight_uuid, 
      rec.driver_id, 
      rec.driver_area_id, 
      'ROUTE', 
      rec.distance_to_route_m,
      GREATEST(0.1, 1.0 - (rec.distance_to_route_m / (rec.radius_km * 1000)))
    ) ON CONFLICT (freight_id, driver_id, driver_area_id) DO NOTHING;
  END LOOP;
  
  -- Return all matches
  RETURN QUERY
  SELECT 
    fm.driver_id,
    fm.driver_area_id,
    fm.match_type,
    fm.distance_m,
    fm.match_score
  FROM freight_matches fm
  WHERE fm.freight_id = freight_uuid
  ORDER BY fm.match_score DESC, fm.distance_m ASC;
END;
$$;

-- Function to check notification throttling with proper search path
CREATE OR REPLACE FUNCTION public.can_notify_driver(p_driver_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count integer;
  max_count integer;
  window_start timestamptz;
BEGIN
  -- Get current notification status
  SELECT 
    notification_count, 
    max_notifications_per_hour,
    window_start
  INTO current_count, max_count, window_start
  FROM driver_notification_limits 
  WHERE driver_id = p_driver_id;
  
  -- If no record exists, create one and allow notification
  IF NOT FOUND THEN
    INSERT INTO driver_notification_limits (driver_id, notification_count)
    VALUES (p_driver_id, 1);
    RETURN true;
  END IF;
  
  -- Reset counter if window expired (1 hour)
  IF window_start < now() - interval '1 hour' THEN
    UPDATE driver_notification_limits 
    SET notification_count = 1, 
        window_start = now(),
        updated_at = now()
    WHERE driver_id = p_driver_id;
    RETURN true;
  END IF;
  
  -- Check if under limit
  IF current_count < max_count THEN
    UPDATE driver_notification_limits 
    SET notification_count = notification_count + 1,
        updated_at = now()
    WHERE driver_id = p_driver_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;