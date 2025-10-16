-- =========================================
-- FIX: Trigger validate_city_id causing 500 error
-- =========================================
-- Recriar a função validate_city_id para usar TG_TABLE_NAME e evitar acessar campos inexistentes

CREATE OR REPLACE FUNCTION validate_city_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar apenas se for tabela freights ou service_requests
  IF TG_TABLE_NAME = 'freights' THEN
    -- Validar origin_city_id
    IF NEW.origin_city_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM cities WHERE id = NEW.origin_city_id
    ) THEN
      RAISE EXCEPTION 'Cidade de origem inválida. Selecione da lista.';
    END IF;
    
    -- Validar destination_city_id
    IF NEW.destination_city_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM cities WHERE id = NEW.destination_city_id
    ) THEN
      RAISE EXCEPTION 'Cidade de destino inválida. Selecione da lista.';
    END IF;
    
  ELSIF TG_TABLE_NAME = 'service_requests' THEN
    -- Validar city_id para service_requests
    IF NEW.city_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM cities WHERE id = NEW.city_id
    ) THEN
      RAISE EXCEPTION 'Cidade inválida. Selecione da lista.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar triggers apenas nas tabelas corretas
DROP TRIGGER IF EXISTS validate_freight_cities ON freights;
CREATE TRIGGER validate_freight_cities
  BEFORE INSERT OR UPDATE ON freights
  FOR EACH ROW
  EXECUTE FUNCTION validate_city_id();

DROP TRIGGER IF EXISTS validate_service_request_city ON service_requests;
CREATE TRIGGER validate_service_request_city
  BEFORE INSERT OR UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_city_id();

-- Remover quaisquer outros triggers indevidos que possam existir
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tgname, tgrelid::regclass AS table_name
    FROM pg_trigger
    WHERE tgname LIKE '%validate_city%'
    AND tgrelid::regclass::text NOT IN ('freights', 'service_requests')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.table_name);
    RAISE NOTICE 'Removed trigger % from %', r.tgname, r.table_name;
  END LOOP;
END $$;