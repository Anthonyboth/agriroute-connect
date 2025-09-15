-- Remover todas as políticas existentes da tabela service_requests
DROP POLICY IF EXISTS "secure_clients_can_create_service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "secure_clients_view_own_service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "secure_providers_view_assigned_service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "secure_providers_update_assigned_service_requests" ON public.service_requests;

-- Remover outras políticas antigas se existirem
DROP POLICY IF EXISTS "Users can create service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Users can view service requests" ON public.service_requests;
DROP POLICY IF EXISTS "Providers can view and update assigned requests" ON public.service_requests;

-- Verificar se as colunas criptografadas existem
ALTER TABLE public.service_requests 
ADD COLUMN IF NOT EXISTS contact_phone_encrypted text,
ADD COLUMN IF NOT EXISTS location_address_encrypted text;

-- Criptografar dados existentes se houver
UPDATE public.service_requests 
SET 
  contact_phone_encrypted = encrypt_sensitive_data(contact_phone),
  location_address_encrypted = encrypt_sensitive_data(location_address)
WHERE contact_phone_encrypted IS NULL AND contact_phone IS NOT NULL;

-- Criar novas políticas RLS seguras para service_requests
-- 1. Clientes podem criar suas próprias solicitações
CREATE POLICY "secure_clients_create_service_requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- 2. Clientes podem ver apenas suas próprias solicitações
CREATE POLICY "secure_clients_view_service_requests" 
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
CREATE POLICY "secure_providers_view_service_requests" 
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
CREATE POLICY "secure_providers_update_service_requests" 
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

-- Função para buscar solicitações de forma segura para provedores
CREATE OR REPLACE FUNCTION public.get_provider_service_requests(provider_profile_id uuid)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  service_type text,
  problem_description text,
  vehicle_info text,
  urgency text,
  estimated_price numeric,
  status text,
  created_at timestamp with time zone,
  is_emergency boolean,
  -- Dados sensíveis mascarados baseados na autorização
  contact_phone_safe text,
  location_address_safe text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.client_id,
    r.service_type,
    r.problem_description,
    r.vehicle_info,
    r.urgency,
    r.estimated_price,
    r.status,
    r.created_at,
    r.is_emergency,
    -- Dados sensíveis apenas para provedores autorizados
    CASE 
      WHEN r.provider_id = provider_profile_id 
      THEN COALESCE(decrypt_sensitive_data(r.contact_phone_encrypted), r.contact_phone)
      ELSE '***-****-****'
    END as contact_phone_safe,
    CASE 
      WHEN r.provider_id = provider_profile_id 
      THEN COALESCE(decrypt_sensitive_data(r.location_address_encrypted), r.location_address)
      ELSE 'Endereço restrito até aceitar'
    END as location_address_safe
  FROM public.service_requests r
  WHERE r.provider_id = provider_profile_id
     OR (r.status = 'PENDING' AND r.provider_id IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;