
-- ============================================
-- FIX: telegram_message_queue - restringir a service_role + admin
-- ============================================
DROP POLICY IF EXISTS "System can manage telegram queue" ON public.telegram_message_queue;

CREATE POLICY "service_role_manages_telegram_queue"
ON public.telegram_message_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "admins_can_view_telegram_queue"
ON public.telegram_message_queue
FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================
-- FIX: prospect_users - restringir a service_role + admin
-- ============================================
DROP POLICY IF EXISTS "System can manage prospect users" ON public.prospect_users;

CREATE POLICY "service_role_manages_prospects"
ON public.prospect_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "admins_can_view_prospects"
ON public.prospect_users
FOR SELECT
TO authenticated
USING (is_admin());
