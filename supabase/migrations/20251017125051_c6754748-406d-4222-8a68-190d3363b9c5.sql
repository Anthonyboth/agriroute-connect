-- 1. REMOVER todas as políticas INSERT conflitantes
DROP POLICY IF EXISTS "Anyone can create guest service requests" ON service_requests;
DROP POLICY IF EXISTS "Anyone can create service requests" ON service_requests;
DROP POLICY IF EXISTS "Authenticated users can create service requests" ON service_requests;
DROP POLICY IF EXISTS "Qualquer usuário pode criar solicitações de serviço" ON service_requests;
DROP POLICY IF EXISTS "final_clients_create_service_requests" ON service_requests;
DROP POLICY IF EXISTS "guests_can_create_service_requests" ON service_requests;

-- 2. CRIAR UMA única política INSERT unificada
CREATE POLICY "service_requests_insert_unified"
ON service_requests
FOR INSERT
WITH CHECK (
  -- Caso 1: Usuário NÃO autenticado (guest) - client_id deve ser NULL
  (auth.uid() IS NULL AND client_id IS NULL)
  OR
  -- Caso 2: Usuário autenticado - client_id deve corresponder ao profile do usuário
  (auth.uid() IS NOT NULL AND client_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
);