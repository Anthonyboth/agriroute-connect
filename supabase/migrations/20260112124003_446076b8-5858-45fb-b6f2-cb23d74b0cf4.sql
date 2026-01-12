-- Preencher coordenadas de origem nos fretes usando a tabela cities
UPDATE freights f
SET 
  origin_lat = c.lat,
  origin_lng = c.lng
FROM cities c
WHERE LOWER(TRIM(f.origin_city)) = LOWER(TRIM(c.name))
  AND LOWER(TRIM(f.origin_state)) = LOWER(TRIM(c.state))
  AND f.origin_lat IS NULL
  AND c.lat IS NOT NULL
  AND c.lng IS NOT NULL;

-- Preencher coordenadas de destino nos fretes usando a tabela cities
UPDATE freights f
SET 
  destination_lat = c.lat,
  destination_lng = c.lng
FROM cities c
WHERE LOWER(TRIM(f.destination_city)) = LOWER(TRIM(c.name))
  AND LOWER(TRIM(f.destination_state)) = LOWER(TRIM(c.state))
  AND f.destination_lat IS NULL
  AND c.lat IS NOT NULL
  AND c.lng IS NOT NULL;

-- Fallback: preencher origem apenas por nome da cidade (quando state não combina)
UPDATE freights f
SET 
  origin_lat = c.lat,
  origin_lng = c.lng
FROM cities c
WHERE LOWER(TRIM(f.origin_city)) = LOWER(TRIM(c.name))
  AND f.origin_lat IS NULL
  AND c.lat IS NOT NULL
  AND c.lng IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cities c2 
    WHERE LOWER(TRIM(f.origin_city)) = LOWER(TRIM(c2.name))
    AND LOWER(TRIM(f.origin_state)) = LOWER(TRIM(c2.state))
  );

-- Fallback: preencher destino apenas por nome da cidade
UPDATE freights f
SET 
  destination_lat = c.lat,
  destination_lng = c.lng
FROM cities c
WHERE LOWER(TRIM(f.destination_city)) = LOWER(TRIM(c.name))
  AND f.destination_lat IS NULL
  AND c.lat IS NOT NULL
  AND c.lng IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cities c2 
    WHERE LOWER(TRIM(f.destination_city)) = LOWER(TRIM(c2.name))
    AND LOWER(TRIM(f.destination_state)) = LOWER(TRIM(c2.state))
  );