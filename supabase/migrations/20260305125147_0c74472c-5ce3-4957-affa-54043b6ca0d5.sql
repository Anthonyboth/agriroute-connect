
REVOKE ALL ON public.document_requests FROM anon;

CREATE POLICY "Deny anon access to document_requests"
ON public.document_requests
AS RESTRICTIVE FOR ALL TO anon USING (false);
