-- Revoke anon access
REVOKE ALL ON public.financial_transactions FROM anon;

-- Deny anon explicitly
CREATE POLICY "Deny anon access to financial_transactions"
ON public.financial_transactions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Drop policies that target 'public' role (allows anon)
DROP POLICY IF EXISTS "Companies can insert own transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Companies can update own transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Companies can view own transactions" ON public.financial_transactions;
