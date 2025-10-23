-- Criar tabela de chat entre transportadora e motorista
CREATE TABLE IF NOT EXISTS company_driver_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  driver_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('COMPANY', 'DRIVER')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chats_company ON company_driver_chats(company_id);
CREATE INDEX IF NOT EXISTS idx_chats_driver ON company_driver_chats(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_chats_created ON company_driver_chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_unread ON company_driver_chats(is_read) WHERE is_read = FALSE;

-- RLS Policies
ALTER TABLE company_driver_chats ENABLE ROW LEVEL SECURITY;

-- Transportadoras podem ver chats de seus motoristas
CREATE POLICY "companies_view_chats" ON company_driver_chats
  FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM transport_companies WHERE profile_id = auth.uid()
    )
  );

-- Motoristas podem ver chats de suas transportadoras
CREATE POLICY "drivers_view_chats" ON company_driver_chats
  FOR SELECT
  USING (
    driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Transportadoras podem inserir mensagens
CREATE POLICY "companies_insert_chats" ON company_driver_chats
  FOR INSERT
  WITH CHECK (
    sender_type = 'COMPANY' AND
    company_id IN (
      SELECT id FROM transport_companies WHERE profile_id = auth.uid()
    )
  );

-- Motoristas podem inserir mensagens
CREATE POLICY "drivers_insert_chats" ON company_driver_chats
  FOR INSERT
  WITH CHECK (
    sender_type = 'DRIVER' AND
    driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Adicionar campos em company_drivers
ALTER TABLE company_drivers 
ADD COLUMN IF NOT EXISTS chat_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- Atualizar constraint de status para incluir 'LEFT'
DO $$ 
BEGIN
  ALTER TABLE company_drivers DROP CONSTRAINT IF EXISTS company_drivers_status_check;
  ALTER TABLE company_drivers 
  ADD CONSTRAINT company_drivers_status_check 
  CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'LEFT', 'REJECTED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger para habilitar chat 24h após aprovação
CREATE OR REPLACE FUNCTION enable_chat_after_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND (OLD.status = 'PENDING' OR OLD.status IS NULL) THEN
    NEW.chat_enabled_at = NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_enable_trigger ON company_drivers;
CREATE TRIGGER chat_enable_trigger
  BEFORE UPDATE ON company_drivers
  FOR EACH ROW
  EXECUTE FUNCTION enable_chat_after_approval();