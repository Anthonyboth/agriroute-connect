-- Allow the application to log PII access events
-- (PostgREST can't auto-log SELECTs; the app/RPCs must insert these events explicitly)

ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sensitive_data_access_log'
      AND policyname = 'Users can insert their own sensitive data access logs'
  ) THEN
    CREATE POLICY "Users can insert their own sensitive data access logs"
    ON public.sensitive_data_access_log
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
