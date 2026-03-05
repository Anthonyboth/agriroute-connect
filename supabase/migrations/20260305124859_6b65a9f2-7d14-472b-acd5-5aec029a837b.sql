
REVOKE ALL ON public.company_invites FROM anon;

CREATE POLICY "Deny anon access to company_invites"
ON public.company_invites
AS RESTRICTIVE FOR ALL TO anon USING (false);
