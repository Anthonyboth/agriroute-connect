
-- ==========================================
-- SECURITY HARDENING: Fix ALL findings
-- ==========================================

-- ============ 1. BALANCE_TRANSACTIONS ============
-- Remove duplicate SELECT policies (keep only the most comprehensive one)
DROP POLICY IF EXISTS "Prestadores podem ver suas próprias transações" ON balance_transactions;
DROP POLICY IF EXISTS "balance_transactions_owner_select" ON balance_transactions;
-- Remaining: balance_transactions_owner_only (owner OR admin) + Admins podem ver todas as transações

-- Add anon deny to block anonymous access
CREATE POLICY "balance_transactions_deny_anon" ON balance_transactions
  FOR ALL TO anon USING (false);

-- ============ 2. FREIGHT_PAYMENTS ============
-- Add anon deny
CREATE POLICY "freight_payments_deny_anon" ON freight_payments
  FOR ALL TO anon USING (false);

-- ============ 3. FISCAL_CERTIFICATES ============
-- Add anon deny
CREATE POLICY "fiscal_certificates_deny_anon" ON fiscal_certificates
  FOR ALL TO anon USING (false);

-- ============ 4. DRIVER_LOCATION_HISTORY ============
-- Add anon deny
CREATE POLICY "driver_location_deny_anon" ON driver_location_history
  FOR ALL TO anon USING (false);

-- Remove overly permissive INSERT on {public} role
DROP POLICY IF EXISTS "driver_location_insert_restricted" ON driver_location_history;

-- ============ 5. VEHICLES ============
-- Add anon deny
CREATE POLICY "vehicles_deny_anon" ON vehicles
  FOR ALL TO anon USING (false);

-- ============ 6. PROSPECT_USERS ============
-- Fix policies from {public} to {authenticated} role
DROP POLICY IF EXISTS "prospect_users_admin_select" ON prospect_users;
CREATE POLICY "prospect_users_admin_select" ON prospect_users
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "prospect_users_service_update" ON prospect_users;
CREATE POLICY "prospect_users_service_update" ON prospect_users
  FOR UPDATE TO authenticated
  USING (is_admin());

-- Block anon from reading/updating/deleting prospect data
CREATE POLICY "prospect_users_deny_anon_read" ON prospect_users
  FOR SELECT TO anon USING (false);
CREATE POLICY "prospect_users_deny_anon_update" ON prospect_users
  FOR UPDATE TO anon USING (false);  
CREATE POLICY "prospect_users_deny_anon_delete" ON prospect_users
  FOR DELETE TO anon USING (false);

-- ============ 7. SERVICE_REQUESTS ============
-- Fix p0_clients_view_own_service_requests from {public} to {authenticated}
DROP POLICY IF EXISTS "p0_clients_view_own_service_requests" ON service_requests;

-- Remove duplicate SELECT policies (keeping comprehensive ones)
DROP POLICY IF EXISTS "clients_view_own_requests" ON service_requests;
DROP POLICY IF EXISTS "clients_view_own_service_requests" ON service_requests;
DROP POLICY IF EXISTS "admin_view_all_service_requests" ON service_requests;
DROP POLICY IF EXISTS "users_view_own_accepted_services" ON service_requests;

-- Remaining SELECT policies cover all cases:
-- "Users can view own requests and providers view assigned" (client OR provider OR admin)
-- "Admins can view all service requests" (admin)
-- "Drivers can view their accepted transport requests" (transport-type drivers)
-- "Prestadores podem ver solicitações atribuídas" (assigned providers)
-- "final_clients_view_service_requests" (client OR admin)
-- "final_providers_view_service_requests" (providers via service_providers table OR admin)

-- ============ 8. AUTO-PURGE EXPIRED DRIVER LOCATIONS ============
CREATE OR REPLACE FUNCTION public.purge_expired_driver_locations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM driver_location_history
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Revoke public access to the purge function
REVOKE ALL ON FUNCTION public.purge_expired_driver_locations() FROM public;
GRANT EXECUTE ON FUNCTION public.purge_expired_driver_locations() TO service_role;
