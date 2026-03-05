REVOKE ALL ON public.fiscal_wallet FROM anon;

CREATE POLICY "Deny anon access to fiscal_wallet"
ON public.fiscal_wallet
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);
