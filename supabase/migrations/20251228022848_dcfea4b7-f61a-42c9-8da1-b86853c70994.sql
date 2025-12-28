-- Fix profiles RLS recursion + correct auth mapping (auth.uid() -> profiles.user_id)

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove policies that can trigger recursion / wrong uid mapping
DROP POLICY IF EXISTS "Company can see affiliated driver profiles" ON public.profiles;
DROP POLICY IF EXISTS "Driver can see company owner profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate the core authenticated policies with correct column mapping
DROP POLICY IF EXISTS profiles_select_simple ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;

CREATE POLICY profiles_select_own_or_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY profiles_insert_own_or_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY profiles_update_own_or_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
