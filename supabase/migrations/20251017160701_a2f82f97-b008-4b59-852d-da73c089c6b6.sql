-- 1. Criar tabela prospect_users
CREATE TABLE prospect_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL CHECK (document_type IN ('CPF', 'CNPJ')),
  last_city TEXT,
  last_state TEXT,
  total_requests INTEGER DEFAULT 0,
  first_request_date TIMESTAMPTZ DEFAULT NOW(),
  last_request_date TIMESTAMPTZ DEFAULT NOW(),
  converted_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  blacklist_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para prospect_users
CREATE INDEX idx_prospect_users_document ON prospect_users(document);
CREATE INDEX idx_prospect_users_email ON prospect_users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_prospect_users_phone ON prospect_users(phone);
CREATE INDEX idx_prospect_users_converted ON prospect_users(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;

-- RLS para prospect_users
ALTER TABLE prospect_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage prospect users"
ON prospect_users FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view prospect users"
ON prospect_users FOR SELECT
USING (is_admin());

-- Trigger updated_at
CREATE TRIGGER update_prospect_users_updated_at
  BEFORE UPDATE ON prospect_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Adicionar campos em service_requests
ALTER TABLE service_requests 
  ADD COLUMN contact_email TEXT,
  ADD COLUMN contact_document TEXT,
  ADD COLUMN prospect_user_id UUID REFERENCES prospect_users(id) ON DELETE SET NULL;

CREATE INDEX idx_service_requests_prospect ON service_requests(prospect_user_id) WHERE prospect_user_id IS NOT NULL;
CREATE INDEX idx_service_requests_document ON service_requests(contact_document) WHERE contact_document IS NOT NULL;

-- 3. Adicionar campos em freights
ALTER TABLE freights 
  ADD COLUMN is_guest_freight BOOLEAN DEFAULT FALSE,
  ADD COLUMN prospect_user_id UUID REFERENCES prospect_users(id) ON DELETE SET NULL,
  ADD COLUMN guest_contact_name TEXT,
  ADD COLUMN guest_contact_phone TEXT,
  ADD COLUMN guest_contact_email TEXT,
  ADD COLUMN guest_contact_document TEXT,
  ADD COLUMN allow_counter_proposals BOOLEAN DEFAULT TRUE,
  ADD COLUMN show_contact_after_accept BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_freights_prospect ON freights(prospect_user_id) WHERE prospect_user_id IS NOT NULL;
CREATE INDEX idx_freights_guest ON freights(is_guest_freight) WHERE is_guest_freight = TRUE;

-- 4. Atualizar RLS Policy para freights permitir guests
DROP POLICY IF EXISTS "Producers can create freights" ON freights;

CREATE POLICY "Users can create freights including guests"
ON freights FOR INSERT
WITH CHECK (
  -- Usuário autenticado como produtor
  (auth.uid() IS NOT NULL AND producer_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  OR
  -- Guest user (producer_id NULL)
  (producer_id IS NULL AND is_guest_freight = TRUE)
);