
-- =================================================================
-- FIX: Restore EXECUTE permissions for authenticated role
-- The previous migration's dynamic loop didn't persist properly.
-- This explicitly grants all public functions to authenticated,
-- then revokes only the sensitive internal-only ones.
-- =================================================================

-- Step 1: Grant EXECUTE on ALL functions in public schema to authenticated
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Step 2: Revoke EXECUTE on sensitive internal-only functions
-- Decryption / encryption internals
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive_data(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive_data(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii_field(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_document(text, text) FROM authenticated;

-- Admin-only reporting
REVOKE EXECUTE ON FUNCTION public.generate_admin_report(text, date, date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_reports_dashboard(text, uuid, timestamptz, timestamptz, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.scan_policies_for_role_references() FROM authenticated;

-- Security detection (service_role only)
REVOKE EXECUTE ON FUNCTION public.detect_suspicious_access(text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.detect_suspicious_admin_activity(uuid, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_failed_login_attempts(timestamptz, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_multiple_ip_logins(timestamptz, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_unusual_hour_logins(timestamptz, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ip_blacklisted(inet) FROM authenticated;

-- Automation/cron (service_role only)
REVOKE EXECUTE ON FUNCTION public.auto_cancel_expired_service_requests() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_cancel_overdue_freights() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_deliveries() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_delivery_and_payments() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_payments_after_72h() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_pending_deliveries() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_unregistered_delivery() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_requests() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_match_debug_logs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_match_interactions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_error_logs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_location_history() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.clean_expired_zip_cache() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_telegram_queue() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_compliance_expiry_check() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_antifraud_rules(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_driver_locations() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_freight_location_history() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_livestock_compliance() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_expired_documents() FROM authenticated;

-- Fiscal internal
REVOKE EXECUTE ON FUNCTION public.confirm_emission_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_emission_credit(uuid) FROM authenticated;

-- Migration helpers (one-time use)
REVOKE EXECUTE ON FUNCTION public.migrate_freight_requests_to_freights() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.migrate_profile_to_encrypted(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fix_freight_status_for_partial_bookings() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fix_freight_statuses() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_service_request_city_id() FROM authenticated;

-- Ensure anon has no function access
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
