-- Fix: Remove redundant/confusing INSERT policy on balance_transactions
-- service_role bypasses RLS entirely, so this policy is meaningless
-- and creates false security alerts. Normal authenticated users already
-- can't INSERT because is_service_role() returns false for them.
DROP POLICY IF EXISTS "balance_transactions_service_manage" ON public.balance_transactions;

-- Add explicit deny for authenticated INSERT (only service_role/edge functions should insert)
-- No INSERT policy for authenticated = denied by default (RLS enabled)

-- Add explicit deny for UPDATE/DELETE for authenticated (defense in depth)
DROP POLICY IF EXISTS "balance_transactions_deny_update" ON public.balance_transactions;
CREATE POLICY "balance_transactions_deny_update"
ON public.balance_transactions
FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "balance_transactions_deny_delete" ON public.balance_transactions;
CREATE POLICY "balance_transactions_deny_delete"
ON public.balance_transactions
FOR DELETE
TO authenticated
USING (false);