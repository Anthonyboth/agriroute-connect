-- Corrigir status da Tatinha Transportes (CNPJ: 62965243000111)
-- Este é um fix para corrigir o status pendente mesmo com profile aprovado

UPDATE transport_companies 
SET 
  status = 'APPROVED',
  updated_at = NOW()
WHERE company_cnpj = '62965243000111'
  AND status = 'PENDING';

-- Adicionar comentário explicativo
COMMENT ON TABLE transport_companies IS 'Tabela de transportadoras. O campo status deve ser sincronizado com profiles.status ao aprovar cadastros.';