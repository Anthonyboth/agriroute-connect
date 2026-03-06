
-- ============================================================================
-- HARDEN: process_freight_withdrawal - multi-truck safe + strict status block
-- 
-- FIXES:
-- 1. Multi-truck: decrement accepted_trucks and array_remove driver instead of resetting all
-- 2. Strict status: ONLY ACCEPTED/LOADING allowed (remove OPEN fallback - was a band-aid)
-- 3. Recalc: properly handle remaining drivers for multi-truck freights
-- 4. After LOADED: impossible to withdraw (only admin/support can cancel)
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
  v_required_trucks int;
  v_new_accepted int;
  v_new_drivers uuid[];
  v_remaining_active int;
BEGIN
  -- 1. Validate driver identity
  SELECT user_id INTO v_user_id
  FROM public.profiles WHERE id = p_driver_profile_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  -- 2. Find freight - check both driver_id and freight_assignments
  SELECT f.id, f.status, f.driver_id, f.pickup_date, f.company_id,
         f.required_trucks, f.accepted_trucks, f.drivers_assigned
  INTO freight_record
  FROM public.freights f
  WHERE f.id = freight_id_param
    AND (
      f.driver_id = p_driver_profile_id
      OR p_driver_profile_id = ANY(f.drivers_assigned)
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

  -- 3. STRICT status check: ONLY ACCEPTED or LOADING
  -- After LOADED/IN_TRANSIT/DELIVERED_PENDING_CONFIRMATION → MUST contact support
  IF freight_record.status NOT IN ('ACCEPTED', 'LOADING') THEN
    -- Give specific message for post-loading statuses
    IF freight_record.status IN ('LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION') THEN
      RETURN json_build_object('success', false, 'error', 'STATUS_REQUIRES_SUPPORT',
        'message', 'Após o carregamento, o cancelamento só pode ser feito pelo suporte/admin.');
    END IF;
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  -- 4. Check for check-ins (blocks withdrawal if driver already checked in)
  SELECT count(*) INTO checkin_count
  FROM public.driver_checkins
  WHERE freight_id = freight_id_param
    AND driver_profile_id = p_driver_profile_id;

  IF checkin_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  is_company_freight := freight_record.company_id IS NOT NULL;
  v_required_trucks := COALESCE(freight_record.required_trucks, 1);

  -- 5. Set skip flag to prevent recalc cascade
  PERFORM set_config('app.skip_recalc', 'true', true);

  -- 6. Cancel this driver's assignments and proposals
  UPDATE public.freight_assignments
  SET status = 'CANCELLED', updated_at = now()
  WHERE freight_id = freight_id_param
    AND driver_id = p_driver_profile_id
    AND status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED');

  UPDATE public.freight_proposals
  SET status = 'CANCELLED'
  WHERE freight_id = freight_id_param
    AND driver_id = p_driver_profile_id;

  DELETE FROM public.driver_trip_progress
  WHERE freight_id = freight_id_param
    AND driver_id = p_driver_profile_id;

  -- 7. Calculate new state based on remaining active assignments
  SELECT count(*) INTO v_remaining_active
  FROM public.freight_assignments
  WHERE freight_id = freight_id_param
    AND driver_id != p_driver_profile_id
    AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'DELIVERED');

  -- Build new drivers_assigned array (remove this driver)
  v_new_drivers := array_remove(COALESCE(freight_record.drivers_assigned, '{}'), p_driver_profile_id);
  v_new_accepted := GREATEST(0, COALESCE(freight_record.accepted_trucks, 1) - 1);

  -- 8. Update freight based on multi-truck vs single-truck
  IF v_required_trucks > 1 AND v_remaining_active > 0 THEN
    -- MULTI-TRUCK with remaining drivers: keep freight ACCEPTED, just decrement
    UPDATE public.freights
    SET accepted_trucks = v_new_accepted,
        drivers_assigned = v_new_drivers,
        -- If this was the main driver_id, set to another active driver
        driver_id = CASE 
          WHEN driver_id = p_driver_profile_id THEN v_new_drivers[1]
          ELSE driver_id
        END,
        -- Reopen for new drivers if not full
        status = CASE 
          WHEN v_new_accepted < v_required_trucks THEN 'OPEN'
          ELSE 'ACCEPTED'
        END,
        updated_at = now()
    WHERE id = freight_id_param;
  ELSE
    -- SINGLE-TRUCK or LAST driver withdrawing: revert to OPEN
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights
    SET status = 'OPEN',
        driver_id = NULL,
        accepted_trucks = v_new_accepted,
        drivers_assigned = v_new_drivers,
        is_full_booking = false,
        pickup_date = CASE WHEN is_company_freight THEN pickup_date ELSE safe_pickup_date END,
        updated_at = now()
    WHERE id = freight_id_param;
  END IF;

  -- 9. Clear skip flag
  PERFORM set_config('app.skip_recalc', '', true);

  -- 10. Notification
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (v_user_id, 'Desistência de Frete', 'Sua desistência do frete foi processada.',
    'warning', jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal'));

  RETURN json_build_object('success', true, 'message', 'DESISTENCIA_OK',
    'fee_amount', 20.00, 'fee_type', 'withdrawal', 'user_id', v_user_id,
    'remaining_drivers', v_remaining_active);
END;
$$;

-- Ensure proper access control
REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO service_role;
