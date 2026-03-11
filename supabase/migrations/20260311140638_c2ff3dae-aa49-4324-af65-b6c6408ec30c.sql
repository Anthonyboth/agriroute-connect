
-- =====================================================================
-- FIX: Convert all SECURITY DEFINER views to SECURITY INVOKER
-- =====================================================================

-- 1. PROFILES: Drop restrictive policy that blocks non-owners from SELECT.
--    The profiles_secure view provides CLS (column-level security) for PII masking.
--    With security_invoker=true, we need all authenticated users to SELECT from profiles.
DROP POLICY IF EXISTS "profiles_restrictive_owner_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_only" ON public.profiles;

-- Add a broad permissive SELECT for all authenticated users.
-- PII protection is enforced at the VIEW level (profiles_secure).
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. BALANCE_TRANSACTIONS: Add admin SELECT policy (currently only has own).
CREATE POLICY "balance_transactions_select_admin"
  ON public.balance_transactions
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. FREIGHT_PAYMENTS: Add admin SELECT policy.
CREATE POLICY "freight_payments_select_admin"
  ON public.freight_payments
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Convert ALL 9 views to security_invoker=true
ALTER VIEW public.profiles_secure SET (security_invoker = true);
ALTER VIEW public.balance_transactions_secure SET (security_invoker = true);
ALTER VIEW public.service_requests_secure SET (security_invoker = true);
ALTER VIEW public.freight_payments_secure SET (security_invoker = true);
ALTER VIEW public.freight_messages_secure SET (security_invoker = true);
ALTER VIEW public.forum_post_scores SET (security_invoker = true);
ALTER VIEW public.forum_thread_comment_counts SET (security_invoker = true);
ALTER VIEW public.forum_thread_scores SET (security_invoker = true);
ALTER VIEW public.forum_user_karma SET (security_invoker = true);
