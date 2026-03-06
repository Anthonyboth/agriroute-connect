-- Force recompilation of the RPC by recreating it
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

  IF is_multi_truck THEN
    UPDATE public.freight_assignments fa2
    SET status = 'WITHDRAWN', updated_at = now()
    WHERE fa2.freight_id = freight_id_param AND fa2.driver_id = p_driver_profile_id
      AND fa2.status IN ('OPEN', 'ACCEPTED', 'LOADING');

    UPDATE public.freights f2
    SET drivers_assigned = array_remove(f2.drivers_assigned, p_driver_profile_id),
        accepted_trucks = GREATEST(COALESCE(f2.accepted_trucks, 0) - 1, 0),
        updated_at = now()
    WHERE f2.id = freight_id_param;

    SELECT COUNT(*) INTO remaining_active
    FROM public.freight_assignments fa3
    WHERE fa3.freight_id = freight_id_param AND fa3.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');

    IF remaining_active = 0 THEN
      UPDATE public.freights f3
      SET status = 'OPEN', updated_at = now()
      WHERE f3.id = freight_id_param;
    END IF;
  ELSE
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights f4
    SET status = 'OPEN', driver_id = NULL,
      pickup_date = safe_pickup_date, updated_at = now()
    WHERE f4.id = freight_id_param AND f4.driver_id = p_driver_profile_id;
  END IF;

  UPDATE public.freight_assignments fa4
  SET status = 'CANCELLED', updated_at = now()
  WHERE fa4.freight_id = freight_id_param AND fa4.driver_id = p_driver_profile_id
    AND fa4.status NOT IN ('WITHDRAWN', 'CANCELLED', 'COMPLETED', 'DELIVERED');

  UPDATE public.freight_proposals fp
  SET status = 'CANCELLED', updated_at = now()
  WHERE fp.freight_id = freight_id_param AND fp.driver_id = p_driver_profile_id;

  DELETE FROM public.driver_trip_progress dtp
  WHERE dtp.freight_id = freight_id_param AND dtp.driver_id = p_driver_profile_id;

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

  RETURN json_build_object('success', true, 'message', 'Desistência processada com sucesso');

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;