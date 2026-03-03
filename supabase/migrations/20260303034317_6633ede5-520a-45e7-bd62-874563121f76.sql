-- Backfill destination_city and destination_state for seed freights
-- Extract city name from destination_address pattern "CityName - Destino Seed N"

UPDATE public.freights
SET 
  destination_city = TRIM(SPLIT_PART(destination_address, ' - ', 1)),
  destination_state = CASE 
    WHEN TRIM(SPLIT_PART(destination_address, ' - ', 1)) IN ('Goiânia') THEN 'GO'
    WHEN TRIM(SPLIT_PART(destination_address, ' - ', 1)) IN ('Campo Grande') THEN 'MS'
    ELSE 'MT'
  END
WHERE destination_city IS NULL 
  AND destination_state IS NULL 
  AND destination_address IS NOT NULL
  AND destination_address LIKE '% - Destino Seed %';
