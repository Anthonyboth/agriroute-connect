
-- Fix: Re-grant EXECUTE to authenticated for ALL non-trigger SECURITY DEFINER functions
-- Then re-revoke only the internal/service_role-only ones

-- STEP 1: Grant all non-trigger SECURITY DEFINER functions to authenticated
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_get_functiondef(p.oid) NOT ILIKE '%RETURNS trigger%'
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO authenticated';
  END LOOP;
END $$;

-- STEP 2: Re-revoke from authenticated ONLY the truly internal/service_role functions
DO $$
DECLARE
  func_name TEXT;
  func_record RECORD;
  internal_funcs TEXT[] := ARRAY[
    -- Cron/automation (not user-callable)
    'auto_cancel_expired_service_requests',
    'auto_cancel_overdue_freights',
    'auto_confirm_deliveries',
    'auto_confirm_delivery_and_payments',
    'auto_confirm_payments_after_72h',
    'auto_confirm_pending_deliveries',
    'cleanup_expired_requests',
    'cleanup_match_debug_logs',
    'cleanup_match_interactions',
    'cleanup_old_error_logs',
    'cleanup_old_location_history',
    'clean_expired_zip_cache',
    'expire_livestock_compliance',
    'fix_freight_status_for_partial_bookings',
    'fix_freight_statuses',
    'migrate_freight_requests_to_freights',
    'migrate_profile_to_encrypted',
    'process_telegram_queue',
    'purge_expired_driver_locations',
    'run_compliance_expiry_check',
    'run_antifraud_rules',
    'validate_roles_post_migration',
    'scan_policies_for_role_references',
    'update_payment_deadline_status',
    -- Security monitoring (admin/service_role only)
    'detect_suspicious_access',
    'detect_suspicious_admin_activity',
    'get_failed_login_attempts',
    'get_multiple_ip_logins',
    'get_unusual_hour_logins',
    'check_expired_documents',
    'check_low_ratings',
    -- Admin reports
    'get_reports_dashboard',
    'get_platform_stats',
    'get_operation_report',
    'generate_admin_report',
    -- Encryption (service_role only)
    'encrypt_sensitive_data',
    'decrypt_sensitive_data',
    'encrypt_pii_field',
    'decrypt_pii_field',
    'encrypt_document',
    'decrypt_document',
    -- Internal fiscal
    'confirm_emission_credit',
    'release_emission_credit',
    -- Sensitive lookups
    'get_email_by_document',
    'is_ip_blacklisted',
    'check_admin_reset_rate_limit',
    'trigger_cte_polling',
    'trigger_mdfe_polling'
  ];
BEGIN
  FOREACH func_name IN ARRAY internal_funcs
  LOOP
    FOR func_record IN
      SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = func_name AND p.prosecdef = true
    LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || func_record.func_signature || ' FROM authenticated';
    END LOOP;
  END LOOP;
END $$;
