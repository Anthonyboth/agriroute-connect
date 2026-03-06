-- ============================================================================
-- DEFINITIVE FIX: Use session variable to skip recalc during withdrawal
-- The cascade chain is: assignment update → recalc → freight update → 
-- freight triggers → cascade back to recalc, causing status flip-flop
-- ============================================================================

-- FIX recalc to respect skip signal from withdrawal RPC
CREATE OR REPLACE FUNCTION recalc_freight_accepted_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_freight_id UUID;
  actual_count INTEGER;
  required_count INTEGER;
  current_status freight_status;
  unique_drivers UUID[];
  new_status freight_status;
BEGIN
  -- ✅ Skip if withdrawal RPC set the skip flag (prevents cascade loops)
  IF current_setting('app.skip_recalc', true) = 'true' THEN
    RAISE LOG 'recalc_freight_accepted_trucks: SKIPPED (app.skip_recalc=true)';
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_freight_id := OLD.freight_id;
  ELSE
    target_freight_id := NEW.freight_id;
  END IF;

  SELECT COUNT(*), array_agg(DISTINCT driver_id)
  INTO actual_count, unique_drivers
  FROM freight_assignments
  WHERE freight_id = target_freight_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  SELECT required_trucks, status
  INTO required_count, current_status
  FROM freights
  WHERE id = target_freight_id;

  new_status := current_status;

  IF current_status IN (
    'LOADING', 'LOADED', 'IN_TRANSIT',
    'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 
    'CANCELLED', 'COMPLETED'
  ) THEN
    new_status := current_status;
  ELSIF COALESCE(actual_count, 0) = 0 THEN
    IF current_status IN ('ACCEPTED', 'OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;
  ELSIF COALESCE(actual_count, 0) >= COALESCE(required_count, 1) THEN
    new_status := 'ACCEPTED'::freight_status;
  ELSIF COALESCE(actual_count, 0) > 0 AND COALESCE(actual_count, 0) < COALESCE(required_count, 1) THEN
    IF current_status NOT IN ('OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;
  END IF;

  UPDATE freights
  SET 
    accepted_trucks = COALESCE(actual_count, 0),
    drivers_assigned = COALESCE(unique_drivers, ARRAY[]::UUID[]),
    is_full_booking = (COALESCE(actual_count, 0) >= COALESCE(required_count, 1)),
    status = new_status,
    driver_id = CASE
      WHEN COALESCE(actual_count, 0) = 0 THEN NULL
      WHEN COALESCE(required_count, 1) = 1 AND array_length(unique_drivers, 1) = 1 THEN unique_drivers[1]
      WHEN COALESCE(required_count, 1) > 1 THEN NULL
      ELSE driver_id
    END,
    updated_at = now()
  WHERE id = target_freight_id;

  RAISE LOG 'recalc_freight_accepted_trucks: freight_id=%, actual=%, required=%, old_status=%, new_status=%',
    target_freight_id, actual_count, required_count, current_status, new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- FIX process_freight_withdrawal to set skip flag and do atomic cleanup
CREATE OR REPLACE FUNCTION process_freight_withdrawal(
  freight_id_param UUID,
  p_driver_profile_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freight_record RECORD;
  checkin_count int;
  safe_pickup_date timestamptz;
  is_company_freight boolean;
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles WHERE id = p_driver_profile_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  SELECT f.id, f.status, f.driver_id, f.pickup_date, f.company_id
  INTO freight_record
  FROM public.freights f
  WHERE f.id = freight_id_param
    AND f.driver_id = p_driver_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  IF freight_record.status NOT IN ('ACCEPTED', 'LOADING') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT count(*) INTO checkin_count
  FROM public.driver_checkins
  WHERE freight_id = freight_id_param
    AND driver_profile_id = p_driver_profile_id;

  IF checkin_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  is_company_freight := freight_record.company_id IS NOT NULL;

  -- ✅ CRITICAL: Set skip flag to prevent recalc cascade loop
  PERFORM set_config('app.skip_recalc', 'true', true);

  -- Cancel assignments
  UPDATE public.freight_assignments
  SET status = 'CANCELLED', updated_at = now()
  WHERE freight_id = freight_id_param
    AND driver_id = p_driver_profile_id
    AND status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED');

  -- Cancel proposals
  UPDATE public.freight_proposals
  SET status = 'CANCELLED'
  WHERE freight_id = freight_id_param
    AND driver_id = p_driver_profile_id;

  -- Delete trip progress
  DELETE FROM public.driver_trip_progress
  WHERE freight_id = freight_id_param
    AND driver_id = p_driver_profile_id;

  -- Update freight directly (no cascade interference)
  IF is_company_freight THEN
    UPDATE public.freights
    SET status = 'OPEN', driver_id = NULL, accepted_trucks = 0,
        drivers_assigned = '{}', is_full_booking = false, updated_at = now()
    WHERE id = freight_id_param;
  ELSE
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights
    SET status = 'OPEN', driver_id = NULL, pickup_date = safe_pickup_date,
        accepted_trucks = 0, drivers_assigned = '{}', is_full_booking = false, updated_at = now()
    WHERE id = freight_id_param;
  END IF;

  -- ✅ Clear skip flag
  PERFORM set_config('app.skip_recalc', '', true);

  -- Notification
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (v_user_id, 'Desistência de Frete', 'Sua desistência do frete foi processada.',
    'warning', jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal'));

  RETURN json_build_object('success', true, 'message', 'DESISTENCIA_OK',
    'fee_amount', 20.00, 'fee_type', 'withdrawal', 'user_id', v_user_id);
END;
$$;


-- ✅ Cleanup: fix the inconsistent freight using the skip flag
DO $$
BEGIN
  PERFORM set_config('app.skip_recalc', 'true', true);
  
  UPDATE public.freight_assignments 
  SET status = 'CANCELLED', updated_at = now() 
  WHERE freight_id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06' 
  AND driver_id = 'a22b811e-9ff1-435e-97bf-8d35c079d7ab'
  AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'DELIVERED');

  UPDATE public.freights
  SET status = 'OPEN', driver_id = NULL, accepted_trucks = 0,
      drivers_assigned = '{}', is_full_booking = false, updated_at = now()
  WHERE id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06';

  DELETE FROM public.driver_trip_progress
  WHERE freight_id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06'
  AND driver_id = 'a22b811e-9ff1-435e-97bf-8d35c079d7ab';

  PERFORM set_config('app.skip_recalc', '', true);
END $$;