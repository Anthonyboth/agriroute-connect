-- Revoke all privileges for anon on admin_reports
REVOKE ALL ON public.admin_reports FROM anon;

-- Add explicit deny policy for anon
CREATE POLICY "Deny anon access to admin_reports"
ON public.admin_reports
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);
