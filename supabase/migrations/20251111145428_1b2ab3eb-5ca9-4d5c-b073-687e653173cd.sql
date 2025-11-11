-- Tabela para rastrear lembretes de propostas enviados
CREATE TABLE IF NOT EXISTS proposal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES freight_proposals(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK(reminder_type IN ('24h', '48h')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, reminder_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_proposal_reminders_proposal_id ON proposal_reminders(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_reminders_sent_at ON proposal_reminders(sent_at DESC);

-- RLS Policies
ALTER TABLE proposal_reminders ENABLE ROW LEVEL SECURITY;

-- Admins podem ver todos os reminders
CREATE POLICY "Admins can view all reminders"
  ON proposal_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Sistema pode inserir reminders
CREATE POLICY "System can insert reminders"
  ON proposal_reminders FOR INSERT
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE proposal_reminders IS 'Rastreia lembretes automáticos enviados para propostas pendentes antigas';
COMMENT ON COLUMN proposal_reminders.reminder_type IS 'Tipo de lembrete: 24h ou 48h após criação da proposta';