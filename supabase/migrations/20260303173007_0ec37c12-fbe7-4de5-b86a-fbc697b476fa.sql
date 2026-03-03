-- ============================================================
-- Revoke direct SELECT on driver_stripe_accounts base table
-- for authenticated users. All client reads go through
-- driver_stripe_accounts_secure view. Edge functions use
-- service_role which bypasses RLS and column grants.
-- ============================================================

-- Remove the permissive SELECT policy for own data
-- (forces client to use the secure view instead)
DROP POLICY IF EXISTS "driver_stripe_select_own_only" ON public.driver_stripe_accounts;

-- Revoke column-level SELECT from authenticated on sensitive columns
-- Keep only driver_id readable so the secure view can still function
REVOKE SELECT ON public.driver_stripe_accounts FROM authenticated;

-- Re-grant SELECT only on non-sensitive columns needed for basic checks
GRANT SELECT (id, driver_id, account_status, created_at, updated_at) ON public.driver_stripe_accounts TO authenticated;

-- The existing policies remain:
-- - driver_stripe_deny_anon (RESTRICTIVE, blocks anon)
-- - driver_stripe_accounts_service_manage (service_role full access)
-- - driver_stripe_insert_own_only (drivers can create their own record)
-- - driver_stripe_update_own_only (drivers can update their own record)
