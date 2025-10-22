-- Drop existing trigger first
DROP TRIGGER IF EXISTS prevent_invalid_status_changes ON public.freights;
DROP TRIGGER IF EXISTS check_freight_status_before_update ON public.freights;

-- Update the function to allow cancellation unconditionally
CREATE OR REPLACE FUNCTION public.prevent_invalid_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ✅ ALLOW CANCELLATION ALWAYS (producers can cancel their freights anytime)
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  -- ❌ ONLY RESTRICT DELIVERED status (ensure all trucks are accepted before delivery)
  IF NEW.status = 'DELIVERED'
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'Não é possível marcar como DELIVERED pois ainda faltam % carretas (% de % aceitas)',
      (NEW.required_trucks - NEW.accepted_trucks), NEW.accepted_trucks, NEW.required_trucks;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER prevent_invalid_status_changes
  BEFORE UPDATE OF status ON public.freights
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.prevent_invalid_freight_status_changes();