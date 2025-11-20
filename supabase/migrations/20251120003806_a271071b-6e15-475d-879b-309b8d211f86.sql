-- Criar tabela de documentos NF-e
CREATE TABLE IF NOT EXISTS nfe_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_key VARCHAR(44) UNIQUE NOT NULL,
  issuer_cnpj VARCHAR(14) NOT NULL,
  issuer_name VARCHAR(255) NOT NULL,
  number VARCHAR(9) NOT NULL,
  series VARCHAR(3) NOT NULL,
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  manifestation_type VARCHAR(30),
  manifestation_date TIMESTAMP WITH TIME ZONE,
  manifestation_justification TEXT,
  freight_id UUID REFERENCES freights(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_access_key ON nfe_documents(access_key);
CREATE INDEX IF NOT EXISTS idx_nfe_status ON nfe_documents(status);
CREATE INDEX IF NOT EXISTS idx_nfe_freight_id ON nfe_documents(freight_id);
CREATE INDEX IF NOT EXISTS idx_nfe_issuer_cnpj ON nfe_documents(issuer_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfe_created_by ON nfe_documents(created_by);

-- Habilitar RLS
ALTER TABLE nfe_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários veem suas próprias NF-es
CREATE POLICY "Users can view own NFes" ON nfe_documents
  FOR SELECT 
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Usuários podem inserir NF-es
CREATE POLICY "Users can insert NFes" ON nfe_documents
  FOR INSERT 
  WITH CHECK (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Usuários podem atualizar suas NF-es
CREATE POLICY "Users can update own NFes" ON nfe_documents
  FOR UPDATE 
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admins podem ver todas
CREATE POLICY "Admins can view all NFes" ON nfe_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_nfe_updated_at 
  BEFORE UPDATE ON nfe_documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();