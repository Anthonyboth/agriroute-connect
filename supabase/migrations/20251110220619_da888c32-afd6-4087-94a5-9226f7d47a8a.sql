-- Criar cron job para monitoramento automático de roles suspeitas
-- Executa a cada hora para detectar e alertar sobre roles inválidas

SELECT cron.schedule(
  'monitor-suspicious-roles-hourly',
  '0 * * * *', -- A cada hora, no minuto 0
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-suspicious-roles',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Comentário explicativo sobre o monitoramento
COMMENT ON EXTENSION pg_cron IS 'Job de monitoramento de segurança: verifica roles suspeitas a cada hora e envia alertas via Telegram ao grupo de monitoramento';
