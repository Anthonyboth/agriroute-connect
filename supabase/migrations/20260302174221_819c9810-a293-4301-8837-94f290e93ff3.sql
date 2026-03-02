-- Create the MISSING trigger function that syncs freight global status
-- when all assignments reach a terminal delivery status.
-- Follows the correct flow: DELIVERED_PENDING_CONFIRMATION → DELIVERED → COMPLETED

CREATE OR REPLACE FUNCTION public.sync_freight_status_on_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
  v_dpc_count integer;
  v_delivered_count integer;
  v_completed_count integer;
  v_current_freight_status text;
  v_freight_id uuid;
BEGIN
  v_freight_id := COALESCE(NEW.freight_id, OLD.freight_id);
  
  -- Get current freight status
  SELECT status INTO v_current_freight_status
  FROM freights WHERE id = v_freight_id;
  
  -- Only sync for freights that are actively in progress
  IF v_current_freight_status NOT IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED') THEN
    RETURN NEW;
  END IF;
  
  -- Count assignment statuses (exclude cancelled/rejected)
  SELECT 
    COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'REJECTED')),
    COUNT(*) FILTER (WHERE status = 'DELIVERED_PENDING_CONFIRMATION'),
    COUNT(*) FILTER (WHERE status = 'DELIVERED'),
    COUNT(*) FILTER (WHERE status = 'COMPLETED')
  INTO v_active_count, v_dpc_count, v_delivered_count, v_completed_count
  FROM freight_assignments
  WHERE freight_id = v_freight_id;
  
  -- No active assignments? Skip.
  IF v_active_count = 0 THEN
    RETURN NEW;
  END IF;
  
  -- ALL active assignments COMPLETED → freight = COMPLETED
  IF v_completed_count >= v_active_count THEN
    UPDATE freights SET status = 'COMPLETED', updated_at = now() WHERE id = v_freight_id AND status != 'COMPLETED';
    RETURN NEW;
  END IF;
  
  -- ALL active assignments DELIVERED → freight = DELIVERED
  IF v_delivered_count >= v_active_count THEN
    UPDATE freights SET status = 'DELIVERED', updated_at = now() WHERE id = v_freight_id AND status NOT IN ('DELIVERED', 'COMPLETED');
    RETURN NEW;
  END IF;
  
  -- ALL active assignments DELIVERED_PENDING_CONFIRMATION (or higher) → freight = DELIVERED_PENDING_CONFIRMATION
  IF (v_dpc_count + v_delivered_count + v_completed_count) >= v_active_count THEN
    UPDATE freights SET status = 'DELIVERED_PENDING_CONFIRMATION', updated_at = now() WHERE id = v_freight_id AND status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED');
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on freight_assignments
CREATE TRIGGER trg_sync_freight_status_on_assignment_update
  AFTER UPDATE OF status ON freight_assignments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_freight_status_on_assignment_update();