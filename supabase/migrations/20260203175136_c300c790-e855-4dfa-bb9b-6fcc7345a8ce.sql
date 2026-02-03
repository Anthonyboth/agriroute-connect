-- Fix freight_status_history SELECT policies: compare driver_id with profile.id, not auth.uid()
-- The existing policies used auth.uid() but driver_id stores profile.id

BEGIN;

-- Drop broken policies
DROP POLICY IF EXISTS "Users can view status history for their freights" ON public.freight_status_history;
DROP POLICY IF EXISTS "drivers_and_producers_can_read_freight_history" ON public.freight_status_history;

-- Recreate unified SELECT policy with correct join
CREATE POLICY "freight_status_history_select_participants"
ON public.freight_status_history
FOR SELECT
TO authenticated
USING (
  -- Admin override
  is_admin()
  
  -- Producer of the freight
  OR EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.profiles p ON p.id = f.producer_id
    WHERE f.id = freight_status_history.freight_id
      AND p.user_id = auth.uid()
  )
  
  -- Driver assigned to the freight (via freights.driver_id)
  OR EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.profiles p ON p.id = f.driver_id
    WHERE f.id = freight_status_history.freight_id
      AND p.user_id = auth.uid()
  )
  
  -- Driver in drivers_assigned array
  OR EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.profiles p ON p.id = ANY(f.drivers_assigned)
    WHERE f.id = freight_status_history.freight_id
      AND p.user_id = auth.uid()
  )
  
  -- Driver via freight_assignments
  OR EXISTS (
    SELECT 1
    FROM public.freight_assignments fa
    JOIN public.profiles p ON p.id = fa.driver_id
    WHERE fa.freight_id = freight_status_history.freight_id
      AND p.user_id = auth.uid()
  )
  
  -- Transport company owner
  OR EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.transport_companies tc ON tc.id = f.company_id
    JOIN public.profiles p ON p.id = tc.profile_id
    WHERE f.id = freight_status_history.freight_id
      AND p.user_id = auth.uid()
  )
);

-- Fix INSERT policy: same issue
DROP POLICY IF EXISTS "Drivers can update status for their accepted freights" ON public.freight_status_history;
DROP POLICY IF EXISTS "drivers_can_insert_freight_status_history" ON public.freight_status_history;

CREATE POLICY "freight_status_history_insert_participants"
ON public.freight_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  -- changed_by must be the current user's profile
  changed_by = get_current_profile_id()
  
  AND (
    -- Producer
    EXISTS (
      SELECT 1
      FROM public.freights f
      JOIN public.profiles p ON p.id = f.producer_id
      WHERE f.id = freight_status_history.freight_id
        AND p.user_id = auth.uid()
    )
    -- Driver assigned directly
    OR EXISTS (
      SELECT 1
      FROM public.freights f
      JOIN public.profiles p ON p.id = f.driver_id
      WHERE f.id = freight_status_history.freight_id
        AND p.user_id = auth.uid()
    )
    -- Driver in drivers_assigned
    OR EXISTS (
      SELECT 1
      FROM public.freights f
      JOIN public.profiles p ON p.id = ANY(f.drivers_assigned)
      WHERE f.id = freight_status_history.freight_id
        AND p.user_id = auth.uid()
    )
    -- Driver via assignments
    OR EXISTS (
      SELECT 1
      FROM public.freight_assignments fa
      JOIN public.profiles p ON p.id = fa.driver_id
      WHERE fa.freight_id = freight_status_history.freight_id
        AND p.user_id = auth.uid()
    )
    -- Transport company owner
    OR EXISTS (
      SELECT 1
      FROM public.freights f
      JOIN public.transport_companies tc ON tc.id = f.company_id
      JOIN public.profiles p ON p.id = tc.profile_id
      WHERE f.id = freight_status_history.freight_id
        AND p.user_id = auth.uid()
    )
  )
);

COMMIT;