
-- Fix BOTH triggers that block DELIVERED status for multi-truck freights
-- when all active assignments are actually DELIVERED

-- 1. Fix prevent_regressive_freight_status_changes
CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivered_count integer;
  v_active_count integer;
BEGIN
  IF NEW.producer_id IS NULL AND OLD.status = 'DELIVERED_PENDING_CONFIRMATION' AND NEW.status = 'DELIVERED' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  -- Allow DELIVERED -> OPEN for multi-truck with remaining capacity
  IF OLD.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')
     AND NEW.status = 'OPEN'
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1) THEN
    RETURN NEW;
  END IF;

  -- RESTRICT DELIVERED: check actual assignment data, not just accepted_trucks
  IF NEW.status = 'DELIVERED'
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT') THEN
    
    -- Check if all active assignments are actually DELIVERED
    SELECT COUNT(*) FILTER (WHERE status = 'DELIVERED'),
           COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'REJECTED'))
    INTO v_delivered_count, v_active_count
    FROM freight_assignments
    WHERE freight_id = NEW.id;
    
    -- Allow if all active assignments are delivered
    IF v_active_count > 0 AND v_delivered_count >= v_active_count THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Não é possível marcar como DELIVERED pois ainda faltam % carretas (% de % aceitas)',
      (NEW.required_trucks - COALESCE(NEW.accepted_trucks, 0)), 
      COALESCE(NEW.accepted_trucks, 0), NEW.required_trucks;
  END IF;

  -- Prevent invalid regression (single truck)
  IF OLD.status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED')
     AND NEW.status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'CANCELLED', 'OPEN')
     AND COALESCE(NEW.required_trucks, 1) = 1 THEN
    RAISE EXCEPTION 'Transição de status inválida após entrega reportada';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Fix prevent_invalid_freight_status_changes  
CREATE OR REPLACE FUNCTION public.prevent_invalid_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivered_count integer;
  v_active_count integer;
BEGIN
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'DELIVERED'
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT') THEN
    
    -- Check actual assignment data
    SELECT COUNT(*) FILTER (WHERE status = 'DELIVERED'),
           COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'REJECTED'))
    INTO v_delivered_count, v_active_count
    FROM freight_assignments
    WHERE freight_id = NEW.id;
    
    IF v_active_count > 0 AND v_delivered_count >= v_active_count THEN
      RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'Não é possível marcar como DELIVERED pois ainda faltam % carretas (% de % aceitas)',
      (NEW.required_trucks - COALESCE(NEW.accepted_trucks, 0)), 
      COALESCE(NEW.accepted_trucks, 0), NEW.required_trucks;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Now fix the stuck freight
UPDATE freights
SET 
  accepted_trucks = 2,
  status = 'DELIVERED',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'manual_status_sync_at', now(),
    'reason', 'All 2 assignments DELIVERED, global status was stale'
  )
WHERE id::text LIKE '2c68d1a4%'
  AND status NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED');
