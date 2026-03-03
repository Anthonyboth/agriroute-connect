
-- 1. Add explicit anon deny for SELECT on service_requests
CREATE POLICY "service_requests_deny_anon_select"
ON public.service_requests
FOR SELECT
TO anon
USING (false);

-- 2. Fix policies that incorrectly target 'public' role to use 'authenticated' instead

-- Fix: authenticated_view_open_transport_requests (was public, should be authenticated)
DROP POLICY IF EXISTS "authenticated_view_open_transport_requests" ON public.service_requests;
CREATE POLICY "authenticated_view_open_transport_requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND status = 'OPEN'
  AND provider_id IS NULL
  AND service_type = ANY (ARRAY['GUINCHO','MUDANCA','FRETE_MOTO','FRETE_URBANO','TRANSPORTE_PET','ENTREGA_PACOTES'])
);

-- Fix: carriers_view_affiliated_driver_services (was public, should be authenticated)
DROP POLICY IF EXISTS "carriers_view_affiliated_driver_services" ON public.service_requests;
CREATE POLICY "carriers_view_affiliated_driver_services"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM company_drivers cd
    JOIN transport_companies tc ON tc.id = cd.company_id
    WHERE cd.driver_profile_id = service_requests.provider_id
      AND cd.status = 'ACTIVE'
      AND tc.profile_id = get_my_profile_id()
  )
);

-- Fix: Drivers can accept open transport requests (UPDATE was public, should be authenticated)
DROP POLICY IF EXISTS "Drivers can accept open transport requests" ON public.service_requests;
CREATE POLICY "Drivers can accept open transport requests"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  service_type = ANY (ARRAY['GUINCHO','MUDANCA','FRETE_MOTO','FRETE_URBANO','TRANSPORTE_PET','ENTREGA_PACOTES'])
  AND status = 'OPEN'
  AND provider_id IS NULL
)
WITH CHECK (
  service_type = ANY (ARRAY['GUINCHO','MUDANCA','FRETE_MOTO','FRETE_URBANO','TRANSPORTE_PET','ENTREGA_PACOTES'])
  AND provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Fix: providers_can_accept_and_update_service_requests (was public, should be authenticated)
DROP POLICY IF EXISTS "providers_can_accept_and_update_service_requests" ON public.service_requests;
CREATE POLICY "providers_can_accept_and_update_service_requests"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  provider_id IN (
    SELECT sp.profile_id FROM service_providers sp
    WHERE sp.profile_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  )
  OR (
    provider_id IS NULL AND status = 'OPEN'
    AND EXISTS (
      SELECT 1 FROM service_providers sp
      WHERE sp.profile_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
    )
  )
  OR is_admin()
)
WITH CHECK (
  provider_id IN (
    SELECT sp.profile_id FROM service_providers sp
    WHERE sp.profile_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  )
  OR is_admin()
);
