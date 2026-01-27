-- Fix: prevent authenticated users from reading all profiles (LGPD)
-- Restrict SELECT on public.profiles to profile owner only and harden RLS.

BEGIN;

-- Ensure RLS is enabled and enforced even for table owners
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Remove broad/administrative SELECT policy (admins should use server-side/service-role paths)
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

-- Recreate strict owner-only SELECT policy
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMIT;