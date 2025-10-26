-- Fix driver_update_freight_status to use correct column names for freight_checkins
CREATE OR REPLACE FUNCTION driver_update_freight_status(
  p_freight_id UUID,
  p_new_status TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_assignment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_producer_id UUID;
  v_driver_id UUID;
  v_company_id UUID;
  v_result JSONB;
BEGIN
  -- Get current freight data
  SELECT status, producer_id, driver_id, company_id
  INTO v_current_status, v_producer_id, v_driver_id, v_company_id
  FROM freights
  WHERE id = p_freight_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Frete não encontrado');
  END IF;

  -- Prevent status regression from final statuses
  IF v_current_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível alterar status de frete finalizado');
  END IF;

  -- Update freight status
  UPDATE freights
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_freight_id;

  -- Sync assignment status if assignment_id provided
  IF p_assignment_id IS NOT NULL THEN
    UPDATE freight_assignments
    SET 
      status = p_new_status,
      updated_at = now()
    WHERE id = p_assignment_id;
  END IF;

  -- Insert check-in record with error handling
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    BEGIN
      INSERT INTO freight_checkins (
        freight_id,
        user_id,
        status,
        location_lat,
        location_lng,
        notes,
        created_at
      ) VALUES (
        p_freight_id,
        p_user_id,
        p_new_status,
        p_lat,
        p_lng,
        p_notes,
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      INSERT INTO audit_logs (
        table_name,
        operation,
        new_data,
        user_id,
        created_at
      ) VALUES (
        'freight_checkins',
        'INSERT_ERROR',
        jsonb_build_object('error', SQLERRM, 'freight_id', p_freight_id),
        p_user_id,
        now()
      );
    END;
  END IF;

  -- Log status change
  INSERT INTO freight_status_history (
    freight_id,
    status,
    changed_by,
    notes,
    location_lat,
    location_lng,
    created_at
  ) VALUES (
    p_freight_id,
    p_new_status,
    p_user_id,
    p_notes,
    p_lat,
    p_lng,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'new_status', p_new_status
  );
END;
$$;