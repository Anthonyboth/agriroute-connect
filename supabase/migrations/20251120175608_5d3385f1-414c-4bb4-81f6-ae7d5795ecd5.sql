-- ========================================
-- CORREÇÃO: Atualizar CHECK CONSTRAINT para 90 toneladas
-- ========================================
-- Este script corrige o limite de peso na CHECK CONSTRAINT
-- para alinhar com a função trigger e o frontend (90 toneladas)

-- Remover constraint antiga com limite de 50 toneladas
ALTER TABLE freights 
DROP CONSTRAINT IF EXISTS check_weight_realistic;

-- Adicionar constraint atualizada com limite de 90 toneladas
ALTER TABLE freights 
ADD CONSTRAINT check_weight_realistic 
CHECK (weight >= 100 AND weight <= 90000);

-- Atualizar comentário da coluna
COMMENT ON COLUMN freights.weight IS 'Peso da carga em QUILOGRAMAS (kg). Mínimo: 100kg, Máximo: 90.000kg (90 toneladas)';