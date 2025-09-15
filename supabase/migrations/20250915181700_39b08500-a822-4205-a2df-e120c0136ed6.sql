-- Aplicar as mesmas correções de segurança para a tabela service_requests

-- Adicionar colunas criptografadas à tabela service_requests
ALTER TABLE public.service_requests 
ADD COLUMN IF NOT EXISTS contact_phone_encrypted text,
ADD COLUMN IF NOT EXISTS location_address_encrypted text;

-- Criptografar dados existentes se houver
UPDATE public.service_requests 
SET 
  contact_phone_encrypted = encrypt_sensitive_data(contact_phone),
  location_address_encrypted = encrypt_sensitive_data(location_address)
WHERE contact_phone_encrypted IS NULL;

-- Verificar se existem políticas RLS para service_requests e corrigi-las
DROP POLICY IF EXISTS "Users can create service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Users can view service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Providers can view and update assigned requests" ON public.service_requests;

-- Novas políticas RLS seguras para service_requests
-- 1. Clientes podem criar suas próprias solicitações
CREATE POLICY "secure_clients_can_create_service_requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- 2. Clientes podem ver apenas suas próprias solicitações
CREATE POLICY "secure_clients_view_own_service_requests" 
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
CREATE POLICY "secure_providers_view_assigned_service_requests" 
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
CREATE POLICY "secure_providers_update_assigned_service_requests" 
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

-- Função para obter dados sensíveis de service_requests com autorização
CREATE OR REPLACE FUNCTION public.get_secure_service_request_details(request_id uuid)
RETURNS TABLE(
  contact_phone text, 
  location_address text,
  location_lat numeric,
  location_lng numeric
) AS $$
DECLARE
  is_authorized boolean := false;
BEGIN
  -- Verifica autorização
  SELECT EXISTS(
    SELECT 1 FROM service_requests r
    LEFT JOIN service_providers sp ON r.provider_id = sp.profile_id
    WHERE r.id = request_id 
    AND (
      -- É o cliente
      r.client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR 
      -- É o provedor atribuído
      sp.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR
      -- É admin
      is_admin()
    )
  ) INTO is_authorized;
  
  IF is_authorized THEN
    RETURN QUERY
    SELECT 
      COALESCE(decrypt_sensitive_data(r.contact_phone_encrypted), r.contact_phone) as contact_phone,
      COALESCE(decrypt_sensitive_data(r.location_address_encrypted), r.location_address) as location_address,
      r.location_lat,
      r.location_lng
    FROM service_requests r
    WHERE r.id = request_id;
  ELSE
    -- Dados mascarados para usuários não autorizados
    RETURN QUERY
    SELECT 
      '***-****-****'::text as contact_phone,
      'Acesso restrito'::text as location_address,
      NULL::numeric as location_lat,
      NULL::numeric as location_lng;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;