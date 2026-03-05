REVOKE ALL ON public.fiscal_wallet_transactions FROM anon;

CREATE POLICY "Deny anon access to fiscal_wallet_transactions"
ON public.fiscal_wallet_transactions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Fix existing policy: change from 'public' to 'authenticated'
DROP POLICY IF EXISTS "Users view own transactions" ON public.fiscal_wallet_transactions;

CREATE POLICY "Users view own wallet transactions"
ON public.fiscal_wallet_transactions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM fiscal_wallet fw
  JOIN profiles p ON p.id = fw.profile_id
  WHERE fw.id = fiscal_wallet_transactions.wallet_id
  AND p.user_id = auth.uid()
));
