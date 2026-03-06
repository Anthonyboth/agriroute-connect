
-- ============================================================================
-- BUG #014 FIX: accept-freight-multiple rejects ACCEPTED freights with available slots
-- ROOT CAUSE 1: recalc_freight_accepted_trucks excludes CANCELLED/REJECTED but NOT
-- WITHDRAWN, so withdrawn assignments are counted as active → freight stays ACCEPTED
-- ROOT CAUSE 2: accept-freight-multiple blocks ALL non-OPEN statuses, including
-- ACCEPTED freights that still have available multi-truck slots
-- ============================================================================

-- FIX 1: Update recalc to also exclude WITHDRAWN from active count
CREATE OR REPLACE FUNCTION recalc_freight_accepted_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_freight_id UUID;
  actual_count INTEGER;
  required_count INTEGER;
  current_status freight_status;
  unique_drivers UUID[];
  new_status freight_status;
BEGIN
  -- Skip if withdrawal RPC set the skip flag
  IF current_setting('app.skip_recalc', true) = 'true' THEN
    RAISE LOG 'recalc_freight_accepted_trucks: SKIPPED (app.skip_recalc=true)';
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_freight_id := OLD.freight_id;
  ELSE
    target_freight_id := NEW.freight_id;
  END IF;

  -- ✅ FIX: Also exclude WITHDRAWN from active count
  SELECT COUNT(*), array_agg(DISTINCT driver_id)
  INTO actual_count, unique_drivers
  FROM freight_assignments
  WHERE freight_id = target_freight_id
    AND status NOT IN ('CANCELLED', 'REJECTED', 'WITHDRAWN');

  SELECT required_trucks, status
  INTO required_count, current_status
  FROM freights
  WHERE id = target_freight_id;

  new_status := current_status;

  IF current_status IN (
    'LOADING', 'LOADED', 'IN_TRANSIT',
    'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 
    'CANCELLED', 'COMPLETED'
  ) THEN
    new_status := current_status;
  ELSIF COALESCE(actual_count, 0) = 0 THEN
    IF current_status IN ('ACCEPTED', 'OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;
  ELSIF COALESCE(actual_count, 0) >= COALESCE(required_count, 1) THEN
    new_status := 'ACCEPTED'::freight_status;
  ELSIF COALESCE(actual_count, 0) > 0 AND COALESCE(actual_count, 0) < COALESCE(required_count, 1) THEN
    IF current_status NOT IN ('OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;
  END IF;

  UPDATE freights
  SET 
    accepted_trucks = COALESCE(actual_count, 0),
    drivers_assigned = COALESCE(unique_drivers, ARRAY[]::UUID[]),
    is_full_booking = (COALESCE(actual_count, 0) >= COALESCE(required_count, 1)),
    status = new_status,
    driver_id = CASE
      WHEN COALESCE(actual_count, 0) = 0 THEN NULL
      WHEN COALESCE(required_count, 1) = 1 AND array_length(unique_drivers, 1) = 1 THEN unique_drivers[1]
      WHEN COALESCE(required_count, 1) > 1 THEN NULL
      ELSE driver_id
    END,
    updated_at = now()
  WHERE id = target_freight_id;

  RAISE LOG 'recalc_freight_accepted_trucks: freight_id=%, actual=%, required=%, old_status=%, new_status=%',
    target_freight_id, actual_count, required_count, current_status, new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- FIX 2: Also update sync trigger to exclude WITHDRAWN
CREATE OR REPLACE FUNCTION sync_freight_status_on_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight_id UUID;
  v_active_count INT;
  v_dpc_count INT;
  v_delivered_count INT;
  v_completed_count INT;
BEGIN
  v_freight_id := NEW.freight_id;

  -- ✅ FIX: Also exclude WITHDRAWN from active count
  SELECT 
    COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'REJECTED', 'WITHDRAWN')),
    COUNT(*) FILTER (WHERE status = 'DELIVERED_PENDING_CONFIRMATION'),
    COUNT(*) FILTER (WHERE status = 'DELIVERED'),
    COUNT(*) FILTER (WHERE status = 'COMPLETED')
  INTO v_active_count, v_dpc_count, v_delivered_count, v_completed_count
  FROM freight_assignments
  WHERE freight_id = v_freight_id;
  
  IF v_active_count = 0 THEN
    RETURN NEW;
  END IF;
  
  IF v_completed_count >= v_active_count THEN
    UPDATE freights SET status = 'COMPLETED', updated_at = now() WHERE id = v_freight_id AND status != 'COMPLETED';
    RETURN NEW;
  END IF;
  
  IF v_delivered_count >= v_active_count THEN
    UPDATE freights SET status = 'DELIVERED', updated_at = now() WHERE id = v_freight_id AND status NOT IN ('DELIVERED', 'COMPLETED');
    RETURN NEW;
  END IF;
  
  IF (v_dpc_count + v_delivered_count + v_completed_count) >= v_active_count THEN
    UPDATE freights SET status = 'DELIVERED_PENDING_CONFIRMATION', updated_at = now() WHERE id = v_freight_id AND status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED');
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;


-- FIX 3: Clean up any freights stuck in ACCEPTED with no real active assignments
-- (WITHDRAWN assignments were being counted as active)
DO $$
DECLARE
  v_freight RECORD;
BEGIN
  PERFORM set_config('app.skip_recalc', 'true', true);
  
  FOR v_freight IN 
    SELECT f.id, f.status, f.required_trucks,
      (SELECT COUNT(*) FROM freight_assignments fa 
       WHERE fa.freight_id = f.id 
       AND fa.status NOT IN ('CANCELLED', 'REJECTED', 'WITHDRAWN')) as real_active
    FROM freights f
    WHERE f.status = 'ACCEPTED'
  LOOP
    IF v_freight.real_active = 0 THEN
      UPDATE freights
      SET status = 'OPEN', driver_id = NULL, accepted_trucks = 0,
          drivers_assigned = '{}', is_full_booking = false, updated_at = now()
      WHERE id = v_freight.id;
      RAISE LOG 'FRT-014 cleanup: freight % reset to OPEN (0 real active assignments)', v_freight.id;
    ELSIF v_freight.real_active < COALESCE(v_freight.required_trucks, 1) THEN
      UPDATE freights
      SET status = 'OPEN', 
          accepted_trucks = v_freight.real_active,
          is_full_booking = false, 
          updated_at = now()
      WHERE id = v_freight.id;
      RAISE LOG 'FRT-014 cleanup: freight % reset to OPEN (% of % slots filled)', v_freight.id, v_freight.real_active, v_freight.required_trucks;
    END IF;
  END LOOP;
  
  PERFORM set_config('app.skip_recalc', 'false', true);
END $$;

NOTIFY pgrst, 'reload schema';
