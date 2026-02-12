
DROP FUNCTION IF EXISTS public.execute_freight_matching(UUID);

CREATE FUNCTION public.execute_freight_matching(freight_uuid UUID)
RETURNS TABLE(driver_id UUID, driver_area_id UUID, match_type TEXT, distance_m DOUBLE PRECISION, match_score DOUBLE PRECISION)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        WHEN rec.match_method = 'GEOGRAPHIC' THEN 'SPATIAL_RADIUS'
        WHEN rec.match_method = 'CITY_STATE' THEN 'CITY_MATCH'
        ELSE 'SPATIAL_MATCH'
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
        WHEN rec.match_method = 'ROUTE_GEOGRAPHIC' THEN 'PROXIMITY_MATCH'
        WHEN rec.match_method = 'CITY_ROUTE' THEN 'EXACT_MATCH'
        ELSE 'RADIUS_MATCH'
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
