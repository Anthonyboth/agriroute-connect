-- =====================================================
-- RPC FUNCTIONS FOR DUPLICATE DETECTION
-- Used by hourly-security-report for fraud detection
-- =====================================================

-- Find duplicate CPF/CNPJ documents
CREATE OR REPLACE FUNCTION public.find_duplicate_documents()
RETURNS TABLE (
  document_number text,
  count bigint,
  profile_ids uuid[]
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.cpf_cnpj as document_number,
    COUNT(*) as count,
    ARRAY_AGG(p.id) as profile_ids
  FROM profiles p
  WHERE p.cpf_cnpj IS NOT NULL 
    AND p.cpf_cnpj != ''
    AND LENGTH(p.cpf_cnpj) >= 11
  GROUP BY p.cpf_cnpj
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT 20;
END;
$$;

-- Find duplicate phone numbers
CREATE OR REPLACE FUNCTION public.find_duplicate_phones()
RETURNS TABLE (
  phone_number text,
  count bigint,
  profile_ids uuid[]
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.phone as phone_number,
    COUNT(*) as count,
    ARRAY_AGG(p.id) as profile_ids
  FROM profiles p
  WHERE p.phone IS NOT NULL 
    AND p.phone != ''
    AND LENGTH(p.phone) >= 10
  GROUP BY p.phone
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT 20;
END;
$$;

-- Find duplicate emails
CREATE OR REPLACE FUNCTION public.find_duplicate_emails()
RETURNS TABLE (
  email_address text,
  count bigint,
  profile_ids uuid[]
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.email as email_address,
    COUNT(*) as count,
    ARRAY_AGG(p.id) as profile_ids
  FROM profiles p
  WHERE p.email IS NOT NULL 
    AND p.email != ''
  GROUP BY LOWER(p.email)
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT 20;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_duplicate_documents() TO service_role;
GRANT EXECUTE ON FUNCTION public.find_duplicate_phones() TO service_role;
GRANT EXECUTE ON FUNCTION public.find_duplicate_emails() TO service_role;

-- =====================================================
-- SCHEDULE HOURLY MONITORING JOBS VIA PG_CRON
-- =====================================================

-- Remove any existing hourly monitoring jobs to avoid duplicates
SELECT cron.unschedule('hourly-security-report') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hourly-security-report'
);

SELECT cron.unschedule('hourly-operational-report') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hourly-operational-report'
);

SELECT cron.unschedule('hourly-financial-report') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hourly-financial-report'
);

-- Schedule Security Report at minute 0 of every hour
SELECT cron.schedule(
  'hourly-security-report',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/hourly-security-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule Operational Report at minute 10 of every hour
SELECT cron.schedule(
  'hourly-operational-report',
  '10 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/hourly-operational-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule Financial & Performance Report at minute 20 of every hour
SELECT cron.schedule(
  'hourly-financial-report',
  '20 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/hourly-financial-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Verify jobs were created
DO $$
BEGIN
  RAISE NOTICE 'Hourly monitoring jobs scheduled successfully';
END $$;