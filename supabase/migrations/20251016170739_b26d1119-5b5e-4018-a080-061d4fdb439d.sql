-- Harden process_freight_withdrawal to block invalid statuses and checkins
CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param uuid, driver_profile_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  freight_record RECORD;
  has_checkins BOOLEAN;
BEGIN
  -- Ensure freight exists and belongs to the driver
  SELECT id, status, driver_id INTO freight_record
  FROM public.freights
  WHERE id = freight_id_param;
  
  IF NOT FOUND OR freight_record.driver_id IS DISTINCT FROM driver_profile_id THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  -- Allow withdrawal only for ACCEPTED or LOADING
  IF freight_record.status NOT IN ('ACCEPTED','LOADING') THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  -- Block withdrawal if the driver has already made any check-in for this freight
  SELECT EXISTS(
    SELECT 1 FROM public.freight_checkins
    WHERE freight_id = freight_id_param AND user_id = driver_profile_id
  ) INTO has_checkins;
  
  IF has_checkins THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  -- Perform withdrawal: reopen freight and clear driver
  UPDATE public.freights 
  SET 
    status = 'OPEN'::freight_status,
    driver_id = NULL,
    updated_at = now()
  WHERE id = freight_id_param AND driver_id = driver_profile_id;

  -- Mark related proposals as CANCELLED for historical accuracy
  UPDATE public.freight_proposals 
  SET 
    status = 'CANCELLED',
    updated_at = now()
  WHERE freight_id = freight_id_param AND driver_id = driver_profile_id;

  -- Optional notification: apply withdrawal fee notice
  INSERT INTO public.notifications (
    user_id, title, message, type, data
  ) VALUES (
    (SELECT user_id FROM public.profiles WHERE id = driver_profile_id),
    'Taxa de Desistência',
    'Foi aplicada uma taxa de R$ 20,00 pela desistência do frete. O valor será descontado do próximo pagamento.',
    'warning',
    jsonb_build_object('freight_id', freight_id_param, 'fee_amount', 20.00, 'fee_type', 'withdrawal')
  );

  RETURN json_build_object('success', true, 'message', 'DESISTENCIA_OK');

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;