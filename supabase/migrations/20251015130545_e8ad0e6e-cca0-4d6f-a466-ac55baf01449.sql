-- Remover triggers que causam erro "schema 'net' does not exist"
-- Esses triggers tentam usar net.http_post() mas a extensão pg_net não está habilitada

DROP TRIGGER IF EXISTS on_freight_created_notify_drivers ON freights;
DROP TRIGGER IF EXISTS on_service_created_notify_providers ON service_requests;

-- Remover as funções associadas aos triggers
DROP FUNCTION IF EXISTS notify_matched_drivers_on_freight_creation();
DROP FUNCTION IF EXISTS notify_matched_providers_on_service_creation();

-- Comentário: A lógica de notificação será tratada pela aplicação via edge functions
-- invocadas manualmente, ao invés de triggers automáticos no banco de dados