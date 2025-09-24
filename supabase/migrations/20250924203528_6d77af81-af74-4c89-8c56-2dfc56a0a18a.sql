-- Corrigir status das solicitações de serviço existentes
-- Mudar de 'PENDING' para 'OPEN' para compatibilidade com o dashboard

UPDATE service_requests 
SET status = 'OPEN' 
WHERE status = 'PENDING' 
  AND client_id = '00000000-0000-0000-0000-000000000000';

-- Adicionar comentário para clareza
COMMENT ON COLUMN service_requests.status IS 
'Status da solicitação: OPEN (nova/pendente), ACCEPTED (aceita), IN_PROGRESS (em andamento), COMPLETED (concluída), CANCELLED (cancelada)';