-- ============================================================================
-- CONFIGURAR CRON JOB PARA CANCELAMENTO AUTOMÁTICO DE FRETES
-- ============================================================================
-- Executa verificação a cada hora (minuto 0)
-- ============================================================================

-- Desagendar job anterior se existir
SELECT cron.unschedule('auto-cancel-freights-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-cancel-freights-hourly'
);

-- Agendar nova execução horária
SELECT cron.schedule(
  'auto-cancel-freights-hourly',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT net.http_post(
    url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/auto-cancel-freights',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Verificar job criado
SELECT jobid, schedule, command, jobname, active
FROM cron.job
WHERE jobname = 'auto-cancel-freights-hourly';