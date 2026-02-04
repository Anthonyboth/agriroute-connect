-- First fix the trigger function that uses geometry without extension prefix
-- The issue is that it casts NEW.geom to plain 'geometry' without extension schema

CREATE OR REPLACE FUNCTION public.update_provider_service_area_polygon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use extensions.geometry instead of bare geometry type
  IF NEW.geom IS NOT NULL AND NEW.radius_m IS NOT NULL THEN
    NEW.service_area := extensions.ST_Buffer(
      extensions.ST_Transform(NEW.geom::extensions.geometry, 3857), 
      NEW.radius_m
    );
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;