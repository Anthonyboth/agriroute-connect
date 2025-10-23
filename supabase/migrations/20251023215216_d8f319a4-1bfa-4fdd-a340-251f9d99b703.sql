-- ============================================
-- RLS Policies for affiliated_drivers_tracking
-- ============================================

ALTER TABLE public.affiliated_drivers_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adt_select_by_company" ON public.affiliated_drivers_tracking;
DROP POLICY IF EXISTS "adt_select_by_driver_self" ON public.affiliated_drivers_tracking;

CREATE POLICY "adt_select_by_company"
ON public.affiliated_drivers_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "adt_select_by_driver_self"
ON public.affiliated_drivers_tracking
FOR SELECT
TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);