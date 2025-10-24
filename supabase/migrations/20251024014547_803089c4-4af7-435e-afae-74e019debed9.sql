-- Corrigir registro existente com service_type 'LAVAGEM'
-- Alterar para 'OUTROS' pois 'LAVAGEM' não é um tipo válido de serviço
UPDATE service_requests 
SET service_type = 'OUTROS'
WHERE service_type = 'LAVAGEM';

-- Adicionar comentário à coluna para documentar os tipos válidos
COMMENT ON COLUMN service_requests.service_type IS 
'Tipos válidos: 38 serviços técnicos/agrícolas (GUINCHO, MUDANCA, ELETRICISTA, MECANICO, BORRACHEIRO, INSTALACAO, etc.) + 4 tipos de frete. NUNCA usar LAVAGEM - este tipo foi removido do sistema.';