-- Corrigir problemas de segurança detectados pelo linter

-- 1. Corrigir search_path nas funções de criptografia
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT 'agri_key_2024')
RETURNS text AS $$
BEGIN
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  -- Usar AES para criptografia real (reversível)
  RETURN encode(pgp_sym_encrypt(data, key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Corrigir search_path na função de descriptografia
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Corrigir search_path na função de dados seguros
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Remover a view problemática e recriar sem SECURITY DEFINER
DROP VIEW IF EXISTS public.public_urban_service_requests;

-- Criar uma view mais simples sem SECURITY DEFINER
-- Em vez de uma view, criar uma função que retorna dados públicos
CREATE OR REPLACE FUNCTION public.get_public_service_requests()
RETURNS TABLE(
  id uuid,
  service_type text,
  origin_lat_approx numeric,
  origin_lng_approx numeric,
  destination_lat_approx numeric,
  destination_lng_approx numeric,
  distance_km numeric,
  pickup_date date,
  estimated_weight numeric,
  estimated_volume numeric,
  price numeric,
  status text,
  created_at timestamp with time zone,
  origin_city text,
  destination_city text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.service_type,
    -- Coordenadas aproximadas (reduzir precisão)
    ROUND(r.origin_lat::numeric, 2) as origin_lat_approx,
    ROUND(r.origin_lng::numeric, 2) as origin_lng_approx,
    ROUND(r.destination_lat::numeric, 2) as destination_lat_approx,
    ROUND(r.destination_lng::numeric, 2) as destination_lng_approx,
    r.distance_km,
    r.pickup_date,
    r.estimated_weight,
    r.estimated_volume,
    r.price,
    r.status,
    r.created_at,
    -- Endereços mascarados (apenas cidade/bairro)
    CASE 
      WHEN r.origin_address IS NOT NULL 
      THEN split_part(r.origin_address, ',', -2) || ', ' || split_part(r.origin_address, ',', -1)
      ELSE 'Local não informado'
    END as origin_city,
    CASE 
      WHEN r.destination_address IS NOT NULL 
      THEN split_part(r.destination_address, ',', -2) || ', ' || split_part(r.destination_address, ',', -1)
      ELSE 'Local não informado'
    END as destination_city
  FROM public.urban_service_requests r
  WHERE r.status = 'PENDING';
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Função para auditoria de acessos
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  request_id uuid, 
  access_type text
) RETURNS void AS $$
BEGIN
  INSERT INTO public.sensitive_data_access_log (
    user_id, 
    request_id, 
    access_type,
    accessed_at
  ) VALUES (
    auth.uid(),
    request_id,
    access_type,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para mascarar dados automaticamente em queries não autorizadas
CREATE OR REPLACE FUNCTION public.mask_sensitive_request_data()
RETURNS trigger AS $$
BEGIN
  -- Se não é o cliente nem o provedor atribuído, mascarar dados
  IF NOT (
    NEW.client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR NEW.provider_id IN (
      SELECT usp.id FROM urban_service_providers usp
      JOIN profiles p ON usp.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR is_admin()
  ) THEN
    NEW.contact_phone := '***-****-****';
    NEW.origin_address := split_part(NEW.origin_address, ',', -1);
    NEW.destination_address := split_part(NEW.destination_address, ',', -1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;