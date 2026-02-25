
-- Fix driver_location_history SELECT permission for authenticated users
-- This table is needed for GPS tracking display in maps
GRANT SELECT ON public.driver_location_history TO authenticated;
