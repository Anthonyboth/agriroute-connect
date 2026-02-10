-- Remove the outdated trigger that blocks drivers from having multiple active freights.
-- Business rules now allow multiple concurrent freights per driver (see freightRules.ts CONCURRENT_FREIGHT_LIMITS).
-- The trigger check_driver_availability on freights table enforces "one freight per driver" which is no longer valid.

DROP TRIGGER IF EXISTS enforce_one_freight_per_driver ON freights;

-- Recreate the function WITHOUT the blocking logic, keeping only the tracking update
CREATE OR REPLACE FUNCTION public.check_driver_availability()
RETURNS TRIGGER AS $$
DECLARE
  driver_role TEXT;
BEGIN
  -- Se não tem driver_id, permitir (frete aberto)
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atualizar tracking de disponibilidade (se existir registro)
  UPDATE affiliated_drivers_tracking
  SET is_available = FALSE,
      current_freight_id = NEW.id,
      tracking_status = CASE 
        WHEN NEW.status = 'LOADING' THEN 'LOADING'
        WHEN NEW.status = 'LOADED' THEN 'LOADING'
        ELSE 'IN_TRANSIT'
      END,
      updated_at = NOW()
  WHERE driver_profile_id = NEW.driver_id
  AND EXISTS (SELECT 1 FROM affiliated_drivers_tracking WHERE driver_profile_id = NEW.driver_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-create the trigger (without the blocking, just for tracking updates)
CREATE TRIGGER enforce_one_freight_per_driver
  BEFORE INSERT OR UPDATE OF driver_id, status ON freights
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL AND NEW.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'))
  EXECUTE FUNCTION check_driver_availability();