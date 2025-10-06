-- ===============================================
-- MIGRATION: Fix Final 3 RLS Policies
-- ===============================================

-- 1. SERVICE_PROVIDER_PAYOUT_REQUESTS
DROP POLICY IF EXISTS "Prestadores podem criar suas próprias solicitações de saque" ON public.service_provider_payout_requests;

CREATE POLICY "Prestadores podem criar suas próprias solicitações de saque"
ON public.service_provider_payout_requests
FOR INSERT
WITH CHECK (
  provider_id IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid()
  )
  AND has_role(auth.uid(), 'service_provider'::app_role)
);


-- 2. SERVICE_PROVIDERS
DROP POLICY IF EXISTS "Users can create their service provider profile" ON public.service_providers;

CREATE POLICY "Users can create their service provider profile"
ON public.service_providers
FOR INSERT
WITH CHECK (
  profile_id IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid()
  )
  AND has_role(auth.uid(), 'service_provider'::app_role)
);


-- 3. VEHICLES
DROP POLICY IF EXISTS "Drivers can insert their own vehicles" ON public.vehicles;

CREATE POLICY "Drivers can insert their own vehicles"
ON public.vehicles
FOR INSERT
WITH CHECK (
  driver_id IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid()
  )
  AND has_role(auth.uid(), 'driver'::app_role)
);
