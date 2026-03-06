-- ============================================================================
-- FIX 1: recalc_freight_accepted_trucks - handle 0 active assignments properly
-- ROOT CAUSE: When no active assignments exist for an ACCEPTED freight,
-- the trigger was keeping status as ACCEPTED instead of reverting to OPEN.
-- ============================================================================
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
  -- Determine which freight_id to process
  IF TG_OP = 'DELETE' THEN
    target_freight_id := OLD.freight_id;
  ELSE
    target_freight_id := NEW.freight_id;
  END IF;

  -- Count accepted assignments (not cancelled/rejected)
  SELECT COUNT(*), array_agg(DISTINCT driver_id)
  INTO actual_count, unique_drivers
  FROM freight_assignments
  WHERE freight_id = target_freight_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  -- Fetch freight data
  SELECT required_trucks, status
  INTO required_count, current_status
  FROM freights
  WHERE id = target_freight_id;

  -- Determine new status based on actual counts
  new_status := current_status; -- default: keep current status

  -- ✅ Skip if freight is in a terminal or active-progress status
  IF current_status IN (
    'LOADING', 'LOADED', 'IN_TRANSIT',
    'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 
    'CANCELLED', 'COMPLETED'
  ) THEN
    new_status := current_status;

  -- ✅ FIX: NO ACTIVE ASSIGNMENTS → revert to OPEN (clears ACCEPTED state)
  ELSIF COALESCE(actual_count, 0) = 0 THEN
    IF current_status IN ('ACCEPTED', 'OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;

  -- FULLY BOOKED: all trucks assigned -> ACCEPTED
  ELSIF COALESCE(actual_count, 0) >= COALESCE(required_count, 1) THEN
    new_status := 'ACCEPTED'::freight_status;

  -- PARTIALLY FILLED: some trucks assigned but not all -> keep as OPEN
  ELSIF COALESCE(actual_count, 0) > 0 AND COALESCE(actual_count, 0) < COALESCE(required_count, 1) THEN
    IF current_status NOT IN ('OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;
  END IF;

  -- Update freight with corrected values
  UPDATE freights
  SET 
    accepted_trucks = COALESCE(actual_count, 0),
    drivers_assigned = COALESCE(unique_drivers, ARRAY[]::UUID[]),
    is_full_booking = (COALESCE(actual_count, 0) >= COALESCE(required_count, 1)),
    status = new_status,
    driver_id = CASE
      -- ✅ FIX: Explicitly clear driver_id when no active assignments
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


-- ============================================================================
-- FIX 2: process_freight_withdrawal - cancel assignment FIRST, then update freight
-- This ensures recalc sees 0 active assignments when the freight update cascades
-- ============================================================================
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
  -- Get user_id for notifications
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE id = p_driver_profile_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  -- Lock the freight row
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

  -- Check for existing check-ins
  SELECT count(*) INTO checkin_count
  FROM public.driver_checkins
  WHERE freight_id = freight_id_param
    AND driver_profile_id = p_driver_profile_id;

  IF checkin_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  is_company_freight := freight_record.company_id IS NOT NULL;

  -- ✅ FIX: Cancel assignments FIRST so recalc_freight_accepted_trucks sees 0 active
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

  -- ✅ NOW update the freight (recalc already ran and set status=OPEN, driver_id=NULL)
  -- This update ensures the pickup_date is corrected if needed
  IF is_company_freight THEN
    UPDATE public.freights
    SET status = 'OPEN', driver_id = NULL, updated_at = now()
    WHERE id = freight_id_param;
  ELSE
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights
    SET status = 'OPEN', driver_id = NULL, pickup_date = safe_pickup_date, updated_at = now()
    WHERE id = freight_id_param;
  END IF;

  -- Send notification
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    v_user_id,
    'Desistência de Frete',
    'Sua desistência do frete foi processada.',
    'warning',
    jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal')
  );

  RETURN json_build_object(
    'success', true,
    'message', 'DESISTENCIA_OK',
    'fee_amount', 20.00,
    'fee_type', 'withdrawal',
    'user_id', v_user_id
  );
END;
$$;


-- ============================================================================
-- FIX 3: Clean up the currently inconsistent freight
-- ============================================================================
UPDATE public.freights
SET status = 'OPEN', driver_id = NULL, accepted_trucks = 0, drivers_assigned = '{}', updated_at = now()
WHERE id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06'
  AND status = 'ACCEPTED'
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments 
    WHERE freight_id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06' 
    AND status NOT IN ('CANCELLED', 'REJECTED')
  );