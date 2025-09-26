-- Habilitar RLS na tabela service_requests se não estiver habilitado
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer usuário crie solicitações de serviço
CREATE POLICY "Qualquer usuário pode criar solicitações de serviço" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (true);

-- Política para permitir que usuários vejam suas próprias solicitações
CREATE POLICY "Usuários podem ver suas próprias solicitações" 
ON public.service_requests 
FOR SELECT 
USING (client_id = auth.uid() OR auth.uid() IS NOT NULL);

-- Política para permitir que prestadores vejam solicitações atribuídas a eles
CREATE POLICY "Prestadores podem ver solicitações atribuídas" 
ON public.service_requests 
FOR SELECT 
USING (provider_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Política para permitir que prestadores atualizem solicitações atribuídas
CREATE POLICY "Prestadores podem atualizar suas solicitações" 
ON public.service_requests 
FOR UPDATE 
USING (provider_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Política para admins verem tudo
CREATE POLICY "Admins podem ver todas as solicitações" 
ON public.service_requests 
FOR ALL 
USING (is_admin());