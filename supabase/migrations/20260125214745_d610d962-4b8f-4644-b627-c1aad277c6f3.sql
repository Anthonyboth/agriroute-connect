-- ============================================
-- P0 FIX: Eliminar cidades duplicadas no banco
-- ============================================

-- Cidade duplicada identificada:
-- BAD:  id = '4e1c257c-de17-40bb-8958-e1a7f43523ae', state = 'Mato Grosso', NO ibge_code
-- GOOD: id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8', state = 'MT', ibge_code = 5107040

-- 1) MIGRAR referências para o registro canônico
UPDATE service_requests 
SET city_id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8'
WHERE city_id = '4e1c257c-de17-40bb-8958-e1a7f43523ae';

UPDATE freights 
SET origin_city_id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8'
WHERE origin_city_id = '4e1c257c-de17-40bb-8958-e1a7f43523ae';

UPDATE freights 
SET destination_city_id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8'
WHERE destination_city_id = '4e1c257c-de17-40bb-8958-e1a7f43523ae';

UPDATE driver_availability 
SET city_id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8'
WHERE city_id = '4e1c257c-de17-40bb-8958-e1a7f43523ae';

UPDATE user_cities 
SET city_id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8'
WHERE city_id = '4e1c257c-de17-40bb-8958-e1a7f43523ae';

-- 2) REMOVER registro duplicado
DELETE FROM cities 
WHERE id = '4e1c257c-de17-40bb-8958-e1a7f43523ae';

-- 3) NORMALIZAR todos os estados por extenso para UF
UPDATE cities SET state = 'MT' WHERE LOWER(state) = 'mato grosso';
UPDATE cities SET state = 'MS' WHERE LOWER(state) = 'mato grosso do sul';
UPDATE cities SET state = 'SP' WHERE LOWER(state) IN ('sao paulo', 'são paulo');
UPDATE cities SET state = 'RJ' WHERE LOWER(state) = 'rio de janeiro';
UPDATE cities SET state = 'MG' WHERE LOWER(state) = 'minas gerais';
UPDATE cities SET state = 'PR' WHERE LOWER(state) IN ('parana', 'paraná');
UPDATE cities SET state = 'RS' WHERE LOWER(state) = 'rio grande do sul';
UPDATE cities SET state = 'BA' WHERE LOWER(state) = 'bahia';
UPDATE cities SET state = 'GO' WHERE LOWER(state) IN ('goias', 'goiás');
UPDATE cities SET state = 'SC' WHERE LOWER(state) = 'santa catarina';
UPDATE cities SET state = 'PE' WHERE LOWER(state) = 'pernambuco';
UPDATE cities SET state = 'CE' WHERE LOWER(state) IN ('ceara', 'ceará');
UPDATE cities SET state = 'PA' WHERE LOWER(state) IN ('para', 'pará');
UPDATE cities SET state = 'MA' WHERE LOWER(state) IN ('maranhao', 'maranhão');
UPDATE cities SET state = 'AM' WHERE LOWER(state) = 'amazonas';
UPDATE cities SET state = 'ES' WHERE LOWER(state) IN ('espirito santo', 'espírito santo');
UPDATE cities SET state = 'PB' WHERE LOWER(state) IN ('paraiba', 'paraíba');
UPDATE cities SET state = 'RN' WHERE LOWER(state) = 'rio grande do norte';
UPDATE cities SET state = 'PI' WHERE LOWER(state) IN ('piaui', 'piauí');
UPDATE cities SET state = 'AL' WHERE LOWER(state) = 'alagoas';
UPDATE cities SET state = 'SE' WHERE LOWER(state) = 'sergipe';
UPDATE cities SET state = 'RO' WHERE LOWER(state) IN ('rondonia', 'rondônia');
UPDATE cities SET state = 'TO' WHERE LOWER(state) = 'tocantins';
UPDATE cities SET state = 'AC' WHERE LOWER(state) = 'acre';
UPDATE cities SET state = 'AP' WHERE LOWER(state) IN ('amapa', 'amapá');
UPDATE cities SET state = 'RR' WHERE LOWER(state) = 'roraima';
UPDATE cities SET state = 'DF' WHERE LOWER(state) = 'distrito federal';

-- 4) Garantir UPPERCASE para todos os estados
UPDATE cities SET state = UPPER(state) WHERE state != UPPER(state);

-- 5) Adicionar constraint CHECK para garantir que state é sempre UF (2 letras)
-- Drop if exists first to be safe
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cities_state_uf_check') THEN
    ALTER TABLE cities DROP CONSTRAINT cities_state_uf_check;
  END IF;
END $$;

ALTER TABLE cities ADD CONSTRAINT cities_state_uf_check 
CHECK (LENGTH(state) = 2 AND state = UPPER(state));

-- 6) Criar unique index para prevenir futuras duplicatas (nome normalizado + UF)
DROP INDEX IF EXISTS cities_name_state_unique;
DROP INDEX IF EXISTS cities_name_state_unique_v2;

CREATE UNIQUE INDEX cities_name_state_unique_idx 
ON cities (LOWER(TRIM(name)), state);