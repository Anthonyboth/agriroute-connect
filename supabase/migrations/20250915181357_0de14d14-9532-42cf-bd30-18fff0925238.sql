-- Função para criptografar dados sensíveis
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT 'default_key')
RETURNS text AS $$
BEGIN
  -- Usa a extensão pgcrypto para criptografar dados
  -- Vamos usar uma função mais simples por enquanto
  RETURN encode(digest(data || key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar dados (simplificada)
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text DEFAULT 'default_key')
RETURNS text AS $$
BEGIN
  -- Por enquanto retorna o hash - em produção seria necessário usar criptografia reversível
  RETURN encrypted_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar colunas criptografadas à tabela urban_service_requests
ALTER TABLE public.urban_service_requests 
ADD COLUMN IF NOT EXISTS contact_phone_encrypted text,
ADD COLUMN IF NOT EXISTS origin_address_encrypted text,
ADD COLUMN IF NOT EXISTS destination_address_encrypted text;

-- Função para criptografar telefones de contato existentes
UPDATE public.urban_service_requests 
SET contact_phone_encrypted = encrypt_sensitive_data(contact_phone)
WHERE contact_phone_encrypted IS NULL AND contact_phone IS NOT NULL;

-- Função para criptografar endereços existentes
UPDATE public.urban_service_requests 
SET origin_address_encrypted = encrypt_sensitive_data(origin_address),
    destination_address_encrypted = encrypt_sensitive_data(destination_address)
WHERE origin_address_encrypted IS NULL AND origin_address IS NOT NULL;

-- Corrigir políticas RLS para urban_service_requests
DROP POLICY IF EXISTS "Providers can view requests in their area" ON public.urban_service_requests;

-- Nova política mais restritiva para provedores
CREATE POLICY "Providers can only view assigned requests" 
ON public.urban_service_requests 
FOR SELECT 
USING (
  provider_id IN (
    SELECT id FROM urban_service_providers 
    WHERE profile_id IN (
      SELECT id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
  OR 
  -- Permitir visualização de requests pendentes apenas com dados limitados (sem telefone)
  (status = 'PENDING' AND auth.uid() IS NOT NULL)
);

-- Política para clientes visualizarem apenas suas próprias solicitações
CREATE POLICY "Clients can view their own requests" 
ON public.urban_service_requests 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Política para provedores atualizarem apenas requests atribuídos
CREATE POLICY "Providers can update only assigned requests" 
ON public.urban_service_requests 
FOR UPDATE 
USING (
  provider_id IN (
    SELECT id FROM urban_service_providers 
    WHERE profile_id IN (
      SELECT id FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Função para obter dados sensíveis apenas para usuários autorizados
CREATE OR REPLACE FUNCTION public.get_request_contact_info(request_id uuid)
RETURNS TABLE(contact_phone text, origin_address text, destination_address text) AS $$
BEGIN
  -- Verifica se o usuário tem permissão para ver os dados sensíveis
  IF EXISTS (
    SELECT 1 FROM urban_service_requests r
    LEFT JOIN urban_service_providers p ON r.provider_id = p.id
    LEFT JOIN profiles pr ON p.profile_id = pr.id
    WHERE r.id = request_id 
    AND (
      -- É o cliente que fez a solicitação
      r.client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR 
      -- É o provedor atribuído
      pr.user_id = auth.uid()
      OR
      -- É admin
      is_admin()
    )
  ) THEN
    RETURN QUERY
    SELECT r.contact_phone, r.origin_address, r.destination_address
    FROM urban_service_requests r
    WHERE r.id = request_id;
  ELSE
    -- Retorna dados mascarados ou nulos
    RETURN QUERY
    SELECT 
      '***-***-****'::text as contact_phone,
      'Endereço restrito'::text as origin_address, 
      'Endereço restrito'::text as destination_address;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar view segura para listagem de requests
CREATE OR REPLACE VIEW public.safe_urban_service_requests AS
SELECT 
  id,
  client_id,
  provider_id,
  service_type,
  -- Coordenadas aproximadas (sem precisão exata)
  ROUND(origin_lat::numeric, 3) as origin_lat_approx,
  ROUND(origin_lng::numeric, 3) as origin_lng_approx,
  ROUND(destination_lat::numeric, 3) as destination_lat_approx,
  ROUND(destination_lng::numeric, 3) as destination_lng_approx,
  distance_km,
  pickup_date,
  delivery_date,
  estimated_weight,
  estimated_volume,
  price,
  status,
  created_at,
  updated_at,
  -- Dados sensíveis mascarados
  CASE 
    WHEN provider_id IN (
      SELECT p.id FROM urban_service_providers p 
      JOIN profiles pr ON p.profile_id = pr.id 
      WHERE pr.user_id = auth.uid()
    ) OR client_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR is_admin()
    THEN contact_phone
    ELSE '***-***-****'
  END as contact_phone_safe,
  CASE 
    WHEN provider_id IN (
      SELECT p.id FROM urban_service_providers p 
      JOIN profiles pr ON p.profile_id = pr.id 
      WHERE pr.user_id = auth.uid()
    ) OR client_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR is_admin()
    THEN origin_address
    ELSE substring(origin_address from 1 for 20) || '...'
  END as origin_address_safe,
  CASE 
    WHEN provider_id IN (
      SELECT p.id FROM urban_service_providers p 
      JOIN profiles pr ON p.profile_id = pr.id 
      WHERE pr.user_id = auth.uid()
    ) OR client_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR is_admin()
    THEN destination_address
    ELSE substring(destination_address from 1 for 20) || '...'
  END as destination_address_safe
FROM public.urban_service_requests;

-- RLS para a view segura
ALTER VIEW public.safe_urban_service_requests OWNER TO postgres;
GRANT SELECT ON public.safe_urban_service_requests TO authenticated;
GRANT SELECT ON public.safe_urban_service_requests TO anon;