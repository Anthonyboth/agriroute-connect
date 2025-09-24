-- Habilitar Supabase Realtime para a tabela service_requests
-- Para permitir atualizações em tempo real das solicitações de serviço

-- Configurar REPLICA IDENTITY FULL para capturar dados completos durante updates
ALTER TABLE public.service_requests REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação do Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;