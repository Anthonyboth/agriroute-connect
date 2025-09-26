-- Ensure drivers can view and accept GUINCHO/MUDANCA service requests
-- Recreate policies idempotently
DROP POLICY IF EXISTS "Drivers can view open transport requests" ON public.service_requests;
DROP POLICY IF EXISTS "Drivers can view their accepted transport requests" ON public.service_requests;
DROP POLICY IF EXISTS "Drivers can accept open transport requests" ON public.service_requests;

-- 1) View OPEN transport requests
CREATE POLICY "Drivers can view open transport requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  service_type IN ('GUINCHO','MUDANCA')
  AND status = 'OPEN'
  AND provider_id IS NULL
);

-- 2) View their accepted transport requests
CREATE POLICY "Drivers can view their accepted transport requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  service_type IN ('GUINCHO','MUDANCA')
  AND provider_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- 3) Accept open transport requests
CREATE POLICY "Drivers can accept open transport requests"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  service_type IN ('GUINCHO','MUDANCA')
  AND status = 'OPEN'
  AND provider_id IS NULL
)
WITH CHECK (
  service_type IN ('GUINCHO','MUDANCA')
  AND provider_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);
