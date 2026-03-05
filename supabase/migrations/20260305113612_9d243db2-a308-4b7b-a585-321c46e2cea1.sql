
-- Fix driver_current_locations RLS policies to use get_my_profile_id() instead of direct profiles subquery
-- This prevents "permission denied for table profiles" errors caused by restrictive RLS on profiles

-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "driver_current_locations_insert_own" ON public.driver_current_locations;
CREATE POLICY "driver_current_locations_insert_own"
  ON public.driver_current_locations FOR INSERT
  TO authenticated
  WITH CHECK (driver_profile_id = get_my_profile_id());

-- Drop and recreate SELECT own policy
DROP POLICY IF EXISTS "driver_current_locations_select_own" ON public.driver_current_locations;
CREATE POLICY "driver_current_locations_select_own"
  ON public.driver_current_locations FOR SELECT
  TO authenticated
  USING (driver_profile_id = get_my_profile_id());

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "driver_current_locations_update_own" ON public.driver_current_locations;
CREATE POLICY "driver_current_locations_update_own"
  ON public.driver_current_locations FOR UPDATE
  TO authenticated
  USING (driver_profile_id = get_my_profile_id())
  WITH CHECK (driver_profile_id = get_my_profile_id());
