
-- ============================================================
-- SECURITY AUDIT: Harden SECURITY DEFINER functions
-- 1. Revoke EXECUTE from anon on ALL public SECURITY DEFINER functions
-- 2. Add auth.uid() checks to critical financial functions
-- 3. Restrict cron/internal functions to service_role only
-- ============================================================

-- STEP 1: Revoke EXECUTE from anon on ALL SECURITY DEFINER functions in public schema
-- This prevents unauthenticated users from calling any privileged function
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
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || func_record.func_signature || ' FROM anon';
  END LOOP;
END $$;

-- STEP 2: Restrict internal/cron/automation functions to service_role only
-- These should NEVER be called by end users
DO $$
DECLARE
  func_name TEXT;
  func_record RECORD;
BEGIN
  FOR func_name IN 
    SELECT unnest(ARRAY[
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
      'detect_suspicious_access',
      'detect_suspicious_admin_activity',
      'get_failed_login_attempts',
      'get_multiple_ip_logins',
      'get_unusual_hour_logins',
      'check_expired_documents',
      'check_low_ratings',
      'get_reports_dashboard',
      'get_platform_stats',
      'get_operation_report',
      'get_compliance_kpis',
      'trigger_cte_polling',
      'trigger_mdfe_polling',
      'backfill_service_request_city_id'
    ])
  LOOP
    FOR func_record IN
      SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = func_name AND p.prosecdef = true
    LOOP
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || func_record.func_signature || ' FROM authenticated';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO service_role';
    END LOOP;
  END LOOP;
END $$;

-- STEP 3: Harden process_payout_request with auth.uid() validation
CREATE OR REPLACE FUNCTION public.process_payout_request(provider_id_param uuid, amount_param numeric, pix_key_param text, description_param text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC := 0;
  payout_record RECORD;
  v_caller_id UUID;
  v_caller_profile_id UUID;
BEGIN
  -- SECURITY: Verify caller identity
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  -- SECURITY: Verify caller owns this provider profile
  SELECT id INTO v_caller_profile_id
  FROM public.profiles
  WHERE user_id = v_caller_id AND id = provider_id_param;
  
  IF v_caller_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Verificar saldo disponível
  SELECT available_balance INTO current_balance
  FROM public.service_provider_balances
  WHERE provider_id = provider_id_param;

  IF current_balance IS NULL THEN
    INSERT INTO public.service_provider_balances (
      provider_id, available_balance, total_earned
    ) VALUES (provider_id_param, 0, 0);
    current_balance := 0;
  END IF;

  IF current_balance < amount_param THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Saldo insuficiente',
      'available_balance', current_balance
    );
  END IF;

  INSERT INTO public.balance_transactions (
    provider_id, transaction_type, amount, balance_before, balance_after,
    reference_type, status, description, metadata
  ) VALUES (
    provider_id_param, 'PAYOUT', amount_param, current_balance,
    current_balance - amount_param, 'PAYOUT_REQUEST', 'PENDING',
    COALESCE(description_param, 'Solicitação de saque via PIX'),
    jsonb_build_object('pix_key', pix_key_param, 'requested_at', now())
  ) RETURNING * INTO payout_record;

  UPDATE public.service_provider_balances
  SET available_balance = available_balance - amount_param, updated_at = now()
  WHERE provider_id = provider_id_param;

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', payout_record.id,
    'new_balance', current_balance - amount_param
  );
END;
$function$;

-- STEP 4: Harden process_freight_withdrawal with auth.uid() validation
CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param uuid, driver_profile_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  freight_record RECORD;
  has_checkins BOOLEAN;
  safe_pickup_date TIMESTAMP WITH TIME ZONE;
  v_caller_id UUID;
  v_caller_profile_id UUID;
