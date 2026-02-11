-- Adicionar campo distance_source à tabela freights
-- Armazena a origem do cálculo de distância: 'manual', 'auto_osrm', 'auto_haversine'
ALTER TABLE public.freights 
ADD COLUMN IF NOT EXISTS distance_source TEXT DEFAULT NULL;

-- Comentário descritivo
COMMENT ON COLUMN public.freights.distance_source IS 'Origem do valor de distance_km: manual, auto_osrm, auto_haversine';