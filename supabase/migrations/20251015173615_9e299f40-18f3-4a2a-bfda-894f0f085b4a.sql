-- Permitir NULL em driver_area_id da tabela freight_matches
-- pois agora usamos user_cities ao invés de driver_service_areas

ALTER TABLE freight_matches 
ALTER COLUMN driver_area_id DROP NOT NULL;