-- Fix critical RLS recursion on public.profiles
-- 1) Temporarily disable RLS to stop recursion during migration
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2) Drop ALL existing policies on public.profiles (regardless of name)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- 3) Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) Recreate minimal, non-recursive, safe policies
-- Users can SELECT only their own profile (based on user_id), or admins can select all
CREATE POLICY profiles_select_own_or_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Users can INSERT only their own profile (based on user_id), or admins can insert
CREATE POLICY profiles_insert_own_or_admin
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Users can UPDATE only their own profile (based on user_id), or admins can update
CREATE POLICY profiles_update_own_or_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Optional: Restrict DELETE to admins only for safety
CREATE POLICY profiles_delete_admin_only
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Service role (Edge Functions) full access
CREATE POLICY profiles_service_role_all
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5) Sanity check: list policies after changes
-- (For reference when running in the SQL editor)
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies WHERE tablename = 'profiles' ORDER BY policyname;