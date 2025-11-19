-- ============================================
-- AGENDAMENTO VIA PG_CRON: Monitoramento de Segurança
-- ============================================

-- 1. Habilitar extensão pg_cron se ainda não estiver
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Agendar monitor-auto-confirm-logs a cada 6 horas
SELECT cron.schedule(
  'monitor-auto-confirm-logs-every-6h',
  '0 */6 * * *', -- A cada 6 horas (00:00, 06:00, 12:00, 18:00)
  $$
  SELECT net.http_post(
    url := 'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-auto-confirm-logs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
    body := concat('{"timestamp": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- 3. Agendar security-health-check diariamente às 3 AM
SELECT cron.schedule(
  'security-health-check-daily-3am',
  '0 3 * * *', -- Diariamente às 3 AM
  $$
  SELECT net.http_post(
    url := 'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/security-health-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
    body := concat('{"timestamp": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- 4. Adicionar comentários
COMMENT ON EXTENSION pg_cron IS 'Agendador de tarefas periódicas para monitoramento de segurança';

-- 5. Verificar jobs criados
-- SELECT * FROM cron.job WHERE jobname IN ('monitor-auto-confirm-logs-every-6h', 'security-health-check-daily-3am');