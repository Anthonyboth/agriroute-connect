-- Fix: allow drivers to update status on multi-truck freights without changing the main freight.status
-- Rationale: for required_trucks > 1, freight.status may remain OPEN while each freight_assignment progresses.
-- Updating freight.status triggers sync_freight_assignment_status(), which forces ALL assignments to the same status.
-- This function now updates ONLY the driver's assignment for multi-truck freights, and keeps freight.status untouched.

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
SET lock_timeout TO '3s'
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status text;
  v_driver_id uuid;
  v_has_permission boolean := false;
  v_profile_id uuid;
  v_required_trucks integer;
  v_is_multi boolean := false;
  v_assignment_status text;
  v_loc_lat numeric;
  v_loc_lng numeric;
BEGIN
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
    RETURN json_build_object(
      'success', false,
      'error', 'Frete não encontrado',
      'code', 'FREIGHT_NOT_FOUND'
    );
  END IF;

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
    RETURN json_build_object(
      'success', false,
      'error', 'Você não tem permissão para atualizar este frete',
      'code', 'PERMISSION_DENIED',
      'debug_freight_driver_id', v_driver_id,
      'debug_user_profile_id', v_profile_id
    );
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
      v_old_status := v_assignment_status;
    END IF;
  END IF;

  -- Block regressions after delivery reported/confirmed
  IF v_old_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED')
     AND p_new_status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Não é possível alterar status de frete já finalizado',
      'code', 'FREIGHT_ALREADY_CONFIRMED'
    );
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
    -- ✅ Update only this driver's assignment (do NOT change freight.status)
    UPDATE freight_assignments
    SET status = p_new_status,
        updated_at = now()
    WHERE freight_id = p_freight_id
      AND driver_id = v_profile_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION');

    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Atribuição ativa não encontrada para este motorista',
        'code', 'ASSIGNMENT_NOT_FOUND'
      );
    END IF;

    -- Touch updated_at so clients relying on freights.updated_at can refresh
    UPDATE freights
    SET updated_at = now()
    WHERE id = p_freight_id;

  ELSE
    -- Single-driver freight: keep legacy behavior (update freight.status + assignment)
    UPDATE freights
    SET status = p_new_status::freight_status,
        updated_at = now()
    WHERE id = p_freight_id;

    UPDATE freight_assignments
    SET status = p_new_status,
        updated_at = now()
    WHERE freight_id = p_freight_id
      AND driver_id = v_profile_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION');
  END IF;

  -- Insert history (non-blocking)
  BEGIN
    INSERT INTO freight_status_history (
      freight_id,
      status,
      changed_by,
      location_lat,
      location_lng,
      notes,
      created_at
    ) VALUES (
      p_freight_id,
      p_new_status::freight_status,
      v_profile_id,
      v_loc_lat,
      v_loc_lng,
      p_notes,
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Erro ao inserir histórico (não bloqueante): %', SQLERRM;
  END;

  RETURN json_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'updated_at', now(),
    'multi_truck', v_is_multi
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'UNKNOWN_ERROR'
    );
END;
$function$;
