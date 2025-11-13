-- Migration: Criar tabela financial_transactions para gestão financeira de transportadoras
-- Armazena transações de crédito e débito com rastreamento de status

CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'FAILED')),
  freight_id UUID REFERENCES freights(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Criar índices para otimizar queries comuns
CREATE INDEX idx_financial_transactions_company_id ON financial_transactions(company_id);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX idx_financial_transactions_status ON financial_transactions(status);
CREATE INDEX idx_financial_transactions_created_at ON financial_transactions(created_at DESC);
CREATE INDEX idx_financial_transactions_freight_id ON financial_transactions(freight_id) WHERE freight_id IS NOT NULL;

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON financial_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Transportadoras podem ver apenas suas próprias transações
CREATE POLICY "Transportadoras veem apenas suas transações" ON financial_transactions
FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policy: Transportadoras podem inserir transações em suas empresas
CREATE POLICY "Transportadoras inserem suas transações" ON financial_transactions
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT id FROM transport_companies
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policy: Transportadoras podem atualizar status de suas transações
CREATE POLICY "Transportadoras atualizam suas transações" ON financial_transactions
FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policy: Admins podem ver todas as transações
CREATE POLICY "Admins veem todas as transações" ON financial_transactions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Comentários para documentação
COMMENT ON TABLE financial_transactions IS 'Registro de transações financeiras de transportadoras incluindo créditos e débitos';
COMMENT ON COLUMN financial_transactions.type IS 'Tipo da transação: CREDIT (entrada) ou DEBIT (saída)';
COMMENT ON COLUMN financial_transactions.status IS 'Status: PENDING (aguardando), COMPLETED (concluída), CANCELLED (cancelada), FAILED (falhou)';
COMMENT ON COLUMN financial_transactions.metadata IS 'Dados adicionais em formato JSON para rastreamento flexível';