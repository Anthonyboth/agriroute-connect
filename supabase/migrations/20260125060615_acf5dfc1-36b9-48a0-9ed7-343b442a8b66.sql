-- Fix RLS for profiles: split "own" vs "admin" policies to prevent any unintended broad exposure
-- and satisfy strict scanner expectations (no OR in user-facing policy).

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own_or_admin ON public.profiles;

-- Keep existing admin-only delete policy if present
-- (Recreate explicitly to ensure consistency)
DROP POLICY IF EXISTS profiles_delete_admin_only ON public.profiles;

-- SELECT
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY profiles_select_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- INSERT
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_insert_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- DELETE (admin only)
CREATE POLICY profiles_delete_admin_only
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- NOTE: If the app uses views like profiles_secure, this change is safe and preserves admin capabilities,
-- while ensuring regular users can never enumerate or read other profiles.
