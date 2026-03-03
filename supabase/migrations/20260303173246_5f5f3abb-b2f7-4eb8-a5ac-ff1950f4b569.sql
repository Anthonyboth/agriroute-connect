-- ============================================================
-- Revoke direct SELECT on balance_transactions base table
-- for authenticated users. Sensitive Stripe IDs hidden.
-- Client reads go through balance_transactions_secure view.
-- Edge functions use service_role (unaffected).
-- ============================================================

-- Drop the permissive SELECT policy for owners
DROP POLICY IF EXISTS "balance_transactions_owner_only" ON public.balance_transactions;

-- Revoke full SELECT from authenticated
REVOKE SELECT ON public.balance_transactions FROM authenticated;

-- Re-grant SELECT only on non-sensitive columns
GRANT SELECT (id, provider_id, transaction_type, amount, status, description, reference_type, created_at, updated_at) ON public.balance_transactions TO authenticated;

-- Add restrictive owner-only SELECT (without Stripe IDs)
CREATE POLICY "balance_transactions_select_own"
ON public.balance_transactions
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (provider_id = get_my_profile_id());