BEGIN
  -- SECURITY: Verify caller identity
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- SECURITY: Verify caller owns this driver profile
  SELECT id INTO v_caller_profile_id
  FROM public.profiles
  WHERE user_id = v_caller_id AND id = driver_profile_id;
  
  IF v_caller_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  -- Ensure freight exists and belongs to the driver
  SELECT id, status, driver_id, pickup_date INTO freight_record
  FROM public.freights
  WHERE id = freight_id_param;
  
  IF NOT FOUND OR freight_record.driver_id IS DISTINCT FROM driver_profile_id THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  IF freight_record.status NOT IN ('ACCEPTED','LOADING') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.freight_checkins
    WHERE freight_id = freight_id_param AND user_id = driver_profile_id
  ) INTO has_checkins;
  
  IF has_checkins THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
    safe_pickup_date := now() + interval '48 hours';
  ELSE
    safe_pickup_date := freight_record.pickup_date;
  END IF;

  UPDATE public.freights 
  SET status = 'OPEN'::freight_status, driver_id = NULL,
    pickup_date = safe_pickup_date, updated_at = now()
  WHERE id = freight_id_param AND driver_id = driver_profile_id;

  UPDATE public.freight_proposals 
  SET status = 'CANCELLED', updated_at = now()
  WHERE freight_id = freight_id_param AND driver_id = driver_profile_id;

  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    (SELECT user_id FROM public.profiles WHERE id = driver_profile_id),
    'Taxa de Desistência',
    'Foi aplicada uma taxa de R$ 20,00 pela desistência do frete.',
    'warning',
    jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal')
  );

  RETURN json_build_object(
    'success', true, 'message', 'DESISTENCIA_OK',
    'adjusted_pickup_date', safe_pickup_date > freight_record.pickup_date
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- STEP 5: Harden emission credit functions (only service_role or owner)
CREATE OR REPLACE FUNCTION public.reserve_emission_credit(p_issuer_id uuid, p_emission_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id UUID;
  v_available NUMERIC;
  v_emission_cost NUMERIC := 1;
  v_caller_id UUID;
BEGIN
  -- SECURITY: Verify caller is authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- SECURITY: Verify caller owns the issuer
  IF NOT EXISTS (
    SELECT 1 FROM public.fiscal_issuers fi
    JOIN public.profiles p ON p.id = fi.owner_id
    WHERE fi.id = p_issuer_id AND p.user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao emissor';
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_available
  FROM fiscal_wallet WHERE issuer_id = p_issuer_id FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Carteira fiscal não encontrada para emissor %', p_issuer_id;
  END IF;
  
  IF v_available < v_emission_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Necessário: %', v_available, v_emission_cost;
  END IF;
  
  UPDATE fiscal_wallet SET 
    available_balance = available_balance - v_emission_cost,
    reserved_balance = reserved_balance + v_emission_cost,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  INSERT INTO fiscal_wallet_transactions (
    wallet_id, transaction_type, amount, description, 
    reference_type, reference_id, status, created_at
  ) VALUES (
    v_wallet_id, 'reserve', v_emission_cost, 'Reserva para emissão fiscal',
    'emission', p_emission_id, 'completed', NOW()
  );
  
  RETURN TRUE;
END;
$function$;

-- confirm_emission_credit and release_emission_credit are called by edge functions (service_role)
-- Restrict them to service_role only
REVOKE EXECUTE ON FUNCTION public.confirm_emission_credit(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_emission_credit(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_emission_credit(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_emission_credit(uuid) TO service_role;

-- STEP 6: Restrict encryption/decryption functions to service_role only
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
    AND p.proname IN ('encrypt_sensitive_data', 'decrypt_sensitive_data', 'encrypt_pii_field', 'decrypt_pii_field', 'encrypt_document')
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || func_record.func_signature || ' FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO service_role';
  END LOOP;
END $$;

-- STEP 7: Restrict sensitive lookup functions
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
    AND p.proname IN ('get_email_by_document', 'is_ip_blacklisted', 'check_admin_reset_rate_limit')
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || func_record.func_signature || ' FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_record.func_signature || ' TO service_role';
  END LOOP;
END $$;
