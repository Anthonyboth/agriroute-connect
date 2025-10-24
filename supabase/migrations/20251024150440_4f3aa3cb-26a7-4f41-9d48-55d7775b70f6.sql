-- =========================================
-- ATUALIZAR CONSTRAINT DE STATUS
-- freight_assignments_status_check
-- =========================================
-- Adiciona suporte para estados intermediários LOADING e LOADED
-- necessários para fretes multi-caminhão

-- Remove constraint antiga
ALTER TABLE freight_assignments 
DROP CONSTRAINT IF EXISTS freight_assignments_status_check;

-- Adiciona constraint nova com todos os status necessários
ALTER TABLE freight_assignments
ADD CONSTRAINT freight_assignments_status_check
CHECK (status IN (
  'ACCEPTED',
  'LOADING',          -- Motorista iniciou carregamento
  'LOADED',           -- Carga carregada, pronto para partir
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'CANCELLED'
));

-- Adicionar comentário explicativo
COMMENT ON CONSTRAINT freight_assignments_status_check ON freight_assignments IS 
'Constraint atualizada para suportar estados intermediários LOADING e LOADED necessários para fretes multi-caminhão';

-- =========================================
-- VERIFICAÇÃO DE DADOS EXISTENTES
-- =========================================

-- Verificar se há assignments com status que não serão permitidos
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM freight_assignments
  WHERE status NOT IN (
    'ACCEPTED',
    'LOADING',
    'LOADED',
    'IN_TRANSIT',
    'DELIVERED_PENDING_CONFIRMATION',
    'DELIVERED',
    'CANCELLED'
  );
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros com status inválido. Normalizando para ACCEPTED...', invalid_count;
    
    -- Normalizar status inválidos para ACCEPTED
    UPDATE freight_assignments
    SET status = 'ACCEPTED'
    WHERE status NOT IN (
      'ACCEPTED',
      'LOADING',
      'LOADED',
      'IN_TRANSIT',
      'DELIVERED_PENDING_CONFIRMATION',
      'DELIVERED',
      'CANCELLED'
    );
    
    RAISE NOTICE 'Status normalizados com sucesso.';
  ELSE
    RAISE NOTICE 'Nenhum registro com status inválido encontrado.';
  END IF;
END $$;