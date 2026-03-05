
REVOKE ALL ON public.service_provider_balances FROM anon;

ALTER TABLE public.service_provider_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to service_provider_balances"
ON public.service_provider_balances
AS RESTRICTIVE FOR ALL TO anon USING (false);

CREATE POLICY "Providers view own balance"
ON public.service_provider_balances
FOR SELECT TO authenticated
USING (provider_id = get_my_profile_id());

CREATE POLICY "Providers update own balance"
ON public.service_provider_balances
FOR UPDATE TO authenticated
USING (provider_id = get_my_profile_id());
