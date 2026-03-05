CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param uuid, p_driver_profile_id uuid)
RETURNS json
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
  -- Resolve user_id from driver profile for validation
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_driver_profile_id;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  SELECT f.id, f.status, f.driver_id, f.pickup_date, f.company_id
  INTO freight_record
  FROM public.freights f
  WHERE f.id = freight_id_param AND f.driver_id = p_driver_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  IF freight_record.status NOT IN ('ACCEPTED', 'LOADING') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  SELECT count(*) INTO checkin_count
  FROM public.driver_checkins
  WHERE freight_id = freight_id_param AND driver_profile_id = p_driver_profile_id;

  IF checkin_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  is_company_freight := freight_record.company_id IS NOT NULL;

  IF is_company_freight THEN
    UPDATE public.freights 
    SET status = 'OPEN', updated_at = now()
    WHERE id = freight_id_param;
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
  SET status = 'CANCELLED'
  WHERE freight_id = freight_id_param AND driver_id = p_driver_profile_id;

  -- Insert notification (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    v_user_id,
    'Desistência de Frete',
    'Sua desistência do frete foi processada.',
    'warning',
    jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal')
  );

  RETURN json_build_object(
    'success', true, 'message', 'DESISTENCIA_OK',
    'fee_amount', 20.00, 'fee_type', 'withdrawal',
    'user_id', v_user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO service_role;