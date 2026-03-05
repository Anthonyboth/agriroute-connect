-- Revoke all privileges for anon on admin_settings
REVOKE ALL ON public.admin_settings FROM anon;

-- Add explicit deny policy for anon
CREATE POLICY "Deny anon access to admin_settings"
ON public.admin_settings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);
