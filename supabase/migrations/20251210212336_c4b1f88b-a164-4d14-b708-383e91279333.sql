-- Criar job pg_cron para limpar mensagens de chat antigas (365 dias)
-- Apenas para chats já fechados

SELECT cron.schedule(
  'cleanup-old-chat-messages-365-days',
  '0 4 * * *', -- Diariamente às 4h
  $$
    -- Limpar mensagens de frete antigas (apenas de fretes concluídos)
    DELETE FROM freight_messages 
    WHERE created_at < NOW() - INTERVAL '365 days'
    AND freight_id IN (
      SELECT id FROM freights 
      WHERE status IN ('DELIVERED', 'COMPLETED', 'CANCELLED')
    );
    
    -- Limpar mensagens de serviço antigas
    DELETE FROM service_messages 
    WHERE created_at < NOW() - INTERVAL '365 days'
    AND service_request_id IN (
      SELECT id FROM service_requests 
      WHERE status IN ('COMPLETED', 'CANCELLED')
    );
    
    -- Limpar chats diretos antigos (onde ambos fecharam)
    DELETE FROM company_driver_chats 
    WHERE created_at < NOW() - INTERVAL '365 days'
    AND chat_closed_by IS NOT NULL;
  $$
);