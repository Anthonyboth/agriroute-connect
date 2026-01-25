-- ============================================
-- Migration: Fix location history purge with correct enum values
-- Security: Prevent tracking/stalking by limiting data retention
-- ============================================

-- 1. Recreate purge function with correct enum values
CREATE OR REPLACE FUNCTION public.purge_freight_location_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When freight status changes to completed, cancelled, or delivered
  -- Immediately mark location data for deletion (set expires_at to now + 24 hours)
  IF NEW.status IN ('COMPLETED'::freight_status, 'CANCELLED'::freight_status, 'DELIVERED'::freight_status) 
     AND OLD.status NOT IN ('COMPLETED'::freight_status, 'CANCELLED'::freight_status, 'DELIVERED'::freight_status) THEN
    
    UPDATE driver_location_history
    SET expires_at = now() + INTERVAL '24 hours'
    WHERE freight_id = NEW.id
      AND expires_at > now() + INTERVAL '24 hours';
    
    -- Log the purge scheduling for audit
    INSERT INTO audit_logs (table_name, operation, old_data, new_data, user_id)
    VALUES (
      'driver_location_history',
      'PURGE_SCHEDULED',
      jsonb_build_object('freight_id', NEW.id, 'freight_status', NEW.status::text),
      jsonb_build_object('expires_at', now() + INTERVAL '24 hours', 'reason', 'freight_completed'),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Recreate trigger
DROP TRIGGER IF EXISTS trigger_purge_location_on_freight_complete ON freights;
CREATE TRIGGER trigger_purge_location_on_freight_complete
  AFTER UPDATE OF status ON freights
  FOR EACH ROW
  EXECUTE FUNCTION purge_freight_location_history();

-- 3. Update existing records for completed freights
UPDATE driver_location_history dlh
SET expires_at = now() + INTERVAL '24 hours'
WHERE EXISTS (
  SELECT 1 FROM freights f 
  WHERE f.id = dlh.freight_id 
    AND f.status IN ('COMPLETED'::freight_status, 'CANCELLED'::freight_status, 'DELIVERED'::freight_status)
)
AND dlh.expires_at > now() + INTERVAL '24 hours';

-- 4. Comment for documentation
COMMENT ON FUNCTION public.purge_freight_location_history() IS 
'Security: Automatically schedules location history deletion 24h after freight completion to prevent long-term tracking. Reduced from 360 days to 7 days max retention.';