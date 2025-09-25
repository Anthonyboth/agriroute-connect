-- Verificar e corrigir a constraint de match_type na tabela freight_matches
-- O valor 'SPATIAL_RADIUS' está sendo rejeitado pela constraint

-- Primeiro, vamos verificar os valores únicos de match_type existentes
-- SELECT DISTINCT match_type FROM freight_matches;

-- Remover a constraint existente que está causando problemas
ALTER TABLE freight_matches DROP CONSTRAINT IF EXISTS freight_matches_match_type_check;

-- Recriar a constraint com os valores corretos incluindo 'SPATIAL_RADIUS'
ALTER TABLE freight_matches 
ADD CONSTRAINT freight_matches_match_type_check 
CHECK (match_type IN ('CITY_MATCH', 'RADIUS_MATCH', 'SPATIAL_MATCH', 'SPATIAL_RADIUS', 'EXACT_MATCH', 'PROXIMITY_MATCH'));