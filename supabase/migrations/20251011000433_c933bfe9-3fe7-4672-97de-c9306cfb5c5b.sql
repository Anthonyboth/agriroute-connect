-- Drop and recreate get_compatible_freights_for_driver with correct city/state logic
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status text,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  driver_services text[];
BEGIN
  -- Get driver service types
  SELECT service_types INTO driver_services
  FROM public.profiles 
  WHERE id = p_driver_id AND role = 'MOTORISTA';
  
  IF driver_services IS NULL THEN
    RETURN;
  END IF;
  
  -- Return compatible freights using driver_service_areas for city matching
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
      -- Match using driver_service_areas with structured city/state fields
      EXISTS (
        SELECT 1 
        FROM public.driver_service_areas dsa
        WHERE dsa.driver_id = p_driver_id
          AND dsa.is_active = true
          AND (
            -- Match origin city/state
            (
              f.origin_city IS NOT NULL 
              AND f.origin_state IS NOT NULL
              AND LOWER(TRIM(dsa.city_name)) = LOWER(TRIM(f.origin_city))
              AND LOWER(TRIM(dsa.state)) = LOWER(TRIM(f.origin_state))
            )
            OR
            -- Match destination city/state
            (
              f.destination_city IS NOT NULL 
              AND f.destination_state IS NOT NULL
              AND LOWER(TRIM(dsa.city_name)) = LOWER(TRIM(f.destination_city))
              AND LOWER(TRIM(dsa.state)) = LOWER(TRIM(f.destination_state))
            )
            OR
            -- Fallback: Geographic matching if coordinates exist
            (
              f.origin_geog IS NOT NULL
              AND dsa.geom IS NOT NULL
              AND ST_DWithin(dsa.geom, f.origin_geog, dsa.radius_m)
            )
          )
      )
    )
  ORDER BY f.created_at DESC;
END;
$function$;

-- Create function to sync service_cities from driver_service_areas
CREATE OR REPLACE FUNCTION public.sync_driver_service_cities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update profiles.service_cities based on active driver_service_areas
  UPDATE public.profiles p
  SET service_cities = (
    SELECT array_agg(DISTINCT (dsa.city_name || ', ' || dsa.state))
    FROM public.driver_service_areas dsa
    WHERE dsa.driver_id = COALESCE(NEW.driver_id, OLD.driver_id)
      AND dsa.is_active = true
  )
  WHERE p.id = COALESCE(NEW.driver_id, OLD.driver_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_service_cities_on_area_change ON public.driver_service_areas;

-- Create trigger to sync service_cities whenever driver_service_areas changes
CREATE TRIGGER sync_service_cities_on_area_change
AFTER INSERT OR UPDATE OR DELETE ON public.driver_service_areas
FOR EACH ROW
EXECUTE FUNCTION public.sync_driver_service_cities();

-- Initial sync: Update all existing profiles with their active service areas
UPDATE public.profiles p
SET service_cities = (
  SELECT array_agg(DISTINCT (dsa.city_name || ', ' || dsa.state))
  FROM public.driver_service_areas dsa
  WHERE dsa.driver_id = p.id
    AND dsa.is_active = true
)
WHERE p.role = 'MOTORISTA';