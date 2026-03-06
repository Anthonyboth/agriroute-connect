-- ============================================================================
-- FIX: process_freight_withdrawal must clear accepted_trucks and drivers_assigned
-- BUG #012: Freight showed OPEN but with stale accepted_trucks=1 and drivers_assigned
-- filled, causing UI to treat it as "fully booked" / not available.
-- ============================================================================

-- FIX 1: Clean up currently inconsistent freights
UPDATE public.freights
SET accepted_trucks = 0, drivers_assigned = '{}', updated_at = now()
WHERE status = 'OPEN' AND driver_id IS NULL
  AND (accepted_trucks > 0 OR array_length(drivers_assigned, 1) > 0)
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments 
    WHERE freight_id = freights.id 
    AND status NOT IN ('CANCELLED', 'REJECTED', 'WITHDRAWN')
  );

-- FIX 2: Recreate the withdrawal RPC with proper cleanup of all fields
CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param UUID, p_driver_profile_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  freight_record RECORD;
  assignment_record RECORD;
  has_checkins BOOLEAN;
  safe_pickup_date TIMESTAMP WITH TIME ZONE;
  v_caller_id UUID;
  v_caller_profile_id UUID;
  is_multi_truck BOOLEAN;
  remaining_active INTEGER;
  v_driver_user_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT p.id INTO v_caller_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_caller_id AND p.id = p_driver_profile_id;
  
  IF v_caller_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  PERFORM set_config('app.skip_recalc', 'true', true);

  SELECT f.id, f.status, f.driver_id, f.pickup_date, f.required_trucks, f.accepted_trucks
  INTO freight_record
  FROM public.freights f
  WHERE f.id = freight_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  is_multi_truck := (freight_record.driver_id IS NULL);

  IF is_multi_truck THEN
    SELECT fa.id, fa.status INTO assignment_record
    FROM public.freight_assignments fa
    WHERE fa.freight_id = freight_id_param AND fa.driver_id = p_driver_profile_id
      AND fa.status IN ('OPEN', 'ACCEPTED', 'LOADING')
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
    END IF;
  ELSE
    IF freight_record.driver_id IS DISTINCT FROM p_driver_profile_id THEN
      RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
    END IF;

    IF freight_record.status IN ('LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN
      RETURN json_build_object('success', false, 'error', 'STATUS_REQUIRES_SUPPORT',
        'message', 'Após o carregamento, o cancelamento só pode ser feito pelo suporte/admin.');
    END IF;

    IF freight_record.status NOT IN ('OPEN', 'ACCEPTED', 'LOADING') THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.driver_checkins dc
    WHERE dc.freight_id = freight_id_param AND dc.driver_profile_id = p_driver_profile_id
  ) INTO has_checkins;
  
  IF has_checkins THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  -- ✅ STEP 1: Cancel/withdraw assignments FIRST (triggers recalc)
  IF is_multi_truck THEN
    UPDATE public.freight_assignments fa2
    SET status = 'WITHDRAWN', updated_at = now()
    WHERE fa2.freight_id = freight_id_param AND fa2.driver_id = p_driver_profile_id
      AND fa2.status IN ('OPEN', 'ACCEPTED', 'LOADING');
  ELSE
    UPDATE public.freight_assignments fa2
    SET status = 'CANCELLED', updated_at = now()
    WHERE fa2.freight_id = freight_id_param AND fa2.driver_id = p_driver_profile_id
      AND fa2.status NOT IN ('WITHDRAWN', 'CANCELLED', 'COMPLETED', 'DELIVERED');
  END IF;

  -- ✅ STEP 2: Cancel proposals
  UPDATE public.freight_proposals fp
  SET status = 'CANCELLED', updated_at = now()
  WHERE fp.freight_id = freight_id_param AND fp.driver_id = p_driver_profile_id;

  -- ✅ STEP 3: Delete trip progress
  DELETE FROM public.driver_trip_progress dtp
  WHERE dtp.freight_id = freight_id_param AND dtp.driver_id = p_driver_profile_id;

  -- ✅ STEP 4: Update freight — clear ALL stale fields
  IF is_multi_truck THEN
    SELECT COUNT(*) INTO remaining_active
    FROM public.freight_assignments fa3
    WHERE fa3.freight_id = freight_id_param AND fa3.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');

    UPDATE public.freights f2
    SET drivers_assigned = array_remove(f2.drivers_assigned, p_driver_profile_id),
        accepted_trucks = GREATEST(COALESCE(f2.accepted_trucks, 0) - 1, 0),
        status = CASE WHEN remaining_active = 0 THEN 'OPEN'::freight_status ELSE f2.status END,
        updated_at = now()
    WHERE f2.id = freight_id_param;
  ELSE
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    -- ✅ BUG #012 FIX: Clear accepted_trucks, drivers_assigned, driver_id, is_full_booking
    UPDATE public.freights f4
    SET status = 'OPEN',
        driver_id = NULL,
        accepted_trucks = 0,
        drivers_assigned = '{}',
        is_full_booking = false,
        pickup_date = safe_pickup_date,
        updated_at = now()
    WHERE f4.id = freight_id_param;
  END IF;

  -- ✅ STEP 5: Notification
  SELECT pr.user_id INTO v_driver_user_id
  FROM public.profiles pr
  WHERE pr.id = p_driver_profile_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_driver_user_id,
    'FREIGHT_WITHDRAWN',
    'Desistência confirmada',
    'Você desistiu do frete com sucesso.',
    json_build_object('freight_id', freight_id_param)::jsonb
  );

  PERFORM set_config('app.skip_recalc', 'false', true);

  RETURN json_build_object('success', true, 'message', 'Desistência processada com sucesso');

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_recalc', 'false', true);
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO service_role;