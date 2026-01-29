-- Policy: Transporters can read driver GPS if driver is affiliated and tracking for their company
CREATE POLICY driver_current_locations_company_tracker
ON public.driver_current_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.affiliated_drivers_tracking adt
    WHERE adt.driver_profile_id = driver_current_locations.driver_profile_id
      AND adt.company_id IN (
        SELECT tc.id FROM public.transport_companies tc
        WHERE tc.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
      AND adt.tracking_status IN ('ACTIVE', 'TRACKING')
  )
);