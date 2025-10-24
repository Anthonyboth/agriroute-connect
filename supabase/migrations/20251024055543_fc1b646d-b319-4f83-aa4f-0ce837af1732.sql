-- Update telegram queue processor to run every 1 minute instead of 5 minutes
SELECT cron.alter_job(
  job_id := 2,
  schedule := '* * * * *'
);