-- Permitir criação de solicitações de serviço por usuários guest (não autenticados)
-- Isso é necessário para o formulário de solicitação de serviços funcionar sem login

CREATE POLICY "guests_can_create_service_requests"
ON public.service_requests
FOR INSERT 
TO public
WITH CHECK (
  -- Permite inserção se não há usuário autenticado (guest)
  -- E o client_id é um UUID especial para guests
  auth.uid() IS NULL 
  AND client_id = '00000000-0000-0000-0000-000000000000'::uuid
);

-- Permitir que admins e sistema vejam solicitações de guests
CREATE POLICY "admins_can_view_guest_service_requests"
ON public.service_requests
FOR SELECT
TO public
USING (
  -- Admins podem ver todas as solicitações, incluindo de guests
  is_admin() 
  OR (
    -- Ou se é uma solicitação guest e o usuário tem permissão do sistema
    client_id = '00000000-0000-0000-0000-000000000000'::uuid 
    AND auth.uid() IS NOT NULL
  )
);

-- Adicionar comentário explicativo
COMMENT ON POLICY "guests_can_create_service_requests" ON public.service_requests IS 
'Permite que usuários não autenticados (guests) criem solicitações de serviço usando um client_id especial';

COMMENT ON POLICY "admins_can_view_guest_service_requests" ON public.service_requests IS 
'Permite que admins vejam solicitações de usuários guest para gerenciamento do sistema';