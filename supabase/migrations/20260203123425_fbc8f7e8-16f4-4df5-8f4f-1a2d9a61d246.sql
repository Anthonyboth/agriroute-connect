-- =====================================================
-- Fix: Supabase linter "RLS Policy Always True" (warn)
-- Replace constant-true USING/WITH CHECK expressions with explicit
-- role checks + tighten overly-broad PUBLIC policies.
-- =====================================================

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_access_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- api_rate_limits: avoid USING/WITH CHECK (true)
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.api_rate_limits;
CREATE POLICY "Service role can manage rate limits"
ON public.api_rate_limits
AS PERMISSIVE
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- -----------------------------------------------------
-- driver_location_history: avoid WITH CHECK (true)
-- -----------------------------------------------------
DROP POLICY IF EXISTS driver_location_history_insert_service_role ON public.driver_location_history;
CREATE POLICY driver_location_history_insert_service_role
ON public.driver_location_history
AS PERMISSIVE
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- -----------------------------------------------------
-- inspection_access_logs: avoid WITH CHECK (true)
-- -----------------------------------------------------
DROP POLICY IF EXISTS inspection_access_logs_service_role_insert ON public.inspection_access_logs;
CREATE POLICY inspection_access_logs_service_role_insert
ON public.inspection_access_logs
AS PERMISSIVE
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

-- -----------------------------------------------------
-- edge_function_health: CRITICAL tighten
-- Previously: a FOR ALL policy TO PUBLIC with USING(true)/WITH CHECK(true)
-- which allowed any user to INSERT/UPDATE/DELETE.
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Service role full access" ON public.edge_function_health;

-- Admins can read health status (no public write access)
DROP POLICY IF EXISTS "Admins can view health" ON public.edge_function_health;
CREATE POLICY "Admins can view health"
ON public.edge_function_health
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (is_admin());

-- Service role can manage health records (non-constant condition)
DROP POLICY IF EXISTS "Service role can manage health" ON public.edge_function_health;
CREATE POLICY "Service role can manage health"
ON public.edge_function_health
AS PERMISSIVE
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
