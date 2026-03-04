-- Fix: Remove redundant 24h company location policy
-- driver_location_history_select_secure already handles company access
-- with a properly scoped 1h window using get_current_profile_id()
-- The 24h policy is overly permissive and uses auth.uid() incorrectly

DROP POLICY IF EXISTS "dlh_select_company_active_freight_24h" ON public.driver_location_history;