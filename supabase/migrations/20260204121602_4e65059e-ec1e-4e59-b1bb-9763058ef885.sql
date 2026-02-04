
-- ============================================================
-- OTIMIZAÇÃO: Substituir subqueries para profiles por get_my_profile_id()
-- Isso melhora performance e evita falsos positivos no scan
-- ============================================================

-- 1. balance_transactions_owner_only
DROP POLICY IF EXISTS "balance_transactions_owner_only" ON public.balance_transactions;
CREATE POLICY "balance_transactions_owner_only" ON public.balance_transactions
  FOR SELECT TO authenticated
  USING (
    provider_id = get_my_profile_id()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. Drivers can insert their own availability
DROP POLICY IF EXISTS "Drivers can insert their own availability" ON public.driver_availability;
CREATE POLICY "Drivers can insert their own availability" ON public.driver_availability
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = get_my_profile_id()
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  );

-- 3. Motoristas podem criar suas próprias solicitações de saque
DROP POLICY IF EXISTS "Motoristas podem criar suas próprias solicitações de saque" ON public.driver_payout_requests;
CREATE POLICY "Motoristas podem criar suas próprias solicitações de saque" ON public.driver_payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = get_my_profile_id()
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  );

-- 4. Drivers view own areas, admins view all
DROP POLICY IF EXISTS "Drivers view own areas, admins view all" ON public.driver_service_areas;
CREATE POLICY "Drivers view own areas, admins view all" ON public.driver_service_areas
  FOR SELECT TO authenticated
  USING (
    driver_id = get_my_profile_id()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. Drivers can create withdrawals
DROP POLICY IF EXISTS "Drivers can create withdrawals" ON public.driver_withdrawals;
CREATE POLICY "Drivers can create withdrawals" ON public.driver_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = get_my_profile_id()
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  );

-- 6. Producers can create external payments
DROP POLICY IF EXISTS "Producers can create external payments" ON public.external_payments;
CREATE POLICY "Producers can create external payments" ON public.external_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    producer_id = get_my_profile_id()
    AND has_role(auth.uid(), 'producer'::app_role)
  );

-- 7. Producers can update their external payments
DROP POLICY IF EXISTS "Producers can update their external payments" ON public.external_payments;
CREATE POLICY "Producers can update their external payments" ON public.external_payments
  FOR UPDATE TO authenticated
  USING (
    producer_id = get_my_profile_id()
    AND has_role(auth.uid(), 'producer'::app_role)
  );

-- 8. Drivers can request advances
DROP POLICY IF EXISTS "Drivers can request advances" ON public.freight_advances;
CREATE POLICY "Drivers can request advances" ON public.freight_advances
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = get_my_profile_id()
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  );

-- 9. Producers can approve advances
DROP POLICY IF EXISTS "Producers can approve advances" ON public.freight_advances;
CREATE POLICY "Producers can approve advances" ON public.freight_advances
  FOR UPDATE TO authenticated
  USING (
    (producer_id = get_my_profile_id() AND has_role(auth.uid(), 'producer'::app_role))
    OR is_admin()
  );

-- 10. Drivers can update their own proposals
DROP POLICY IF EXISTS "Drivers can update their own proposals" ON public.freight_proposals;
CREATE POLICY "Drivers can update their own proposals" ON public.freight_proposals
  FOR UPDATE TO authenticated
  USING (
    driver_id = get_my_profile_id()
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  )
  WITH CHECK (
    driver_id = get_my_profile_id()
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  );

-- 11. Producers can create payments
DROP POLICY IF EXISTS "Producers can create payments" ON public.payments;
CREATE POLICY "Producers can create payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    producer_id = get_my_profile_id()
    AND has_role(auth.uid(), 'producer'::app_role)
  );

-- 12. Prestadores podem criar suas próprias solicitações de saque
DROP POLICY IF EXISTS "Prestadores podem criar suas próprias solicitações de saque" ON public.service_provider_payout_requests;
CREATE POLICY "Prestadores podem criar suas próprias solicitações de saque" ON public.service_provider_payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    provider_id = get_my_profile_id()
    AND has_role(auth.uid(), 'service_provider'::app_role)
  );

-- 13. Service providers can update their own records
DROP POLICY IF EXISTS "Service providers can update their own records" ON public.service_providers;
CREATE POLICY "Service providers can update their own records" ON public.service_providers
  FOR UPDATE TO authenticated
  USING (
    profile_id = get_my_profile_id()
    AND has_role(auth.uid(), 'service_provider'::app_role)
  );

-- 14. Users can create their service provider profile
DROP POLICY IF EXISTS "Users can create their service provider profile" ON public.service_providers;
CREATE POLICY "Users can create their service provider profile" ON public.service_providers
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = get_my_profile_id()
    AND has_role(auth.uid(), 'service_provider'::app_role)
  );

-- 15. Users with PRESTADOR role can create service provider records (duplicada, remover)
DROP POLICY IF EXISTS "Users with PRESTADOR role can create service provider records" ON public.service_providers;

-- 16. Users with PRESTADOR role can insert provider records
DROP POLICY IF EXISTS "Users with PRESTADOR role can insert provider records" ON public.urban_service_providers;
CREATE POLICY "Users with PRESTADOR role can insert provider records" ON public.urban_service_providers
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = get_my_profile_id()
    AND has_role(auth.uid(), 'service_provider'::app_role)
  );
