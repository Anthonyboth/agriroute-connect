-- Agendar job de limpeza diária às 4 AM
SELECT cron.schedule(
  'daily-data-cleanup',
  '0 4 * * *',
  $$SELECT run_all_cleanups();$$
);