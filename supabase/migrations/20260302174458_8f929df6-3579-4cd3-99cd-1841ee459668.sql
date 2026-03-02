-- Fix stuck freight d0b0fda8: 1 active assignment with DELIVERED_PENDING_CONFIRMATION but freight still IN_TRANSIT
-- The new trigger only fires on FUTURE updates, so this existing one needs manual fix

-- Update the stuck freight
UPDATE freights 
SET status = 'DELIVERED_PENDING_CONFIRMATION', updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_sync_fix_at', now(),
      'reason', 'All active assignments at DELIVERED_PENDING_CONFIRMATION, global was stale IN_TRANSIT'
    )
WHERE id = 'd0b0fda8-f3a8-48a6-b391-33a5fb42b191'
  AND status = 'IN_TRANSIT';

-- Create a monitoring function that can be called periodically to detect and fix desync
CREATE OR REPLACE FUNCTION public.monitor_and_fix_freight_status_desync()
RETURNS TABLE(freight_id uuid, old_status text, new_status text, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_target_status text;
BEGIN
  FOR rec IN
    SELECT f.id, f.status as freight_status,
      COUNT(*) FILTER (WHERE fa.status NOT IN ('CANCELLED','REJECTED')) as active_count,
      COUNT(*) FILTER (WHERE fa.status = 'DELIVERED_PENDING_CONFIRMATION') as dpc_count,
      COUNT(*) FILTER (WHERE fa.status = 'DELIVERED') as delivered_count,
      COUNT(*) FILTER (WHERE fa.status = 'COMPLETED') as completed_count
    FROM freights f
    JOIN freight_assignments fa ON fa.freight_id = f.id
    WHERE f.status NOT IN ('COMPLETED', 'CANCELLED', 'OPEN', 'NEW', 'APPROVED')
    GROUP BY f.id, f.status
    HAVING COUNT(*) FILTER (WHERE fa.status NOT IN ('CANCELLED','REJECTED')) > 0
  LOOP
    v_target_status := NULL;
    
    -- All completed
    IF rec.completed_count >= rec.active_count THEN
      IF rec.freight_status != 'COMPLETED' THEN
        v_target_status := 'COMPLETED';
      END IF;
    -- All delivered
    ELSIF rec.delivered_count >= rec.active_count THEN
      IF rec.freight_status NOT IN ('DELIVERED', 'COMPLETED') THEN
        v_target_status := 'DELIVERED';
      END IF;
    -- All at DPC or higher
    ELSIF (rec.dpc_count + rec.delivered_count + rec.completed_count) >= rec.active_count THEN
      IF rec.freight_status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN
        v_target_status := 'DELIVERED_PENDING_CONFIRMATION';
      END IF;
    END IF;
    
    IF v_target_status IS NOT NULL THEN
      UPDATE freights SET 
        status = v_target_status, 
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'monitor_fix_at', now(),
          'monitor_old_status', rec.freight_status,
          'monitor_reason', 'Auto-sync by monitor_and_fix_freight_status_desync'
        )
      WHERE id = rec.id;
      
      freight_id := rec.id;
      old_status := rec.freight_status;
      new_status := v_target_status;
      reason := format('active=%s dpc=%s delivered=%s completed=%s', 
        rec.active_count, rec.dpc_count, rec.delivered_count, rec.completed_count);
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Revoke from anon, grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.monitor_and_fix_freight_status_desync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.monitor_and_fix_freight_status_desync() FROM anon;
GRANT EXECUTE ON FUNCTION public.monitor_and_fix_freight_status_desync() TO service_role;