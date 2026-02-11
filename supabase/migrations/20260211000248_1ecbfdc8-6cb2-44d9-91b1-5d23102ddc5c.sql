-- Fix: Change profiles SELECT policies from TO public → TO authenticated
-- This prevents anonymous users from accessing profile data via freight/company relationships

DROP POLICY IF EXISTS "profiles_select_freight_participants" ON public.profiles;
CREATE POLICY "profiles_select_freight_participants"
ON public.profiles FOR SELECT
TO authenticated
USING (is_freight_participant(id));

DROP POLICY IF EXISTS "profiles_select_affiliated_drivers" ON public.profiles;
CREATE POLICY "profiles_select_affiliated_drivers"
ON public.profiles FOR SELECT
TO authenticated
USING (is_affiliated_driver_of_my_company(id));