-- Fix: api_rate_limits publicly readable (tracking risk)
-- Strategy: tighten RLS + privileges so only (a) authenticated user for own rows, (b) admins, and (c) service_role can access.

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Remove overly broad policies
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.api_rate_limits;
DROP POLICY IF EXISTS api_rate_limits_owner_select ON public.api_rate_limits;
DROP POLICY IF EXISTS api_rate_limits_service_manage ON public.api_rate_limits;

-- Authenticated users: only their own rows (no user_id IS NULL exposure)
CREATE POLICY "Users can view their own rate limits"
ON public.api_rate_limits
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins: can view all rows (including user_id IS NULL)
CREATE POLICY "Admins can view all rate limits"
ON public.api_rate_limits
FOR SELECT
TO authenticated
USING (is_admin());

-- Backend/service: can manage (insert/update/delete) rate limit rows
CREATE POLICY "Service role can manage rate limits"
ON public.api_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Tighten table privileges (defense-in-depth)
REVOKE ALL ON public.api_rate_limits FROM anon;
REVOKE ALL ON public.api_rate_limits FROM authenticated;

GRANT SELECT ON public.api_rate_limits TO authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
