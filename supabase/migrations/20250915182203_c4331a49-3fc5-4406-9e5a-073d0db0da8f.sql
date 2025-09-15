-- Remover todas as políticas existentes da tabela service_requests com nomes exatos
DROP POLICY "Clients can create service requests" ON public.service_requests;
DROP POLICY "Clients can update their requests" ON public.service_requests;
DROP POLICY "Clients can view their service requests" ON public.service_requests;
DROP POLICY "Providers can update assigned requests" ON public.service_requests;
DROP POLICY "Providers can view assigned requests" ON public.service_requests;
DROP POLICY "secure_clients_create_service_requests" ON public.service_requests;
DROP POLICY "secure_clients_view_service_requests" ON public.service_requests;
DROP POLICY "secure_providers_update_service_requests" ON public.service_requests;
DROP POLICY "secure_providers_view_service_requests" ON public.service_requests;

-- Criar novas políticas RLS completamente seguras
-- 1. Clientes podem criar suas próprias solicitações
CREATE POLICY "final_clients_create_service_requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- 2. Clientes podem ver apenas suas próprias solicitações (com dados completos)
CREATE POLICY "final_clients_view_service_requests" 
ON public.service_requests 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
  OR is_admin()
);

-- 3. Provedores podem ver apenas solicitações atribuídas a eles
CREATE POLICY "final_providers_view_service_requests" 
ON public.service_requests 
FOR SELECT 
USING (
  provider_id IN (
    SELECT sp.profile_id FROM service_providers sp
    WHERE sp.profile_id IN (
      SELECT id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
  OR is_admin()
);

-- 4. Provedores podem atualizar apenas solicitações atribuídas
CREATE POLICY "final_providers_update_service_requests" 
ON public.service_requests 
FOR UPDATE 
USING (
  provider_id IN (
    SELECT sp.profile_id FROM service_providers sp
    WHERE sp.profile_id IN (
      SELECT id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- 5. Clientes podem atualizar suas próprias solicitações (apenas campos permitidos)
CREATE POLICY "final_clients_update_service_requests" 
ON public.service_requests 
FOR UPDATE 
USING (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Função final para mascarar dados sensíveis automaticamente
CREATE OR REPLACE FUNCTION public.mask_service_request_data()
RETURNS trigger AS $$
BEGIN
  -- Se não é o cliente nem o provedor atribuído, mascarar dados sensíveis
  IF NOT (
    NEW.client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR NEW.provider_id IN (
      SELECT sp.profile_id FROM service_providers sp
      WHERE sp.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR is_admin()
  ) THEN
    -- Mascarar dados sensíveis
    NEW.contact_phone := '***-****-****';
    NEW.location_address := 'Endereço restrito';
    NEW.location_lat := NULL;
    NEW.location_lng := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;