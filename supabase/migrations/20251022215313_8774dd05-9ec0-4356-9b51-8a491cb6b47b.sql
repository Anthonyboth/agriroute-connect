-- CORREÇÃO CRÍTICA: RLS service_requests
-- Remover policies problemáticas e criar seguras por role

-- 1. Remover policies existentes
DROP POLICY IF EXISTS "Usuários podem ver suas próprias solicitações" ON service_requests;
DROP POLICY IF EXISTS "service_requests_select_simple" ON service_requests;
DROP POLICY IF EXISTS "Enable read for all users" ON service_requests;
DROP POLICY IF EXISTS "service_requests_select_authenticated" ON service_requests;
DROP POLICY IF EXISTS "admin_view_all_service_requests" ON service_requests;
DROP POLICY IF EXISTS "clients_view_own_service_requests" ON service_requests;
DROP POLICY IF EXISTS "providers_view_service_requests" ON service_requests;
DROP POLICY IF EXISTS "drivers_view_transport_requests" ON service_requests;

-- 2. Function helper para admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'ADMIN'
  );
$$;

-- 3. Policies seguras por role

-- ADMIN vê tudo
CREATE POLICY "admin_view_all_service_requests"
ON service_requests FOR SELECT TO authenticated
USING (public.is_admin());

-- PRODUTOR/CLIENTE vê apenas seus pedidos
CREATE POLICY "clients_view_own_service_requests"
ON service_requests FOR SELECT TO authenticated
USING (
  client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- PRESTADOR vê serviços disponíveis + seus aceitos
CREATE POLICY "providers_view_service_requests"
ON service_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'PRESTADOR_SERVICOS'
  )
  AND (
    (status = 'OPEN' AND provider_id IS NULL)
    OR (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);

-- MOTORISTA vê APENAS GUINCHO/MUDANCA
CREATE POLICY "drivers_view_transport_requests"
ON service_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )
  AND service_type IN ('GUINCHO', 'MUDANCA')
  AND (
    (status = 'OPEN' AND provider_id IS NULL)
    OR (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);