-- Fix 1: Harden search_path for admin SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.is_allowlisted_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT role FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Fix 2: Restrict tracking_settings to authenticated users only
DROP POLICY IF EXISTS "Anyone can view tracking settings" ON public.tracking_settings;

CREATE POLICY "Authenticated users view tracking settings"
ON public.tracking_settings FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);