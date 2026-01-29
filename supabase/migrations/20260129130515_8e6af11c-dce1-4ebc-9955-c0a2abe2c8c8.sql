-- ================================================================
-- CORREÇÃO: Atualizar status de freight_assignments incorretos
-- Problema: Assignments aceitos foram criados com status 'OPEN' 
-- em vez de 'ACCEPTED', causando inconsistência no frontend
-- ================================================================

-- Atualizar assignments que foram aceitos via proposta ACCEPTED 
-- mas ficaram com status OPEN por algum bug
UPDATE freight_assignments fa
SET 
  status = 'ACCEPTED',
  updated_at = NOW()
WHERE fa.status = 'OPEN'
  AND EXISTS (
    SELECT 1 FROM freight_proposals fp
    WHERE fp.freight_id = fa.freight_id
      AND fp.driver_id = fa.driver_id
      AND fp.status = 'ACCEPTED'
  );

-- Especificamente corrigir o assignment identificado
UPDATE freight_assignments
SET 
  status = 'ACCEPTED',
  updated_at = NOW()
WHERE id = '44d05f74-74b7-4ced-93f8-08bfc3db76e7'
  AND status = 'OPEN';

-- Adicionar constraint de validação para evitar status inválido no futuro
-- (freight_assignments criados devem ter status válido)
DO $$
BEGIN
  -- Verificar se já existe a constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'freight_assignments_status_valid'
  ) THEN
    -- A constraint não pode usar CHECK para tipo enum, então ignoramos
    NULL;
  END IF;
END $$;