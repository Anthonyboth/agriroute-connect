-- Blindagem: pricing_type NOT NULL + CHECK constraint
-- Primeiro, garantir que nenhum registro tenha NULL (já confirmado, mas por segurança)
UPDATE freights SET pricing_type = 'FIXED' WHERE pricing_type IS NULL;

-- Tornar NOT NULL
ALTER TABLE freights ALTER COLUMN pricing_type SET NOT NULL;

-- Adicionar CHECK constraint para aceitar apenas valores válidos
ALTER TABLE freights ADD CONSTRAINT freights_pricing_type_check 
  CHECK (pricing_type IN ('FIXED', 'PER_KM', 'PER_TON'));