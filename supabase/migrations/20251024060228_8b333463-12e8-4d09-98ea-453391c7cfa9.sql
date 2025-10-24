-- Switch cron to call the Edge Function every minute and remove old job if present
DO $$
DECLARE v_job_id int;
BEGIN
  -- Try to unschedule legacy job id 2 if it exists
  BEGIN
    PERFORM cron.unschedule(2);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'cron job 2 not found or cannot be unscheduled';
  END;

  -- Unschedule existing job with same name if present
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'invoke-process-telegram-queue-every-minute' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

-- Schedule new job: call Edge Function directly using anon key
SELECT cron.schedule(
  'invoke-process-telegram-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/process-telegram-queue',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);