-- Adicionar constraint única na tabela freight_matches para corrigir o UPSERT
-- Isso corrigirá o erro: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

ALTER TABLE freight_matches 
ADD CONSTRAINT unique_freight_driver_match 
UNIQUE (freight_id, driver_id, driver_area_id);