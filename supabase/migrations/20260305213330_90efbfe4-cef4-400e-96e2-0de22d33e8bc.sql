DROP FUNCTION IF EXISTS public.process_freight_withdrawal(uuid, uuid);

CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param uuid, p_driver_profile_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT id INTO v_caller_profile_id
  FROM public.profiles
  WHERE user_id = v_caller_id AND id = p_driver_profile_id;
  
  IF v_caller_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  SELECT id, status, driver_id, pickup_date, required_trucks, accepted_trucks
  INTO freight_record
  FROM public.freights
  WHERE id = freight_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  is_multi_truck := (freight_record.driver_id IS NULL);

  IF is_multi_truck THEN
    SELECT id, status INTO assignment_record
    FROM public.freight_assignments
    WHERE freight_id = freight_id_param AND driver_id = p_driver_profile_id
      AND status IN ('ACCEPTED', 'LOADING')
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
    END IF;
  ELSE
    IF freight_record.driver_id IS DISTINCT FROM p_driver_profile_id THEN
      RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
    END IF;

    IF freight_record.status NOT IN ('ACCEPTED','LOADING') THEN
      RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.driver_checkins
    WHERE freight_id = freight_id_param AND driver_checkins.driver_profile_id = p_driver_profile_id
  ) INTO has_checkins;
  
  IF has_checkins THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  IF is_multi_truck THEN
    UPDATE public.freight_assignments
    SET status = 'WITHDRAWN', updated_at = now()
    WHERE freight_id = freight_id_param AND driver_id = p_driver_profile_id
      AND status IN ('ACCEPTED', 'LOADING');

    UPDATE public.freights
    SET drivers_assigned = array_remove(drivers_assigned, p_driver_profile_id::text),
        accepted_trucks = GREATEST(COALESCE(accepted_trucks, 0) - 1, 0),
        updated_at = now()
    WHERE id = freight_id_param;

    SELECT COUNT(*) INTO remaining_active
    FROM public.freight_assignments
    WHERE freight_id = freight_id_param AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');

    IF remaining_active = 0 THEN
      UPDATE public.freights
      SET status = 'OPEN', updated_at = now()
      WHERE id = freight_id_param;
    END IF;
  ELSE
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights 
    SET status = 'OPEN', driver_id = NULL,
      pickup_date = safe_pickup_date, updated_at = now()
    WHERE id = freight_id_param AND driver_id = p_driver_profile_id;
  END IF;

  UPDATE public.freight_proposals 
  SET status = 'CANCELLED', updated_at = now()
  WHERE freight_id = freight_id_param AND driver_id = p_driver_profile_id;

  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    (SELECT user_id FROM public.profiles WHERE id = p_driver_profile_id),
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
$function$;