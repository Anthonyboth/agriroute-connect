-- Fix: Remove redundant service_role policies on driver_stripe_accounts
-- service_role bypasses RLS entirely, so these policies are meaningless

DROP POLICY IF EXISTS "driver_stripe_accounts_service_manage" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_service_select" ON public.driver_stripe_accounts;

-- Add owner SELECT policy (was missing - users couldn't read their own data via base table)
CREATE POLICY "driver_stripe_select_own_only"
ON public.driver_stripe_accounts
FOR SELECT
TO authenticated
USING (driver_id = get_my_profile_id_for_pii());

-- Add explicit DELETE deny
CREATE POLICY "driver_stripe_deny_delete"
ON public.driver_stripe_accounts
FOR DELETE
TO authenticated
USING (false);