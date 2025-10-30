-- ============================================================================
-- HOTFIX: Add fast-fail lock handling to driver_update_freight_status
-- ============================================================================
--
-- This migration updates the existing driver_update_freight_status function
-- to use the same fast-fail lock pattern as update_freight_status.
--
-- This resolves production timeouts by:
-- - Setting lock_timeout = '2s' to fail fast on lock contention
-- - Using FOR UPDATE NOWAIT to detect locks immediately (SQLSTATE 55P03)
-- - Setting statement_timeout = '10s' as a safety guard
-- - Returning clear 'FREIGHT_BUSY' error when row is locked
--
-- ============================================================================

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
  v_valid_transition BOOLEAN;
BEGIN
  -- ========================================================================
  -- FAST-FAIL LOCK HANDLING: Set timeouts and lock row upfront
  -- ========================================================================
  
  -- Set local timeouts to fail fast
  SET LOCAL lock_timeout = '2s';
  SET LOCAL statement_timeout = '10s';

  -- Try to lock the specific row and get data in one query
  -- This fails immediately (SQLSTATE 55P03) if another transaction holds the lock
  BEGIN
    SELECT status, producer_id, driver_id, company_id
    INTO v_current_status, v_producer_id, v_driver_id, v_company_id
    FROM freights
    WHERE id = p_freight_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      -- SQLSTATE 55P03
      RETURN jsonb_build_object(
        'success', false,
        'error', 'FREIGHT_BUSY',
        'message', 'Este frete está sendo atualizado por outra operação. Tente novamente em alguns segundos.'
      );
  END;

  -- ========================================================================
  -- EXISTING LOGIC: Validate data
  -- ========================================================================

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Frete não encontrado'
    );
  END IF;

  -- Prevent status regression from final statuses
  IF v_current_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Não é possível alterar status de frete finalizado',
      'current_status', v_current_status,
      'attempted_status', p_new_status
    );
  END IF;

  -- Validate transition based on current status
  v_valid_transition := CASE v_current_status
    WHEN 'OPEN' THEN p_new_status IN ('IN_NEGOTIATION', 'ACCEPTED', 'REJECTED', 'CANCELLED')
    WHEN 'IN_NEGOTIATION' THEN p_new_status IN ('ACCEPTED', 'REJECTED', 'CANCELLED')
    WHEN 'ACCEPTED' THEN p_new_status IN ('LOADING', 'CANCELLED')
    WHEN 'LOADING' THEN p_new_status IN ('LOADED', 'CANCELLED')
    WHEN 'LOADED' THEN p_new_status IN ('IN_TRANSIT', 'CANCELLED')
    WHEN 'IN_TRANSIT' THEN p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'CANCELLED')
    WHEN 'DELIVERED_PENDING_CONFIRMATION' THEN p_new_status IN ('DELIVERED', 'COMPLETED')
    WHEN 'DELIVERED' THEN p_new_status = 'COMPLETED'
    WHEN 'PENDING' THEN p_new_status IN ('OPEN', 'IN_NEGOTIATION', 'CANCELLED')
    ELSE false
  END;

  IF NOT v_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TRANSITION_NOT_ALLOWED',
      'message', format('Transição de %s para %s não permitida', v_current_status, p_new_status),
      'current_status', v_current_status,
      'attempted_status', p_new_status
    );
  END IF;

  -- ========================================================================
  -- EXISTING LOGIC: Update freight status and related records
  -- ========================================================================
  
  -- Update freight status
  UPDATE freights
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_freight_id;

  -- Sync assignment status if assignment_id provided
  IF p_assignment_id IS NOT NULL THEN
    UPDATE freight_assignments
    SET 
      status = p_new_status,
      updated_at = NOW()
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
        NOW()
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
        NOW()
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
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'new_status', p_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION driver_update_freight_status TO authenticated;

COMMENT ON FUNCTION driver_update_freight_status IS
'Update freight status with transition validation, history tracking, and fast-fail lock handling.

FAST-FAIL BEHAVIOR:
- Uses NOWAIT to fail immediately if row is locked (returns FREIGHT_BUSY error within ~2s)
- lock_timeout = 2s: Max time to wait for locks
- statement_timeout = 10s: Max total execution time

TYPICAL EXECUTION:
- No contention: <100ms
- Lock contention: ~2s (fails fast with FREIGHT_BUSY)
- Max possible: 10s (statement timeout)

SECURITY: DEFINER - runs with function owner privileges.

TROUBLESHOOTING: See update_freight_status function comments for diagnostic queries.
';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
