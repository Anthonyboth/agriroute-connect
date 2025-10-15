-- Criar tabela de preferências de notificação
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Tipos de notificação (cada um pode ser ativado/desativado)
  new_freights_enabled BOOLEAN DEFAULT true,
  new_services_enabled BOOLEAN DEFAULT true,
  proposals_received_enabled BOOLEAN DEFAULT true,
  chat_messages_enabled BOOLEAN DEFAULT true,
  payments_completed_enabled BOOLEAN DEFAULT true,
  
  -- Configurações gerais
  push_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Criar preferências padrão para usuários existentes
INSERT INTO notification_preferences (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;