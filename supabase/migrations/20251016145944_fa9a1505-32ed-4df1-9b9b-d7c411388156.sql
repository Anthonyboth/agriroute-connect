-- 1) Atualiza RPC segura para motorista atualizar status com validação e sincronização do assignment
CREATE OR REPLACE FUNCTION public.driver_update_freight_status(
  p_freight_id uuid,
  p_new_status public.freight_status,
  p_notes text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_freight RECORD;
  v_is_participant boolean;
  v_allowed boolean := false;
BEGIN
  -- Perfil do usuário atual
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Buscar frete para validação e lock
  SELECT * INTO v_freight
  FROM public.freights
  WHERE id = p_freight_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Frete não encontrado');
  END IF;

  -- Verificar participação (motorista/produtor do frete ou assignment ativo)
  SELECT (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = p_freight_id
        AND (f.driver_id = v_profile_id OR f.producer_id = v_profile_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.freight_assignments fa
      WHERE fa.freight_id = p_freight_id
        AND fa.driver_id = v_profile_id
    )
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RETURN json_build_object('ok', false, 'error', 'Você não tem permissão para atualizar este frete');
  END IF;

  -- Evitar no-op
  IF v_freight.status = p_new_status THEN
    RETURN json_build_object('ok', false, 'error', 'Status já se encontra definido');
  END IF;

  -- Validação de transições permitidas
  IF v_freight.status = 'ACCEPTED' AND p_new_status IN ('LOADING', 'IN_TRANSIT') THEN
    v_allowed := true;
  ELSIF v_freight.status = 'LOADING' AND p_new_status IN ('IN_TRANSIT') THEN
    v_allowed := true;
  ELSIF v_freight.status = 'IN_TRANSIT' AND p_new_status IN ('DELIVERED_PENDING_CONFIRMATION') THEN
    v_allowed := true;
  ELSIF v_freight.status = 'DELIVERED_PENDING_CONFIRMATION' THEN
    RETURN json_build_object('ok', false, 'error', 'Entrega já reportada. Aguarde confirmação.');
  END IF;

  IF NOT v_allowed THEN
    RETURN json_build_object('ok', false, 'error', 'Transição de status não permitida');
  END IF;

  -- Atualizar frete
  UPDATE public.freights
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_freight_id;

  -- Inserir histórico
  INSERT INTO public.freight_status_history (
    freight_id, status, changed_by, notes, location_lat, location_lng, created_at
  ) VALUES (
    p_freight_id, p_new_status, v_profile_id, NULLIF(p_notes, ''), p_lat, p_lng, now()
  );

  -- Sincronizar assignment do motorista
  UPDATE public.freight_assignments
  SET status = p_new_status,
      delivered_at = CASE WHEN p_new_status = 'DELIVERED_PENDING_CONFIRMATION' THEN now() ELSE delivered_at END,
      delivery_date = CASE WHEN p_new_status = 'DELIVERED_PENDING_CONFIRMATION' THEN now()::date ELSE delivery_date END,
      updated_at = now()
  WHERE freight_id = p_freight_id
    AND driver_id = v_profile_id
    AND status IN ('ACCEPTED','LOADING','LOADED','IN_TRANSIT');

  RETURN json_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- 2) Trigger para impedir regressão após entrega reportada
CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status = 'DELIVERED_PENDING_CONFIRMATION'
     AND NEW.status NOT IN ('DELIVERED','DELIVERED_PENDING_CONFIRMATION') THEN
    RAISE EXCEPTION 'Transição de status inválida após entrega reportada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_regressive_freight_status_changes ON public.freights;
CREATE TRIGGER trg_prevent_regressive_freight_status_changes
BEFORE UPDATE ON public.freights
FOR EACH ROW
EXECUTE FUNCTION public.prevent_regressive_freight_status_changes();