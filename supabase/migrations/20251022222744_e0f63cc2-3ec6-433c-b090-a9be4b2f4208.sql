-- Corrigir constraint para permitir conclusão de serviços sem client_id se houver contact_name
ALTER TABLE service_requests 
DROP CONSTRAINT IF EXISTS check_completed_service_has_client;

-- Nova constraint mais permissiva
ALTER TABLE service_requests
ADD CONSTRAINT check_completed_service_has_client 
CHECK (
  (status != 'COMPLETED') 
  OR 
  (status = 'COMPLETED' AND (client_id IS NOT NULL OR contact_name IS NOT NULL))
);

-- Comentário explicativo
COMMENT ON CONSTRAINT check_completed_service_has_client ON service_requests IS 
'Permite conclusão de serviços se houver client_id OU contact_name preenchido';