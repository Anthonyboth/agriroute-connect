-- Fix security warnings: add SET search_path to trigger functions

CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Special case: Allow driver confirmation (producer_id null means driver action)
  IF NEW.producer_id IS NULL AND OLD.status = 'DELIVERED_PENDING_CONFIRMATION' AND NEW.status = 'DELIVERED' THEN
    RETURN NEW;
  END IF;

  -- ✅ ALWAYS ALLOW CANCELLATION (producers can cancel their freights anytime)
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  -- ✅ ALLOW DELIVERED -> OPEN for multi-truck freights with remaining capacity
  -- This happens when some trucks are delivered but not all
  IF OLD.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')
     AND NEW.status = 'OPEN'
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1) THEN
    RAISE LOG 'Allowing DELIVERED->OPEN for multi-truck freight % (% of % trucks)', 
      NEW.id, NEW.accepted_trucks, NEW.required_trucks;
    RETURN NEW;
  END IF;

  -- ❌ RESTRICT DELIVERED status (ensure all trucks are accepted before delivery)
  IF NEW.status = 'DELIVERED'
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'Não é possível marcar como DELIVERED pois ainda faltam % carretas (% de % aceitas)',
      (NEW.required_trucks - NEW.accepted_trucks), NEW.accepted_trucks, NEW.required_trucks;
  END IF;

  -- ❌ PREVENT invalid regression after delivery reported (for SINGLE truck freights only)
  IF OLD.status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED')
     AND NEW.status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'CANCELLED', 'OPEN')
     AND COALESCE(NEW.required_trucks, 1) = 1 THEN
    RAISE EXCEPTION 'Transição de status inválida após entrega reportada';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_multi_truck_freight_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- For multi-truck freights, prevent setting freight status to DELIVERED_PENDING_CONFIRMATION
  -- This status should only exist at the assignment level for multi-truck
  IF COALESCE(NEW.required_trucks, 1) > 1 
     AND NEW.status = 'DELIVERED_PENDING_CONFIRMATION'
     AND OLD.status != 'DELIVERED_PENDING_CONFIRMATION' THEN
    
    RAISE LOG 'protect_multi_truck_freight_status: Blocking DELIVERED_PENDING_CONFIRMATION on multi-truck freight %, reverting to OPEN', NEW.id;
    NEW.status := 'OPEN';
  END IF;
  
  RETURN NEW;
END;
$$;