-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS PERMISSIVAS PARA PRODUÇÃO
-- =====================================================

-- 1. GUEST_REQUESTS: Permitir INSERT apenas com validação básica
-- Colunas: contact_name, contact_phone, request_type, payload, status
DROP POLICY IF EXISTS "guest_requests_public_insert" ON public.guest_requests;
CREATE POLICY "guest_requests_validated_insert" 
ON public.guest_requests 
FOR INSERT 
WITH CHECK (
  -- Validar campos obrigatórios
  contact_phone IS NOT NULL AND 
  contact_phone != '' AND
  LENGTH(contact_phone) <= 20 AND
  request_type IS NOT NULL AND
  payload IS NOT NULL AND
  (contact_name IS NULL OR LENGTH(contact_name) <= 200)
);

-- 2. PROSPECT_USERS: Permitir INSERT apenas com validação de dados
-- Colunas: full_name, email, phone, document, document_type
DROP POLICY IF EXISTS "prospect_users_public_insert" ON public.prospect_users;
CREATE POLICY "prospect_users_validated_insert" 
ON public.prospect_users 
FOR INSERT 
WITH CHECK (
  -- Validar campos obrigatórios e limites
  full_name IS NOT NULL AND
  full_name != '' AND
  LENGTH(full_name) <= 200 AND
  phone IS NOT NULL AND
  LENGTH(phone) <= 20 AND
  document IS NOT NULL AND
  document_type IS NOT NULL AND
  (email IS NULL OR LENGTH(email) <= 255)
);

-- 3. INSPECTION_ACCESS_LOGS: Apenas service_role pode inserir (logs de sistema)
-- Colunas: qr_code_hash, freight_id, ip_address, user_agent, etc.
DROP POLICY IF EXISTS "inspection_access_logs_service_insert" ON public.inspection_access_logs;

-- Policy para service_role (edge functions e sistema)
CREATE POLICY "inspection_access_logs_service_role_insert" 
ON public.inspection_access_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Policy para anon com validação (acesso público via QR code)
CREATE POLICY "inspection_access_logs_public_insert" 
ON public.inspection_access_logs 
FOR INSERT 
TO anon
WITH CHECK (
  qr_code_hash IS NOT NULL AND
  LENGTH(qr_code_hash) <= 100 AND
  (user_agent IS NULL OR LENGTH(user_agent) <= 500)
);

-- 4. CDC_MARK_READ_BY_RECIPIENT: Corrigir WITH CHECK para UPDATE
DROP POLICY IF EXISTS "cdc_mark_read_by_recipient" ON public.company_driver_chats;
CREATE POLICY "cdc_mark_read_by_recipient" 
ON public.company_driver_chats 
FOR UPDATE 
TO authenticated
USING (
  (
    sender_type = 'DRIVER' AND 
    EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = company_driver_chats.company_id 
      AND tc.profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  ) 
  OR 
  (
    sender_type = 'COMPANY' AND 
    driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  (
    sender_type = 'DRIVER' AND 
    EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = company_driver_chats.company_id 
      AND tc.profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  ) 
  OR 
  (
    sender_type = 'COMPANY' AND 
    driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);