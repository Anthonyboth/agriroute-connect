-- Criar tabela para rastrear solicitações de documentos
CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  driver_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_pending_request UNIQUE (company_id, driver_profile_id, status)
);

-- Comentário na tabela
COMMENT ON TABLE document_requests IS 'Solicitações de documentos de transportadoras para motoristas afiliados';

-- Índices para performance
CREATE INDEX idx_document_requests_company ON document_requests(company_id);
CREATE INDEX idx_document_requests_driver ON document_requests(driver_profile_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);

-- Habilitar RLS
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Transportadoras veem suas solicitações
CREATE POLICY "companies_view_own_requests"
ON document_requests FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Policy: Transportadoras criam/atualizam solicitações
CREATE POLICY "companies_manage_requests"
ON document_requests FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Policy: Motoristas veem suas solicitações
CREATE POLICY "drivers_view_own_requests"
ON document_requests FOR SELECT
TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Policy: Motoristas atualizam suas solicitações (apenas status e completed_at)
CREATE POLICY "drivers_update_own_requests"
ON document_requests FOR UPDATE
TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);