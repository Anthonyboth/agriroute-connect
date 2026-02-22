
-- Remove recursive policies
DROP POLICY IF EXISTS admin_users_select_by_admin ON public.admin_users;
DROP POLICY IF EXISTS admin_users_update_by_superadmin ON public.admin_users;

-- New SELECT: each admin reads only their own record
CREATE POLICY "Users can view their own admin record"
ON public.admin_users
FOR SELECT
USING (user_id = auth.uid() AND is_active = true);

-- New UPDATE: only superadmins can update their own record
CREATE POLICY "Superadmins can update their own admin record"
ON public.admin_users
FOR UPDATE
USING (user_id = auth.uid() AND is_active = true AND role = 'superadmin');
