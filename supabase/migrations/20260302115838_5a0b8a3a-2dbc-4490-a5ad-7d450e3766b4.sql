
-- Fix: Revoke from PUBLIC (which includes anon and authenticated)
-- Then re-grant to authenticated for user-facing functions

-- STEP 1: Revoke EXECUTE from PUBLIC on ALL SECURITY DEFINER functions
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT p.oid, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || func_record.func_signature || ' FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION ' || func_record.func_signature || ' FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION ' || func_record.func_signature || ' FROM authenticated';
    -- Always grant to service_role
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO service_role';
  END LOOP;
END $$;

-- STEP 2: Re-grant EXECUTE to authenticated for user-facing functions only
DO $$
DECLARE
  func_name TEXT;
  func_record RECORD;
  user_facing_funcs TEXT[] := ARRAY[
    -- Profile/identity helpers (used in RLS policies)
    'current_profile_id',
    'is_profile_owner',
    'can_view_profile',
    'get_user_roles',
    'has_any_role',
    'is_transport_company',
    'is_affiliated_driver',
    'is_company_driver',
    'is_antifraud_viewer',
    'is_service_role',
    
    -- Freight participant checks (used in RLS)
    'is_freight_owner',
    'is_freight_participant',
    'is_freight_participant_for_rating',
    'is_freight_payment_confirmed',
    'can_view_vehicle_via_freight',
    'is_service_participant',
    'is_service_compatible',
    
    -- Company checks (used in RLS)
    'can_manage_company',
    'can_view_company',
    'find_company_by_cnpj',
    'generate_invite_code',
    
    -- Driver/freight user operations
    'process_freight_withdrawal',
    'process_payout_request',
    'cancel_freight_optimized',
    'reserve_emission_credit',
    'accept_service_proposal',
    'reject_service_proposal',
    'cancel_accepted_service',
    'cancel_producer_service_request',
    
    -- Data access (user-facing queries)
    'get_compatible_freights_for_driver',
    'get_compatible_freights_for_driver_v2',
    'get_compatible_service_requests_for_provider',
    'get_freights_for_driver',
    'get_freights_in_city',
    'get_freights_in_radius',
    'get_freights_in_provider_region',
    'get_nearby_freights_for_driver',
    'get_provider_service_requests',
    'get_provider_services_by_city',
    'get_public_service_requests',
    'get_public_stats',
    'get_scheduled_freights_by_location_and_date',
    'get_service_requests_by_city',
    'get_service_requests_for_provider_cities',
    'get_service_requests_in_provider_region',
    'get_service_requests_in_radius',
    'get_services_in_city',
    'get_users_in_city',
    'get_pending_ratings_with_affiliation',
    'get_user_rating_distribution',
    'get_user_rating_stats',
    'get_participant_freight_count',
    
    -- Matching functions
    'execute_freight_matching',
    'execute_service_matching',
    'execute_service_matching_with_user_cities',
    'find_drivers_by_origin',
    'find_drivers_by_route',
    'find_providers_by_location',
    'find_providers_by_service_and_location',
    'match_drivers_to_freight',
    'match_providers_to_service',
    
    -- Utility/calculation
    'calculate_distance_km',
    'calculate_eta_minutes',
    'calculate_freight_eta',
    'can_notify_driver',
    'can_notify_provider',
    'check_driver_availability',
    'check_mutual_ratings_complete',
    'check_rate_limit',
    'check_error_report_rate_limit',
    'check_guest_validation_rate_limit',
    'cities_needing_geocoding',
    'auto_insert_city',
    'forum_is_banned',
    'is_trusted_entity',
    'check_advance_payment_requirement',
    'check_document_role_limit',
    'check_interstate_transit_rules',
    'check_livestock_compliance',
    'get_item_expiration_info',
    'get_fiscalizacao_data',
    
    -- Location
    'insert_driver_location_history',
    'log_trip_progress_event',
    'can_driver_update_freight_location',
    'detect_eta_worsening',
    'detect_freight_delay_alerts',
    
    -- Rating
    'mark_history_rating_completed',
    'save_freight_completion_snapshot',
    
    -- Antifraud (read)
    'calculate_freight_antifraud_score',
    'calculate_freight_risk_score',
    
    -- Notification throttle
    'log_inspection_access',
    
    -- Unified feed
    'get_unified_service_feed',
    
    -- Block compliance
    'block_freight_on_compliance_issue',
    'block_in_transit_without_sanitary_compliance'
  ];
BEGIN
  FOREACH func_name IN ARRAY user_facing_funcs
  LOOP
    FOR func_record IN
      SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = func_name AND p.prosecdef = true
    LOOP
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO authenticated';
    END LOOP;
  END LOOP;
END $$;

-- STEP 3: Grant specific functions to anon (only truly public ones)
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon;
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname IN ('check_rate_limit', 'check_guest_validation_rate_limit', 'check_error_report_rate_limit') AND p.prosecdef = true
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO anon';
  END LOOP;
END $$;
