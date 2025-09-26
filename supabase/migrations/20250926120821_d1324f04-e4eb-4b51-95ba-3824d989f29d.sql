-- Remove a constraint de peso da tabela freights
ALTER TABLE freights DROP CONSTRAINT IF EXISTS freights_weight_check;

-- Remove qualquer trigger de validação de peso
DROP TRIGGER IF EXISTS validate_freight_weight_trigger ON freights;