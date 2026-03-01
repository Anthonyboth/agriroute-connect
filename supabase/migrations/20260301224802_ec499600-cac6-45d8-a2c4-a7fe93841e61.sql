
-- Drop the old admin policy and recreate to also check admin_users table
DROP POLICY IF EXISTS "Admins podem gerenciar anúncios" ON public.system_announcements;

CREATE POLICY "Admins podem gerenciar anúncios"
  ON public.system_announcements
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = true
    )
  );
