-- ============================================================
-- RESTRICTIVE policy: Only profile owner or admin can SELECT
-- from base 'profiles' table. All third-party access must go
-- through 'profiles_secure' view (SECURITY DEFINER).
-- ============================================================

-- Drop overly permissive SELECT policies that expose PII
DROP POLICY IF EXISTS "profiles_select_freight_participants" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_service_participants" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_affiliated_drivers" ON public.profiles;

-- Add RESTRICTIVE policy: owner OR admin only
CREATE POLICY "profiles_restrictive_owner_or_admin"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
