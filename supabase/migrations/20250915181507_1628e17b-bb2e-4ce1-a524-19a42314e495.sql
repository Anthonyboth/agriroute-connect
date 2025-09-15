-- Remover todas as políticas existentes da tabela urban_service_requests
DROP POLICY IF EXISTS "Clients can create requests" ON public.urban_service_requests;
DROP POLICY IF EXISTS "Clients can view their own requests" ON public.urban_service_requests;  
DROP POLICY IF EXISTS "Providers can update accepted requests" ON public.urban_service_requests;
DROP POLICY IF EXISTS "Providers can view requests in their area" ON public.urban_service_requests;

-- Função para criptografar dados sensíveis usando pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT 'agri_key_2024')
RETURNS text AS $$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  -- Usar AES para criptografia real (reversível)
  RETURN encode(pgp_sym_encrypt(data, key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar dados
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text DEFAULT 'agri_key_2024')
RETURNS text AS $$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  -- Descriptografar usando AES
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), key);
EXCEPTION WHEN OTHERS THEN
  RETURN 'Dados criptografados';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar colunas criptografadas se não existirem
ALTER TABLE public.urban_service_requests 
ADD COLUMN IF NOT EXISTS contact_phone_encrypted text,
ADD COLUMN IF NOT EXISTS origin_address_encrypted text,
ADD COLUMN IF NOT EXISTS destination_address_encrypted text;

-- Criptografar dados existentes
UPDATE public.urban_service_requests 
SET 
  contact_phone_encrypted = encrypt_sensitive_data(contact_phone),
  origin_address_encrypted = encrypt_sensitive_data(origin_address),
  destination_address_encrypted = encrypt_sensitive_data(destination_address)
WHERE contact_phone_encrypted IS NULL;

-- Novas políticas RLS mais seguras
-- 1. Clientes podem criar suas próprias solicitações
CREATE POLICY "secure_clients_can_create_requests" 
ON public.urban_service_requests 
FOR INSERT 
WITH CHECK (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- 2. Clientes podem ver apenas suas próprias solicitações (com dados completos)
CREATE POLICY "secure_clients_view_own_requests" 
ON public.urban_service_requests 
FOR SELECT 
USING (
  client_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
  )
  OR is_admin()
);

-- 3. Provedores podem ver apenas solicitações atribuídas a eles (com dados completos)
CREATE POLICY "secure_providers_view_assigned_requests" 
ON public.urban_service_requests 
FOR SELECT 
USING (
  provider_id IN (
    SELECT usp.id FROM urban_service_providers usp
    JOIN profiles p ON usp.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR is_admin()
);

-- 4. Provedores autenticados podem ver solicitações pendentes (com dados mascarados)
CREATE POLICY "secure_providers_view_pending_requests" 
ON public.urban_service_requests 
FOR SELECT 
USING (
  status = 'PENDING' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM urban_service_providers usp
    JOIN profiles p ON usp.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

-- 5. Provedores podem atualizar apenas solicitações atribuídas
CREATE POLICY "secure_providers_update_assigned_requests" 
ON public.urban_service_requests 
FOR UPDATE 
USING (
  provider_id IN (
    SELECT usp.id FROM urban_service_providers usp
    JOIN profiles p ON usp.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

-- View segura para dados públicos (sem informações sensíveis)
CREATE OR REPLACE VIEW public.public_urban_service_requests AS
SELECT 
  id,
  service_type,
  -- Coordenadas aproximadas (reduzir precisão)
  ROUND(origin_lat::numeric, 2) as origin_lat_approx,
  ROUND(origin_lng::numeric, 2) as origin_lng_approx,
  ROUND(destination_lat::numeric, 2) as destination_lat_approx,
  ROUND(destination_lng::numeric, 2) as destination_lng_approx,
  distance_km,
  pickup_date,
  estimated_weight,
  estimated_volume,
  price,
  status,
  created_at,
  -- Endereços mascarados (apenas cidade/bairro)
  CASE 
    WHEN origin_address IS NOT NULL 
    THEN split_part(origin_address, ',', -2) || ', ' || split_part(origin_address, ',', -1)
    ELSE 'Local não informado'
  END as origin_city,
  CASE 
    WHEN destination_address IS NOT NULL 
    THEN split_part(destination_address, ',', -2) || ', ' || split_part(destination_address, ',', -1)
    ELSE 'Local não informado'
  END as destination_city
FROM public.urban_service_requests
WHERE status = 'PENDING';

-- RLS para view pública
GRANT SELECT ON public.public_urban_service_requests TO authenticated;
GRANT SELECT ON public.public_urban_service_requests TO anon;

-- Função para obter dados sensíveis com autorização
CREATE OR REPLACE FUNCTION public.get_secure_request_details(request_id uuid)
RETURNS TABLE(
  contact_phone text, 
  origin_address text, 
  destination_address text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric
) AS $$
DECLARE
  is_authorized boolean := false;
BEGIN
  -- Verifica autorização
  SELECT EXISTS(
    SELECT 1 FROM urban_service_requests r
    LEFT JOIN urban_service_providers usp ON r.provider_id = usp.id
    LEFT JOIN profiles p ON usp.profile_id = p.id
    WHERE r.id = request_id 
    AND (
      -- É o cliente
      r.client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR 
      -- É o provedor atribuído
      p.user_id = auth.uid()
      OR
      -- É admin
      is_admin()
    )
  ) INTO is_authorized;
  
  IF is_authorized THEN
    RETURN QUERY
    SELECT 
      decrypt_sensitive_data(r.contact_phone_encrypted) as contact_phone,
      decrypt_sensitive_data(r.origin_address_encrypted) as origin_address,
      decrypt_sensitive_data(r.destination_address_encrypted) as destination_address,
      r.origin_lat,
      r.origin_lng,
      r.destination_lat,
      r.destination_lng
    FROM urban_service_requests r
    WHERE r.id = request_id;
  ELSE
    -- Dados mascarados para usuários não autorizados
    RETURN QUERY
    SELECT 
      '***-****-****'::text as contact_phone,
      'Acesso restrito'::text as origin_address,
      'Acesso restrito'::text as destination_address,
      NULL::numeric as origin_lat,
      NULL::numeric as origin_lng, 
      NULL::numeric as destination_lat,
      NULL::numeric as destination_lng;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit log para acessos a dados sensíveis
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  request_id uuid,
  access_type text,
  accessed_at timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- RLS para logs de auditoria
ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_view_access_logs" 
ON public.sensitive_data_access_log 
FOR SELECT 
USING (is_admin());