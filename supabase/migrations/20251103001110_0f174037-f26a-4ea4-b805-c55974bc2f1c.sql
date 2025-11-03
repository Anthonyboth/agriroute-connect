-- =========================================
-- MIGRATION: Correção de Pesos e Validações (v2)
-- =========================================

-- 1. Criar tabela de backup
CREATE TABLE IF NOT EXISTS freights_weight_backup (
  id UUID,
  old_weight NUMERIC,
  new_weight NUMERIC,
  correction_type TEXT,
  corrected_at TIMESTAMP DEFAULT NOW()
);

-- 2. Aplicar correções em transação com triggers desabilitados
DO $$
DECLARE
  count_divided INTEGER := 0;
  count_too_small INTEGER := 0;
  count_too_large INTEGER := 0;
BEGIN
  -- Backup e correção de valores muito grandes (provavelmente em kg)
  INSERT INTO freights_weight_backup (id, old_weight, new_weight, correction_type)
  SELECT 
    id,
    weight as old_weight,
    weight / 1000 as new_weight,
    'DIVIDED_BY_1000'
  FROM freights
  WHERE weight > 100000 
    AND weight < 10000000;
  
  GET DIAGNOSTICS count_divided = ROW_COUNT;
  
  -- Backup de valores muito pequenos (< 100kg)
  INSERT INTO freights_weight_backup (id, old_weight, new_weight, correction_type)
  SELECT 
    id,
    weight as old_weight,
    100 as new_weight,
    'SET_TO_MINIMUM'
  FROM freights
  WHERE weight > 0 AND weight < 100 AND weight NOT IN (
    SELECT old_weight FROM freights_weight_backup
  );
  
  GET DIAGNOSTICS count_too_small = ROW_COUNT;
  
  -- Backup de valores muito grandes (> 50 toneladas, mas não na faixa de divisão)
  INSERT INTO freights_weight_backup (id, old_weight, new_weight, correction_type)
  SELECT 
    id,
    weight as old_weight,
    50000 as new_weight,
    'SET_TO_MAXIMUM'
  FROM freights
  WHERE weight > 50000 AND weight <= 100000;
  
  GET DIAGNOSTICS count_too_large = ROW_COUNT;
  
  -- Desabilitar triggers temporariamente
  SET LOCAL session_replication_role = replica;
  
  -- Aplicar correções
  -- 1. Dividir por 1000 (valores muito grandes)
  UPDATE freights 
  SET weight = weight / 1000
  WHERE weight > 100000 AND weight < 10000000;
  
  -- 2. Corrigir valores muito pequenos
  UPDATE freights
  SET weight = 100
  WHERE weight > 0 AND weight < 100;
  
  -- 3. Corrigir valores muito grandes
  UPDATE freights
  SET weight = 50000
  WHERE weight > 50000;
  
  -- Reabilitar triggers
  SET LOCAL session_replication_role = DEFAULT;
  
  RAISE NOTICE '📊 Correções aplicadas:';
  RAISE NOTICE '  - Divididos por 1000: %', count_divided;
  RAISE NOTICE '  - Ajustados para mínimo (100kg): %', count_too_small;
  RAISE NOTICE '  - Ajustados para máximo (50t): %', count_too_large;
END $$;

-- 3. Adicionar constraint de validação
ALTER TABLE freights 
DROP CONSTRAINT IF EXISTS check_weight_realistic;

ALTER TABLE freights 
ADD CONSTRAINT check_weight_realistic 
CHECK (weight >= 100 AND weight <= 50000);

-- 4. Adicionar índice
CREATE INDEX IF NOT EXISTS idx_freights_weight ON freights(weight);

-- 5. Adicionar comentário
COMMENT ON COLUMN freights.weight IS 'Peso da carga em QUILOGRAMAS (kg). Mínimo: 100kg, Máximo: 50.000kg (50 toneladas)';

-- 6. Criar função de validação
CREATE OR REPLACE FUNCTION validate_freight_weight()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.weight < 100 THEN
    RAISE EXCEPTION 'Peso mínimo: 100kg (0.1 toneladas)';
  END IF;
  
  IF NEW.weight > 50000 THEN
    RAISE EXCEPTION 'Peso máximo: 50.000kg (50 toneladas)';
  END IF;
  
  IF NEW.weight > 45000 THEN
    RAISE WARNING 'Peso muito alto: % kg. Confirme se está correto.', NEW.weight;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Aplicar trigger
DROP TRIGGER IF EXISTS trigger_validate_freight_weight ON freights;

CREATE TRIGGER trigger_validate_freight_weight
BEFORE INSERT OR UPDATE OF weight ON freights
FOR EACH ROW
EXECUTE FUNCTION validate_freight_weight();

-- 8. Relatório final
DO $$
DECLARE
  total_corrections INTEGER;
  min_weight NUMERIC;
  max_weight NUMERIC;
  avg_weight NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_corrections FROM freights_weight_backup;
  SELECT MIN(weight), MAX(weight), AVG(weight) INTO min_weight, max_weight, avg_weight FROM freights;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ MIGRATION CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '📊 Total de correções: %', total_corrections;
  RAISE NOTICE '⚖️  Estatísticas atuais:';
  RAISE NOTICE '   - Peso mínimo: % kg', ROUND(min_weight, 2);
  RAISE NOTICE '   - Peso máximo: % kg', ROUND(max_weight, 2);
  RAISE NOTICE '   - Peso médio: % kg', ROUND(avg_weight, 2);
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🛡️  Validações ativas:';
  RAISE NOTICE '   - Constraint: check_weight_realistic';
  RAISE NOTICE '   - Trigger: validate_freight_weight()';
  RAISE NOTICE '⚡ Índice criado: idx_freights_weight';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
END $$;