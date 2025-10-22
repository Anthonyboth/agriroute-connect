-- Fix prevent_regressive_freight_status_changes to allow CANCELLED unconditionally
-- This function was still blocking cancellations when trucks were not accepted

CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- ❌ RESTRICT DELIVERED status (ensure all trucks are accepted before delivery)
  IF NEW.status = 'DELIVERED'
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'Não é possível marcar como DELIVERED pois ainda faltam % carretas (% de % aceitas)',
      (NEW.required_trucks - NEW.accepted_trucks), NEW.accepted_trucks, NEW.required_trucks;
  END IF;

  -- ❌ PREVENT invalid regression after delivery reported
  IF OLD.status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED')
     AND NEW.status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Transição de status inválida após entrega reportada';
  END IF;
  
  RETURN NEW;
END;
$$;