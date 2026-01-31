-- Fix producer visibility of driver_current_locations for multi-truck freights that remain OPEN
-- Root cause: existing policy only allows SELECT when freights.status is in active statuses,
-- but multi-truck freights intentionally stay OPEN until capacity is filled.
-- Solution: also allow visibility when there is an active freight_assignment for the driver.

DROP POLICY IF EXISTS "driver_current_locations_freight_participant" ON public.driver_current_locations;

CREATE POLICY "driver_current_locations_freight_participant"
ON public.driver_current_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.profiles producer ON producer.id = f.producer_id
    WHERE producer.user_id = auth.uid()
      AND (
        (
          f.status::text = ANY (
            ARRAY[
              'ACCEPTED',
              'LOADING',
              'LOADED',
              'IN_TRANSIT',
              'DELIVERED_PENDING_CONFIRMATION'
            ]
          )
          AND (
            f.driver_id = public.driver_current_locations.driver_profile_id
            OR public.driver_current_locations.driver_profile_id = ANY (f.drivers_assigned)
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.freight_assignments fa
          WHERE fa.freight_id = f.id
            AND fa.driver_id = public.driver_current_locations.driver_profile_id
            AND fa.status::text = ANY (ARRAY['ACCEPTED','LOADING','LOADED','IN_TRANSIT'])
        )
      )
  )
);
