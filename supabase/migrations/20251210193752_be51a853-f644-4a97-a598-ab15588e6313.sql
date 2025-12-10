-- =============================================
-- CONFIGURAR PG_CRON JOBS PARA RASTREAMENTO GPS
-- =============================================

-- Job 1: Enviar localização no chat a cada 30 minutos
SELECT cron.schedule(
  'send-location-to-chat-30min',
  '*/30 * * * *',
  $$SELECT send_location_to_freight_chats();$$
);

-- Job 2: Limpar localizações antigas diariamente às 3 AM
SELECT cron.schedule(
  'cleanup-old-locations-daily',
  '0 3 * * *',
  $$SELECT cleanup_old_location_history();$$
);