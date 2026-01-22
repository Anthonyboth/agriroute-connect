-- =====================================================
-- CORREÇÃO RLS: MOTORISTAS PODEM VER FRETE_MOTO
-- Problema: política atual exige role PRESTADOR_SERVICOS
-- Solução: criar política que permite MOTORISTA ver FRETE_MOTO
-- =====================================================

-- 1. Drop política existente que é muito restritiva
DROP POLICY IF EXISTS "providers_view_open_services" ON public.service_requests;
DROP POLICY IF EXISTS "Drivers can view open transport requests" ON public.service_requests;

-- 2. Criar política unificada para MOTORISTAS verem service_requests de transporte
CREATE POLICY "motoristas_view_transport_services"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  -- Serviço de transporte disponível (OPEN ou variantes) e sem provider
  status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
  AND provider_id IS NULL
  AND service_type IN ('GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO')
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'MOTORISTA'
  )
);

-- 3. Criar política para PRESTADORES verem outros tipos de serviço
CREATE POLICY "prestadores_view_services"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
  AND provider_id IS NULL
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'PRESTADOR_SERVICOS'
  )
);

-- 4. Política para usuário ver seus próprios serviços aceitos/em andamento
DROP POLICY IF EXISTS "users_view_own_accepted_services" ON public.service_requests;
CREATE POLICY "users_view_own_accepted_services"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  -- Motorista/Prestador vê serviços que aceitou
  provider_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- 5. Política para cliente ver seus próprios serviços
DROP POLICY IF EXISTS "clients_view_own_requests" ON public.service_requests;
CREATE POLICY "clients_view_own_requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- 6. Política para UPDATE - motorista pode aceitar serviços abertos
DROP POLICY IF EXISTS "motoristas_accept_transport_services" ON public.service_requests;
CREATE POLICY "motoristas_accept_transport_services"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
  AND provider_id IS NULL
  AND service_type IN ('GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO')
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'MOTORISTA'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'MOTORISTA'
  )
);

-- 7. Política para UPDATE - prestador pode aceitar qualquer serviço aberto
DROP POLICY IF EXISTS "prestadores_accept_services" ON public.service_requests;
CREATE POLICY "prestadores_accept_services"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
  AND provider_id IS NULL
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'PRESTADOR_SERVICOS'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'PRESTADOR_SERVICOS'
  )
);

-- 8. Política para provider atualizar serviços que já aceitou
DROP POLICY IF EXISTS "provider_update_own_accepted" ON public.service_requests;
CREATE POLICY "provider_update_own_accepted"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
  provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);