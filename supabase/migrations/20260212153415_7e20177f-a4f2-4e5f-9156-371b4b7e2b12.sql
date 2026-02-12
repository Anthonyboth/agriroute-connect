
-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins podem ver todas as transações" ON public.balance_transactions;
DROP POLICY IF EXISTS "balance_transactions_owner_only" ON public.balance_transactions;

-- Recreate: owner sees ALL their own transactions (no time window), admins see all
CREATE POLICY "balance_transactions_owner_only"
ON public.balance_transactions
FOR SELECT
TO authenticated
USING (
  provider_id = get_my_profile_id()
  OR is_admin()
);
