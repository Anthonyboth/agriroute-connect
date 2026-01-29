-- 6) Hardened driver_update_freight_status with audit logging
CREATE OR REPLACE FUNCTION public.driver_update_freight_status(
  p_freight_id uuid,
  p_new_status text,
  p_user_id uuid,
  p_notes text DEFAULT NULL::text,
  p_location jsonb DEFAULT NULL::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '15s'
SET lock_timeout TO '15s'
SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_exec_ms integer;
  v_old_status text;
  v_driver_id uuid;
  v_has_permission boolean := false;
  v_profile_id uuid;
  v_required_trucks integer;
  v_is_multi boolean := false;
  v_assignment_status text;
  v_loc_lat numeric;
  v_loc_lng numeric;
  v_result json;
BEGIN
  -- Normalize input
  p_new_status := upper(trim(p_new_status));

  -- Resolve profile_id (auth.uid() != profile.id in this codebase)
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    -- Fallback: p_user_id might already be profile_id
    v_profile_id := p_user_id;
  END IF;

  -- Load freight
  SELECT status::text, driver_id, COALESCE(required_trucks, 1)
    INTO v_old_status, v_driver_id, v_required_trucks
  FROM freights
  WHERE id = p_freight_id;

  IF v_old_status IS NULL THEN
    v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
    v_result := json_build_object('success', false, 'error', 'Frete não encontrado', 'code', 'FREIGHT_NOT_FOUND');
    PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, NULL, p_new_status, false, 'FREIGHT_NOT_FOUND', 'Frete não encontrado', v_exec_ms, '{}'::jsonb);
    RETURN v_result;
  END IF;

  v_old_status := upper(trim(v_old_status));

  -- Multi-truck freights typically have driver_id NULL and use freight_assignments for per-driver status.
  v_is_multi := (COALESCE(v_required_trucks, 1) > 1) AND v_driver_id IS NULL;

  -- Permission check
  IF v_driver_id = v_profile_id THEN
    v_has_permission := true;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM freight_assignments
      WHERE freight_id = p_freight_id
        AND driver_id = v_profile_id
        AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
      LIMIT 1
    ) INTO v_has_permission;
  END IF;

  IF NOT v_has_permission THEN
    v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
    v_result := json_build_object('success', false, 'error', 'Você não tem permissão para atualizar este frete', 'code', 'PERMISSION_DENIED');
    PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, v_old_status, p_new_status, false, 'PERMISSION_DENIED', 'Sem permissão', v_exec_ms,
      jsonb_build_object('multi_truck', v_is_multi, 'freight_driver_id', v_driver_id));
    RETURN v_result;
  END IF;

  -- For multi-truck, treat the driver's assignment as the source of truth for transition checks
  IF v_is_multi THEN
    SELECT fa.status
      INTO v_assignment_status
    FROM freight_assignments fa
    WHERE fa.freight_id = p_freight_id
      AND fa.driver_id = v_profile_id
    ORDER BY fa.updated_at DESC
    LIMIT 1;

    IF v_assignment_status IS NOT NULL THEN
      v_old_status := upper(trim(v_assignment_status));
    END IF;
  END IF;

  -- Idempotency: if already set, return success
  IF v_old_status = p_new_status THEN
    v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
    v_result := json_build_object(
      'success', true,
      'freight_id', p_freight_id,
      'old_status', v_old_status,
      'new_status', p_new_status,
      'already_set', true,
      'updated_at', now(),
      'multi_truck', v_is_multi
    );
    PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, v_old_status, p_new_status, true, NULL, NULL, v_exec_ms,
      jsonb_build_object('multi_truck', v_is_multi, 'already_set', true));
    RETURN v_result;
  END IF;

  -- Block regressions after delivery reported/confirmed
  IF v_old_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED')
     AND p_new_status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
    v_result := json_build_object('success', false, 'error', 'Não é possível alterar status de frete já finalizado', 'code', 'FREIGHT_ALREADY_CONFIRMED');
    PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, v_old_status, p_new_status, false, 'FREIGHT_ALREADY_CONFIRMED', 'Regressão bloqueada', v_exec_ms,
      jsonb_build_object('multi_truck', v_is_multi));
    RETURN v_result;
  END IF;

  -- Extract location (optional)
  IF p_location IS NOT NULL THEN
    BEGIN
      v_loc_lat := NULLIF(p_location->>'lat', '')::numeric;
      v_loc_lng := NULLIF(p_location->>'lng', '')::numeric;
    EXCEPTION
      WHEN OTHERS THEN
        v_loc_lat := NULL;
        v_loc_lng := NULL;
    END;
  END IF;

  IF v_is_multi THEN
    -- Update only this driver's assignment (do NOT change freight.status)
    UPDATE freight_assignments
    SET status = p_new_status,
        updated_at = now()
    WHERE freight_id = p_freight_id
      AND driver_id = v_profile_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
      AND status <> p_new_status;

    IF NOT FOUND THEN
      v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
      v_result := json_build_object('success', false, 'error', 'Atribuição ativa não encontrada para este motorista', 'code', 'ASSIGNMENT_NOT_FOUND');
      PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, v_old_status, p_new_status, false, 'ASSIGNMENT_NOT_FOUND', 'Sem assignment ativa', v_exec_ms,
        jsonb_build_object('multi_truck', true));
      RETURN v_result;
    END IF;

    -- Touch updated_at so clients relying on freights.updated_at can refresh
    UPDATE freights SET updated_at = now() WHERE id = p_freight_id;

  ELSE
    -- Single-driver freight: keep legacy behavior
    UPDATE freights
    SET status = p_new_status::freight_status, updated_at = now()
    WHERE id = p_freight_id AND status::text <> p_new_status;

    UPDATE freight_assignments
    SET status = p_new_status, updated_at = now()
    WHERE freight_id = p_freight_id
      AND driver_id = v_profile_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
      AND status <> p_new_status;
  END IF;

  -- Insert history (non-blocking)
  BEGIN
    INSERT INTO freight_status_history (freight_id, status, changed_by, location_lat, location_lng, notes, created_at)
    VALUES (p_freight_id, p_new_status::freight_status, v_profile_id, v_loc_lat, v_loc_lng, p_notes, now());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
  v_result := json_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'updated_at', now(),
    'multi_truck', v_is_multi
  );

  PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, v_old_status, p_new_status, true, NULL, NULL, v_exec_ms,
    jsonb_build_object('multi_truck', v_is_multi));

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_exec_ms := floor(extract(epoch from (clock_timestamp() - v_start)) * 1000);
    PERFORM public.log_trip_progress_event(p_freight_id, v_profile_id, v_old_status, p_new_status, false, 'UNKNOWN_ERROR', SQLERRM, v_exec_ms,
      jsonb_build_object('multi_truck', v_is_multi));
    RETURN json_build_object('success', false, 'error', SQLERRM, 'code', 'UNKNOWN_ERROR');
END;
$function$;