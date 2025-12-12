-- CORREÇÃO 5: Políticas RLS para freight_ratings permitir INSERT
DROP POLICY IF EXISTS "freight_ratings_insert_authenticated" ON freight_ratings;
DROP POLICY IF EXISTS "freight_ratings_update_own" ON freight_ratings;

-- Política para INSERT: usuários autenticados podem criar avaliações
CREATE POLICY "freight_ratings_insert_authenticated" ON freight_ratings
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  rater_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Política para UPDATE: usuários podem atualizar suas próprias avaliações (para upsert)
CREATE POLICY "freight_ratings_update_own" ON freight_ratings
FOR UPDATE USING (
  rater_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- CORREÇÃO 6: Adicionar número de referência único para fretes e serviços
-- Criar sequência para fretes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'freight_reference_seq') THEN
    CREATE SEQUENCE public.freight_reference_seq START 1;
  END IF;
END$$;

-- Criar sequência para serviços
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'service_reference_seq') THEN
    CREATE SEQUENCE public.service_reference_seq START 1;
  END IF;
END$$;

-- Adicionar coluna reference_number em freights se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'freights' AND column_name = 'reference_number') THEN
    ALTER TABLE freights ADD COLUMN reference_number INTEGER;
  END IF;
END$$;

-- Adicionar coluna reference_number em service_requests se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'service_requests' AND column_name = 'reference_number') THEN
    ALTER TABLE service_requests ADD COLUMN reference_number INTEGER;
  END IF;
END$$;

-- Criar trigger para auto-gerar reference_number em freights
CREATE OR REPLACE FUNCTION generate_freight_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := nextval('freight_reference_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_freight_reference ON freights;
CREATE TRIGGER set_freight_reference
  BEFORE INSERT ON freights
  FOR EACH ROW
  EXECUTE FUNCTION generate_freight_reference();

-- Criar trigger para auto-gerar reference_number em service_requests
CREATE OR REPLACE FUNCTION generate_service_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := nextval('service_reference_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_service_reference ON service_requests;
CREATE TRIGGER set_service_reference
  BEFORE INSERT ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_service_reference();

-- Atualizar fretes existentes que não têm reference_number
UPDATE freights 
SET reference_number = nextval('freight_reference_seq') 
WHERE reference_number IS NULL;

-- Atualizar serviços existentes que não têm reference_number
UPDATE service_requests 
SET reference_number = nextval('service_reference_seq') 
WHERE reference_number IS NULL;

-- Criar índice único para evitar duplicação
CREATE UNIQUE INDEX IF NOT EXISTS idx_freights_reference_unique ON freights (reference_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_requests_reference_unique ON service_requests (reference_number);