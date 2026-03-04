-- Hardening: Deny DELETE on fiscal_certificates for all users (certificates should never be deleted by users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'fiscal_certificates' 
    AND policyname = 'fiscal_certificates_deny_delete'
  ) THEN
    CREATE POLICY "fiscal_certificates_deny_delete"
    ON public.fiscal_certificates
    FOR DELETE
    TO authenticated
    USING (false);
  END IF;
END $$;

-- Revoke all privileges from anon on fiscal_certificates
REVOKE ALL ON public.fiscal_certificates FROM anon;

-- Revoke direct SELECT from anon on the secure view too
REVOKE ALL ON public.fiscal_certificates_secure FROM anon;
