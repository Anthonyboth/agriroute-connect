-- ============================================================================
-- FIX: process_freight_withdrawal - also check freight_assignments when driver_id is NULL
-- ROOT CAUSE: recalc trigger sometimes leaves driver_id=NULL even with active assignments
-- The RPC must handle this inconsistent state gracefully
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
  has_active_assignment boolean;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles WHERE id = p_driver_profile_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  -- ✅ FIX: Try driver_id match first, then fall back to freight_assignments
  SELECT f.id, f.status, f.driver_id, f.pickup_date, f.company_id
  INTO freight_record
  FROM public.freights f
  WHERE f.id = freight_id_param
    AND (
      f.driver_id = p_driver_profile_id
      OR EXISTS (
        SELECT 1 FROM public.freight_assignments fa
        WHERE fa.freight_id = f.id
          AND fa.driver_id = p_driver_profile_id
          AND fa.status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'DELIVERED')
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  -- ✅ FIX: Also allow withdrawal from OPEN status if driver has active assignment
  -- (handles inconsistent state where status=OPEN but assignment=ACCEPTED)
  SELECT EXISTS (
    SELECT 1 FROM public.freight_assignments fa
    WHERE fa.freight_id = freight_id_param
      AND fa.driver_id = p_driver_profile_id
      AND fa.status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'DELIVERED')
  ) INTO has_active_assignment;

  IF freight_record.status NOT IN ('ACCEPTED', 'LOADING', 'OPEN') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  -- If status is OPEN, only allow if there's an active assignment (inconsistent state)
  IF freight_record.status = 'OPEN' AND NOT has_active_assignment THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  SELECT count(*) INTO checkin_count
  FROM public.driver_checkins
  WHERE freight_id = freight_id_param
    AND driver_profile_id = p_driver_profile_id;

  IF checkin_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  is_company_freight := freight_record.company_id IS NOT NULL;

  -- ✅ Set skip flag to prevent recalc cascade loop
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

  -- Clear skip flag
  PERFORM set_config('app.skip_recalc', '', true);

  -- Notification
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (v_user_id, 'Desistência de Frete', 'Sua desistência do frete foi processada.',
    'warning', jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal'));

  RETURN json_build_object('success', true, 'message', 'DESISTENCIA_OK',
    'fee_amount', 20.00, 'fee_type', 'withdrawal', 'user_id', v_user_id);
END;
$$;

-- ✅ Also fix inconsistent freights globally: where driver_id is NULL but has active assignments
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT f.id, fa.driver_id as active_driver
    FROM freights f
    JOIN freight_assignments fa ON fa.freight_id = f.id
    WHERE f.driver_id IS NULL
      AND f.status IN ('OPEN', 'IN_NEGOTIATION')
      AND fa.status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'DELIVERED')
      AND f.required_trucks = 1
    GROUP BY f.id, fa.driver_id
    HAVING COUNT(*) = 1
  LOOP
    PERFORM set_config('app.skip_recalc', 'true', true);
    UPDATE freights
    SET driver_id = r.active_driver, status = 'ACCEPTED', accepted_trucks = 1, updated_at = now()
    WHERE id = r.id;
    PERFORM set_config('app.skip_recalc', '', true);
  END LOOP;
END $$;