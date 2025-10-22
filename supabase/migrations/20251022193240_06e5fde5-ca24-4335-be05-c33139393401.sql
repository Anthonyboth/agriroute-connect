-- =====================================================
-- Fix: Allow NULL client_id for guest services
-- But ensure COMPLETED services have both client_id and provider_id
-- =====================================================

-- 1. Remove NOT NULL constraint from client_id to allow guest services
ALTER TABLE service_requests
  ALTER COLUMN client_id DROP NOT NULL;

-- 2. Add CHECK constraint: COMPLETED services must have client_id
ALTER TABLE service_requests
  ADD CONSTRAINT check_completed_service_has_client
  CHECK (
    status != 'COMPLETED' OR 
    (status = 'COMPLETED' AND client_id IS NOT NULL)
  );

-- 3. Update existing COMPLETED services with NULL client_id to set a default status
-- (This should not happen based on the data, but safeguard anyway)
UPDATE service_requests
SET status = 'CANCELLED'
WHERE status = 'COMPLETED' 
  AND (client_id IS NULL OR provider_id IS NULL);

-- 4. Update comments
COMMENT ON COLUMN service_requests.client_id IS 
  'ID do cliente (perfil) que solicitou o serviço. NULL permitido para serviços de convidados. Deve ser NOT NULL quando status = COMPLETED.';

COMMENT ON COLUMN service_requests.provider_id IS 
  'ID do prestador (perfil) que executará/executou o serviço. NOT NULL obrigatório.';