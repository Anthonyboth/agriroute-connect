
-- =====================================================
-- HARDENING: profiles PII access
-- Objective: ensure unauthenticated/public roles have zero access,
-- and make the deny intent explicit for scanners.
-- =====================================================

-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Explicitly revoke any accidental/default privileges from PUBLIC/anon
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- Also harden the secure view privileges (view still respects base-table RLS)
REVOKE ALL ON TABLE public.profiles_secure FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles_secure FROM anon;

-- 3) Add an explicit deny policy for anon (defense-in-depth, clarity for scanners)
DROP POLICY IF EXISTS profiles_deny_anon_select ON public.profiles;
CREATE POLICY profiles_deny_anon_select
ON public.profiles
FOR SELECT
TO anon
USING (false);
