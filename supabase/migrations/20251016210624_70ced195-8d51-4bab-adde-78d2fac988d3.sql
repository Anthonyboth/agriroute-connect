-- Criar tabela de logs de erro
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Informações do erro
  error_type VARCHAR(50) NOT NULL, -- 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'NETWORK' | 'PAYMENT'
  error_category VARCHAR(50) NOT NULL, -- 'SIMPLE' | 'CRITICAL'
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_code VARCHAR(20),
  
  -- Contexto
  module VARCHAR(100), -- nome do componente/arquivo
  function_name VARCHAR(100), -- função onde ocorreu
  route VARCHAR(255), -- rota da aplicação
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  
  -- Tentativa de correção
  auto_correction_attempted BOOLEAN DEFAULT FALSE,
  auto_correction_action TEXT,
  auto_correction_success BOOLEAN,
  
  -- Status
  status VARCHAR(20) DEFAULT 'NEW', -- 'NEW' | 'AUTO_FIXED' | 'PERSISTENT' | 'NOTIFIED' | 'RESOLVED'
  telegram_notified BOOLEAN DEFAULT FALSE,
  telegram_sent_at TIMESTAMPTZ,
  
  -- Metadados adicionais
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraint
  CONSTRAINT error_logs_status_check CHECK (status IN ('NEW', 'AUTO_FIXED', 'PERSISTENT', 'NOTIFIED', 'RESOLVED'))
);

-- Índices para busca rápida
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_status ON error_logs(status);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_telegram_notified ON error_logs(telegram_notified);

-- RLS Policies (apenas admins)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Tabela de fila para mensagens do Telegram
CREATE TABLE IF NOT EXISTS telegram_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT NOT NULL,
  error_log_id UUID REFERENCES error_logs(id) ON DELETE CASCADE,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING' | 'SENT' | 'FAILED'
  
  CONSTRAINT telegram_queue_status_check CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX idx_telegram_queue_status ON telegram_message_queue(status);
CREATE INDEX idx_telegram_queue_created_at ON telegram_message_queue(created_at DESC);

ALTER TABLE telegram_message_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage telegram queue"
  ON telegram_message_queue FOR ALL
  USING (true)
  WITH CHECK (true);