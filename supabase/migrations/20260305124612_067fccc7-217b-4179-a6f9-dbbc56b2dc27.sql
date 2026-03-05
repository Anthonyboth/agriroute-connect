
REVOKE ALL ON public.company_internal_messages FROM anon;

CREATE POLICY "Deny anon access to company_internal_messages"
ON public.company_internal_messages
AS RESTRICTIVE FOR ALL TO anon USING (false);
