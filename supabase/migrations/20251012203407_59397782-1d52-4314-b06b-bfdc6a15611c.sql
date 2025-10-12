-- Permitir client_id NULL para solicitações de visitantes
ALTER TABLE public.service_requests 
ALTER COLUMN client_id DROP NOT NULL;

-- Remover policies antigas que bloqueavam inserções públicas
DROP POLICY IF EXISTS "Clients can create service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Clients can view their service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Providers can view assigned requests" ON public.service_requests;

-- Adicionar policy para permitir inserções públicas (sem autenticação) ou autenticadas
CREATE POLICY "Anyone can create service requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  -- Permite inserção sem autenticação (client_id = NULL)
  (auth.uid() IS NULL AND client_id IS NULL)
  OR 
  -- Ou com autenticação (client_id deve ser do usuário autenticado)
  (auth.uid() IS NOT NULL AND client_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  ))
);

-- Ajustar policy de SELECT para incluir solicitações sem client_id
CREATE POLICY "Users can view own requests and providers view assigned" 
ON public.service_requests 
FOR SELECT 
USING (
  -- Admins podem ver tudo
  is_admin()
  OR
  -- Usuários logados veem suas próprias solicitações
  (client_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  ))
  OR
  -- Provider atribuído pode ver
  (provider_id IN (
    SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
  ))
);