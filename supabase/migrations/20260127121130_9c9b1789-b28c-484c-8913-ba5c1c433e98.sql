-- SECURITY FIX: Strengthen driver_location_history access policies
-- Remove the overly permissive 24-hour window and require active freight status

-- Drop the permissive policies that allow extended access
DROP POLICY IF EXISTS freight_producer_location_access ON driver_location_history;
DROP POLICY IF EXISTS driver_location_owner_or_producer ON driver_location_history;
DROP POLICY IF EXISTS driver_location_history_select_owner_or_freight_producer ON driver_location_history;
DROP POLICY IF EXISTS driver_location_select_restricted ON driver_location_history;

-- Create a single consolidated, secure SELECT policy
-- Producers can ONLY view locations when:
-- 1. They own the freight
-- 2. The freight is actively in progress (not completed/cancelled)
-- 3. The location was captured recently (within last 1 hour for active freights)
CREATE POLICY driver_location_history_select_secure ON driver_location_history
FOR SELECT TO authenticated
USING (
  -- Driver always sees their own location history
  (driver_profile_id = get_current_profile_id())
  OR
  -- Admins can see all
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Producers can ONLY see locations for their ACTIVE freights (not terminal states)
  (
    freight_id IS NOT NULL 
    AND captured_at > (now() - interval '1 hour') -- Limit to last hour only
    AND EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = driver_location_history.freight_id
        AND f.producer_id = get_current_profile_id()
        AND f.status IN ('ACCEPTED', 'IN_TRANSIT', 'LOADING') -- Only active statuses, not DELIVERED/COMPLETED/CANCELLED
    )
  )
);

-- Add comment explaining the security rationale
COMMENT ON POLICY driver_location_history_select_secure ON driver_location_history IS 
'Security-hardened policy: Drivers see own history, producers see only active freight locations (max 1 hour), admins see all. Terminal statuses (DELIVERED, COMPLETED, CANCELLED) are excluded to prevent stalking.';