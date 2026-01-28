-- Tighten profiles SELECT policies by removing OR clause and separating owner vs admin access
-- This addresses the finding where a combined policy was flagged as overly broad.

BEGIN;

DROP POLICY IF EXISTS "profiles_select_own_only" ON public.profiles;

-- Owners can read only their own profile row
CREATE POLICY "profiles_select_own_only"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

COMMIT;