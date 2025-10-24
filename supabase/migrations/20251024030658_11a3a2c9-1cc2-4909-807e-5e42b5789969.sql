-- Fix driver_update_freight_status to use correct column names (location_lat, location_lng)
CREATE OR REPLACE FUNCTION public.driver_update_freight_status(
  p_freight_id uuid,
  p_new_status public.freight_status,
  p_notes text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_freight RECORD;
  v_is_assigned boolean := false;
  v_allowed boolean := false;
  v_effective_driver uuid;
BEGIN
  -- Perfil do usuário atual
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  END IF;

  -- Carregar frete
  SELECT * INTO v_freight
  FROM public.freights f
  WHERE f.id = p_freight_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'FREIGHT_NOT_FOUND');
  END IF;

  -- Verificar se é motorista atribuído (suporta multi-caminhão)
  SELECT EXISTS (
    SELECT 1 FROM public.freight_assignments fa
    WHERE fa.freight_id = p_freight_id
      AND fa.driver_id = v_profile_id
      AND fa.status IN ('ACCEPTED','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION')
    LIMIT 1
  ) INTO v_is_assigned;

  -- Autorização: motorista principal ou atribuído
  IF v_freight.driver_id IS DISTINCT FROM v_profile_id AND NOT v_is_assigned THEN
    RETURN json_build_object('ok', false, 'error', 'NOT_FREIGHT_DRIVER');
  END IF;

  -- Estados finais
  IF v_freight.status IN ('CANCELLED','DELIVERED') THEN
    RETURN json_build_object('ok', false, 'error', 'FREIGHT_FINALIZED');
  END IF;
  IF v_freight.status = 'DELIVERED_PENDING_CONFIRMATION' AND p_new_status <> 'DELIVERED' THEN
    RETURN json_build_object('ok', false, 'error', 'DELIVERY_ALREADY_REPORTED');
  END IF;

  -- Transições permitidas
  IF v_freight.status = 'ACCEPTED' AND p_new_status IN ('LOADING','LOADED','IN_TRANSIT') THEN
    v_allowed := true;
  ELSIF v_freight.status = 'LOADING' AND p_new_status IN ('LOADED','IN_TRANSIT') THEN
    v_allowed := true;
  ELSIF v_freight.status = 'LOADED' AND p_new_status = 'IN_TRANSIT' THEN
    v_allowed := true;
  ELSIF v_freight.status = 'IN_TRANSIT' AND p_new_status = 'DELIVERED_PENDING_CONFIRMATION' THEN
    v_allowed := true;
  ELSIF v_freight.status = 'DELIVERED_PENDING_CONFIRMATION' AND p_new_status = 'DELIVERED' THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN json_build_object('ok', false, 'error', 'TRANSITION_NOT_ALLOWED', 'from', v_freight.status, 'to', p_new_status);
  END IF;

  v_effective_driver := COALESCE(v_freight.driver_id, v_profile_id);

  -- Atualizar frete
  UPDATE public.freights
  SET 
    status = p_new_status,
    driver_id = CASE WHEN driver_id IS NULL AND v_is_assigned THEN v_profile_id ELSE driver_id END,
    updated_at = now(),
    metadata = CASE 
      WHEN p_new_status = 'DELIVERED_PENDING_CONFIRMATION' THEN 
        COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'delivery_reported_at', now(),
          'confirmation_deadline', (now() + interval '72 hours')::timestamp
        )
      ELSE metadata
    END
  WHERE id = p_freight_id;

  -- Histórico de status com colunas corretas (location_lat, location_lng)
  INSERT INTO public.freight_status_history (
    freight_id, status, notes, changed_by, location_lat, location_lng, created_at
  ) VALUES (
    p_freight_id, p_new_status, p_notes, v_effective_driver, p_lat, p_lng, now()
  );

  -- Check-in automático se localização fornecida (usando location_lat, location_lng)
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    INSERT INTO public.freight_checkins (
      freight_id,
      user_id,
      checkin_type,
      location_lat,
      location_lng,
      observations,
      status
    ) VALUES (
      p_freight_id,
      v_effective_driver,
      CASE 
        WHEN p_new_status = 'LOADING' THEN 'LOADING'
        WHEN p_new_status = 'IN_TRANSIT' THEN 'IN_TRANSIT'
        WHEN p_new_status IN ('DELIVERED_PENDING_CONFIRMATION','DELIVERED') THEN 'UNLOADING'
        ELSE 'IN_TRANSIT'
      END,
      p_lat,
      p_lng,
      p_notes,
      'CONFIRMED'
    );
  END IF;

  -- Sincronizar assignment do motorista atuante
  UPDATE public.freight_assignments
  SET 
    status = CASE
      WHEN p_new_status = 'DELIVERED_PENDING_CONFIRMATION' THEN 'DELIVERED_PENDING_CONFIRMATION'
      WHEN p_new_status = 'IN_TRANSIT' THEN 'IN_TRANSIT'
      WHEN p_new_status = 'LOADED' THEN 'LOADED'
      WHEN p_new_status = 'LOADING' THEN 'LOADING'
      WHEN p_new_status = 'DELIVERED' THEN 'DELIVERED'
      ELSE status
    END,
    delivered_at = CASE WHEN p_new_status IN ('DELIVERED','DELIVERED_PENDING_CONFIRMATION') THEN now() ELSE delivered_at END,
    delivery_date = CASE WHEN p_new_status IN ('DELIVERED','DELIVERED_PENDING_CONFIRMATION') THEN now()::date ELSE delivery_date END,
    updated_at = now()
  WHERE freight_id = p_freight_id
    AND driver_id = v_profile_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- Enable realtime for freight_checkins table (check first to avoid error)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'freight_checkins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE freight_checkins;
  END IF;
END $$;