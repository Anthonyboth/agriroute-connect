-- Adicionar coluna para distância manual informada pelo usuário
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS distancia_km_manual NUMERIC;

-- Comentário explicativo
COMMENT ON COLUMN public.freights.distancia_km_manual IS 'Distância em km informada manualmente pelo usuário. Se preenchida, prevalece sobre cálculos automáticos (OSRM/Haversine).';