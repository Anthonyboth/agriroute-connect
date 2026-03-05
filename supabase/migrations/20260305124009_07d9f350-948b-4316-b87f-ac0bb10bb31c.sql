
REVOKE ALL ON public.admin_users FROM anon;

CREATE POLICY "Deny anon access to admin_users"
ON public.admin_users
AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Fix existing policies: change from 'public' to 'authenticated'
DROP POLICY IF EXISTS "Users can view their own admin record" ON public.admin_users;
DROP POLICY IF EXISTS "Superadmins can update their own admin record" ON public.admin_users;

CREATE POLICY "Admins view own record"
ON public.admin_users
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND is_active = true);

CREATE POLICY "Superadmins update own record"
ON public.admin_users
FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND is_active = true AND role = 'superadmin');
