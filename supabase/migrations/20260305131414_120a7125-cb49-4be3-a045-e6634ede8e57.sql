CREATE OR REPLACE FUNCTION public.can_view_vehicle_via_freight(vehicle_driver_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM freights f
    WHERE f.producer_id = get_current_profile_id()
      AND (f.driver_id = vehicle_driver_id OR vehicle_driver_id = ANY(f.drivers_assigned))
      AND f.status IN ('ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED')
    UNION
    SELECT 1 FROM freights f
    WHERE (f.driver_id = get_current_profile_id() OR get_current_profile_id() = ANY(f.drivers_assigned))
      AND (f.driver_id = vehicle_driver_id OR vehicle_driver_id = ANY(f.drivers_assigned))
      AND f.status IN ('ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED')
  )
$function$;

DROP POLICY IF EXISTS "Drivers can update their own vehicles" ON public.vehicles;