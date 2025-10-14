-- Adicionar campo affiliation_type para diferenciar motoristas empregados de afiliados
ALTER TABLE company_drivers 
ADD COLUMN affiliation_type TEXT DEFAULT 'EMPLOYEE' 
CHECK (affiliation_type IN ('EMPLOYEE', 'AFFILIATED'));

-- Criar índice para melhorar performance de queries
CREATE INDEX idx_company_drivers_affiliation_type ON company_drivers(affiliation_type);

-- Comentário explicativo
COMMENT ON COLUMN company_drivers.affiliation_type IS 'Tipo de afiliação: EMPLOYEE (convite da transportadora) ou AFFILIATED (auto-cadastro do motorista)';

-- Atualizar motoristas existentes que não têm invited_by (auto-cadastro) como AFFILIATED
UPDATE company_drivers 
SET affiliation_type = 'AFFILIATED' 
WHERE invited_by IS NULL;