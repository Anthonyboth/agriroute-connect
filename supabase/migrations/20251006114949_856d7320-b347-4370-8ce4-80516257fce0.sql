-- ================================================
-- MIGRATION: Fix ALL RLS Policies - SYNTAX FIXED
-- ================================================

-- 1. DRIVER_AVAILABILITY
DROP POLICY IF EXISTS "Drivers can insert their own availability" ON public.driver_availability;
CREATE POLICY "Drivers can insert their own availability"
ON public.driver_availability FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- 2. DRIVER_PAYOUT_REQUESTS
DROP POLICY IF EXISTS "Motoristas podem criar suas próprias solicitações de saque" ON public.driver_payout_requests;
CREATE POLICY "Motoristas podem criar suas próprias solicitações de saque"
ON public.driver_payout_requests FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- 3. DRIVER_WITHDRAWALS
DROP POLICY IF EXISTS "Drivers can create withdrawals" ON public.driver_withdrawals;
CREATE POLICY "Drivers can create withdrawals"
ON public.driver_withdrawals FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- 4. EXTERNAL_PAYMENTS
DROP POLICY IF EXISTS "Producers can create external payments" ON public.external_payments;
DROP POLICY IF EXISTS "Drivers can update external payments" ON public.external_payments;

CREATE POLICY "Producers can create external payments"
ON public.external_payments FOR INSERT
WITH CHECK (
  producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'producer'::app_role)
);

CREATE POLICY "Drivers can update external payments"
ON public.external_payments FOR UPDATE
USING (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- 5. FLEXIBLE_FREIGHT_PROPOSALS
DROP POLICY IF EXISTS "Drivers can create flexible proposals" ON public.flexible_freight_proposals;
CREATE POLICY "Drivers can create flexible proposals"
ON public.flexible_freight_proposals FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- 6. FREIGHT_ADVANCES
DROP POLICY IF EXISTS "Drivers can request advances" ON public.freight_advances;
DROP POLICY IF EXISTS "Producers can approve advances" ON public.freight_advances;

CREATE POLICY "Drivers can request advances"
ON public.freight_advances FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

CREATE POLICY "Producers can approve advances"
ON public.freight_advances FOR UPDATE
USING (
  (producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
   AND has_role(auth.uid(), 'producer'::app_role))
  OR is_admin()
);

-- 7. FREIGHT_PROPOSALS
DROP POLICY IF EXISTS "Drivers can create proposals" ON public.freight_proposals;
DROP POLICY IF EXISTS "Drivers can update their own proposals" ON public.freight_proposals;

CREATE POLICY "Drivers can create proposals"
ON public.freight_proposals FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

CREATE POLICY "Drivers can update their own proposals"
ON public.freight_proposals FOR UPDATE
USING (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
)
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- 8. FREIGHTS
DROP POLICY IF EXISTS "Producers can create freights" ON public.freights;
DROP POLICY IF EXISTS "Drivers can view freights" ON public.freights;
DROP POLICY IF EXISTS "Drivers can update their assigned freights" ON public.freights;

CREATE POLICY "Producers can create freights"
ON public.freights FOR INSERT
WITH CHECK (
  producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'producer'::app_role)
);

CREATE POLICY "Drivers can view freights"
ON public.freights FOR SELECT
USING (
  status = 'OPEN'::freight_status
  OR driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR is_admin()
);

CREATE POLICY "Drivers can update their assigned freights"
ON public.freights FOR UPDATE
USING (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR is_admin()
);

-- 9. GUEST_REQUESTS
DROP POLICY IF EXISTS "Admins or assigned provider can read guest requests" ON public.guest_requests;
CREATE POLICY "Admins or assigned provider can read guest requests"
ON public.guest_requests FOR SELECT
USING (
  is_admin()
  OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 10. PAYMENTS
DROP POLICY IF EXISTS "Producers can create payments" ON public.payments;
CREATE POLICY "Producers can create payments"
ON public.payments FOR INSERT
WITH CHECK (
  producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'producer'::app_role)
);

-- 11. PLANS - FIXED SYNTAX
DROP POLICY IF EXISTS "Users can view plans for their category" ON public.plans;
CREATE POLICY "Users can view plans for their category"
ON public.plans FOR SELECT
USING (
  (has_role(auth.uid(), 'driver'::app_role) 
   AND category IN ('rodotrem'::service_category, 'carreta'::service_category, 'truck'::service_category, 'vuc'::service_category, 'pickup'::service_category))
  OR 
  ((has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'service_provider'::app_role))
   AND category = 'prestador'::service_category)
  OR 
  is_admin()
);

-- 13. SERVICE_PROVIDERS
DROP POLICY IF EXISTS "Service providers can update their own records" ON public.service_providers;
DROP POLICY IF EXISTS "Users with PRESTADOR role can create service provider records" ON public.service_providers;

CREATE POLICY "Users with PRESTADOR role can create service provider records"
ON public.service_providers FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'service_provider'::app_role)
);

CREATE POLICY "Service providers can update their own records"
ON public.service_providers FOR UPDATE
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'service_provider'::app_role)
);

-- 14. SERVICE_REQUESTS
DROP POLICY IF EXISTS "Authenticated users can create service requests" ON public.service_requests;
CREATE POLICY "Authenticated users can create service requests"
ON public.service_requests FOR INSERT
WITH CHECK (
  client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 15. URBAN_SERVICE_PROVIDERS
DROP POLICY IF EXISTS "Users with PRESTADOR role can insert provider records" ON public.urban_service_providers;
DROP POLICY IF EXISTS "Service providers can update their own records" ON public.urban_service_providers;

CREATE POLICY "Users with PRESTADOR role can insert provider records"
ON public.urban_service_providers FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'service_provider'::app_role)
);

CREATE POLICY "Service providers can update their own records"
ON public.urban_service_providers FOR UPDATE
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 16. USER_SUBSCRIPTIONS
DROP POLICY IF EXISTS "Motoristas can manage their own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Motoristas can manage their own subscriptions"
ON public.user_subscriptions FOR ALL
USING (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 17. VEHICLES
DROP POLICY IF EXISTS "Motoristas can create their own vehicles" ON public.vehicles;
CREATE POLICY "Motoristas can create their own vehicles"
ON public.vehicles FOR INSERT
WITH CHECK (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND has_role(auth.uid(), 'driver'::app_role)
);

-- SYNC EXISTING DATA
INSERT INTO public.user_roles (user_id, role)
SELECT 
  p.user_id,
  CASE 
    WHEN p.role = 'MOTORISTA'::user_role THEN 'driver'::app_role
    WHEN p.role = 'PRODUTOR'::user_role THEN 'producer'::app_role
    WHEN p.role = 'PRESTADOR_SERVICOS'::user_role THEN 'service_provider'::app_role
    WHEN p.role = 'ADMIN'::user_role THEN 'admin'::app_role
  END as new_role
FROM public.profiles p
WHERE p.user_id IS NOT NULL AND p.role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
