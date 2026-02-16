-- Adicionar coluna pricing_type à tabela freights
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'FIXED';

-- Comentário para documentação
COMMENT ON COLUMN public.freights.pricing_type IS 'Tipo de precificação: FIXED, PER_KM ou PER_TON';

-- Atualizar fretes existentes que têm price_per_km preenchido como PER_KM
UPDATE public.freights SET pricing_type = 'PER_KM' WHERE price_per_km IS NOT NULL AND price_per_km > 0;