
-- Add explicit RESTRICTIVE deny for anon on driver_stripe_accounts (defense in depth)
CREATE POLICY "driver_stripe_deny_anon"
ON public.driver_stripe_accounts
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
