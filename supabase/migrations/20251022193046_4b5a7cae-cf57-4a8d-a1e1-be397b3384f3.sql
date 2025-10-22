-- =====================================================
-- Fix service_requests with NULL client_id or provider_id
-- =====================================================

-- 1. Análise dos dados problemáticos
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM service_requests
  WHERE client_id IS NULL OR provider_id IS NULL;
  
  RAISE NOTICE 'Encontrados % registros com IDs nulos', v_null_count;
END $$;

-- 2. Deletar registros problemáticos (dados inválidos devem ser removidos)
DELETE FROM service_requests
WHERE client_id IS NULL OR provider_id IS NULL;

-- 3. Adicionar constraints NOT NULL para prevenir futuros problemas
ALTER TABLE service_requests
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE service_requests
  ALTER COLUMN provider_id SET NOT NULL;

-- 4. Criar índices compostos para melhor performance nas queries de rating
CREATE INDEX IF NOT EXISTS idx_service_requests_client_provider 
  ON service_requests(client_id, provider_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_status_dates
  ON service_requests(status, updated_at DESC) 
  WHERE status = 'COMPLETED';

-- 5. Comentários para documentação
COMMENT ON COLUMN service_requests.client_id IS 
  'ID do cliente (perfil) que solicitou o serviço. NOT NULL constraint adicionado.';
  
COMMENT ON COLUMN service_requests.provider_id IS 
  'ID do prestador (perfil) que executará/executou o serviço. NOT NULL constraint adicionado.';