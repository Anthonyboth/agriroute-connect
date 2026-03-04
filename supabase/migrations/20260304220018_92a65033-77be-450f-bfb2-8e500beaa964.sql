CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param UUID, driver_profile_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freight_record RECORD;
  assignment_record RECORD;
  has_checkins BOOLEAN;
  safe_pickup_date TIMESTAMP WITH TIME ZONE;
  v_caller_id UUID;
  v_caller_profile_id UUID;
  is_multi_truck BOOLEAN;
  remaining_active INTEGER;
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

  -- Fetch the freight
  SELECT id, status, driver_id, pickup_date, required_trucks, accepted_trucks
  INTO freight_record
  FROM public.freights
  WHERE id = freight_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  -- Determine if this is a multi-truck freight (uses freight_assignments)
  is_multi_truck := (freight_record.driver_id IS NULL);

  IF is_multi_truck THEN
    -- Check via freight_assignments
    SELECT id, status INTO assignment_record
    FROM public.freight_assignments
    WHERE freight_id = freight_id_param AND driver_id = driver_profile_id
      AND status IN ('ACCEPTED', 'LOADING')
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
    END IF;
  ELSE
    -- Single-truck: check driver_id directly
    IF freight_record.driver_id IS DISTINCT FROM driver_profile_id THEN
      RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
    END IF;

    IF freight_record.status NOT IN ('ACCEPTED','LOADING') THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
    END IF;
  END IF;

  -- Check for checkins (driver_checkins table)
  SELECT EXISTS(
    SELECT 1 FROM public.driver_checkins
    WHERE freight_id = freight_id_param AND driver_profile_id = process_freight_withdrawal.driver_profile_id
  ) INTO has_checkins;
  
  IF has_checkins THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  IF is_multi_truck THEN
    -- Remove the assignment
    UPDATE public.freight_assignments
    SET status = 'WITHDRAWN', updated_at = now()
    WHERE freight_id = freight_id_param AND driver_id = driver_profile_id
      AND status IN ('ACCEPTED', 'LOADING');

    -- Remove driver from drivers_assigned array
    UPDATE public.freights
    SET drivers_assigned = array_remove(drivers_assigned, driver_profile_id::text),
        accepted_trucks = GREATEST(COALESCE(accepted_trucks, 0) - 1, 0),
        updated_at = now()
    WHERE id = freight_id_param;

    -- Check if any active assignments remain
    SELECT COUNT(*) INTO remaining_active
    FROM public.freight_assignments
    WHERE freight_id = freight_id_param AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');

    -- If no active assignments, set freight back to OPEN
    IF remaining_active = 0 THEN
      UPDATE public.freights
      SET status = 'OPEN', updated_at = now()
      WHERE id = freight_id_param;
    END IF;
  ELSE
    -- Single-truck withdrawal
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights 
    SET status = 'OPEN', driver_id = NULL,
      pickup_date = safe_pickup_date, updated_at = now()
    WHERE id = freight_id_param AND driver_id = driver_profile_id;
  END IF;

  -- Cancel related proposals
  UPDATE public.freight_proposals 
  SET status = 'CANCELLED', updated_at = now()
  WHERE freight_id = freight_id_param AND driver_id = driver_profile_id;

  -- Notification
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    (SELECT user_id FROM public.profiles WHERE id = driver_profile_id),
    'Desistência de Frete',
    'Sua desistência do frete foi processada.',
    'warning',
    jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal')
  );

  RETURN json_build_object(
    'success', true, 'message', 'DESISTENCIA_OK',
    'is_multi_truck', is_multi_truck
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;