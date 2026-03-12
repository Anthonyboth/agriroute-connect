-- =====================================================
-- FIX: Replace permissive USING(true) SELECT on profiles
-- with properly scoped policies
-- =====================================================

-- 1. Drop the blanket permissive policy
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

-- 2. Policy: own profile
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Policy: freight participants (active freights only)
DROP POLICY IF EXISTS "profiles_select_freight_participants" ON public.profiles;
CREATE POLICY "profiles_select_freight_participants"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_freight_participant(id));

-- 4. Policy: service participants (active services only)
DROP POLICY IF EXISTS "profiles_select_service_participants" ON public.profiles;
CREATE POLICY "profiles_select_service_participants"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_service_participant(id));

-- 5. Policy: affiliated drivers of caller's company
DROP POLICY IF EXISTS "profiles_select_affiliated_drivers" ON public.profiles;
CREATE POLICY "profiles_select_affiliated_drivers"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_affiliated_driver_of_my_company(id));

-- Note: profiles_select_admin already exists for admin access
-- Note: profiles_secure view runs as owner with own WHERE clause, unaffected