
-- =====================================================
-- FIX: driver_current_locations security hardening
-- =====================================================

-- 1. RESTRICTIVE deny for anonymous users (blocks all anon access)
CREATE POLICY "driver_locations_deny_anon"
ON public.driver_current_locations
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- 2. Drop and recreate company_tracker with TO authenticated + time restriction
DROP POLICY IF EXISTS "driver_current_locations_company_tracker" ON public.driver_current_locations;

CREATE POLICY "driver_current_locations_company_tracker"
ON public.driver_current_locations
FOR SELECT
TO authenticated
USING (
  -- Only show locations updated within the last 1 hour
  (updated_at >= NOW() - INTERVAL '1 hour')
  AND
  EXISTS (
    SELECT 1
    FROM affiliated_drivers_tracking adt
    WHERE adt.driver_profile_id = driver_current_locations.driver_profile_id
      AND adt.company_id IN (
        SELECT tc.id
        FROM transport_companies tc
        WHERE tc.profile_id = get_my_profile_id()
      )
      AND adt.tracking_status IN ('ACTIVE', 'TRACKING')
  )
);

-- 3. Drop and recreate freight_participant with time restriction + remove OPEN status
DROP POLICY IF EXISTS "driver_current_locations_freight_participant" ON public.driver_current_locations;

CREATE POLICY "driver_current_locations_freight_participant"
ON public.driver_current_locations
FOR SELECT
TO authenticated
USING (
  -- Only show locations updated within the last 1 hour
  (updated_at >= NOW() - INTERVAL '1 hour')
  AND
  (
    -- Producer can see driver location during active freight
    EXISTS (
      SELECT 1
      FROM freights f
      WHERE f.producer_id = get_my_profile_id()
        AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
        AND (
          f.driver_id = driver_current_locations.driver_profile_id
          OR driver_current_locations.driver_profile_id = ANY(f.drivers_assigned)
          OR EXISTS (
            SELECT 1 FROM freight_assignments fa
            WHERE fa.freight_id = f.id
              AND fa.driver_id = driver_current_locations.driver_profile_id
              AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
          )
        )
    )
    OR
    -- Company owner can see driver location during active freight (NOT 'OPEN')
    EXISTS (
      SELECT 1
      FROM freights f
      JOIN transport_companies tc ON tc.id = f.company_id
      WHERE tc.profile_id = get_my_profile_id()
        AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
        AND (
          f.driver_id = driver_current_locations.driver_profile_id
          OR driver_current_locations.driver_profile_id = ANY(f.drivers_assigned)
          OR EXISTS (
            SELECT 1 FROM freight_assignments fa
            WHERE fa.freight_id = f.id
              AND fa.driver_id = driver_current_locations.driver_profile_id
              AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
          )
        )
    )
    OR
    -- Co-driver on same freight can see peer location
    EXISTS (
      SELECT 1
      FROM freight_assignments fa
      WHERE fa.driver_id = get_my_profile_id()
        AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
        AND EXISTS (
          SELECT 1 FROM freight_assignments fa2
          WHERE fa2.freight_id = fa.freight_id
            AND fa2.driver_id = driver_current_locations.driver_profile_id
            AND fa2.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
        )
    )
  )
);
