-- Security Fix 1: Add rate limiting infrastructure for error reporting endpoints
CREATE OR REPLACE FUNCTION public.check_error_report_rate_limit(
  p_ip_address TEXT,
  p_endpoint TEXT DEFAULT 'error-report'
)
RETURNS JSONB AS $$
DECLARE
  recent_reports INTEGER;
  max_allowed INTEGER := 50; -- Max 50 errors per hour per IP
  window_minutes INTEGER := 60;
BEGIN
  -- Count reports from this IP in the configured window
  SELECT COUNT(*) INTO recent_reports
  FROM error_logs
  WHERE (metadata->>'ip_address') = p_ip_address
    AND created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;
  
  -- Return whether request is allowed and current count
  RETURN jsonb_build_object(
    'allowed', recent_reports < max_allowed,
    'current_count', recent_reports,
    'max_allowed', max_allowed,
    'window_minutes', window_minutes,
    'reset_at', NOW() + ((window_minutes - EXTRACT(MINUTE FROM NOW())::INTEGER % window_minutes) || ' minutes')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Security Fix 2: Restrict plans table visibility to show only relevant plans
-- Drop existing overly permissive policies if any
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
DROP POLICY IF EXISTS "Public can view plans" ON public.plans;

-- Create restricted policy: Users see only active plans
CREATE POLICY "Users can view active plans only"
ON public.plans FOR SELECT
USING (
  is_active = true
  AND auth.uid() IS NOT NULL
);

-- Admins can manage all plans
CREATE POLICY "Admins can manage all plans"
ON public.plans FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'ADMIN'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'ADMIN'::user_role
  )
);

-- Security Fix 3: Add automatic cleanup for old error logs (prevent database bloat)
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  -- Delete error logs older than 90 days
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleaned up error logs older than 90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Security Fix 4: Add index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_error_logs_ip_created 
ON error_logs ((metadata->>'ip_address'), created_at DESC);

COMMENT ON FUNCTION public.check_error_report_rate_limit IS 'Rate limiting for error reporting endpoints to prevent DoS attacks. Max 50 errors per hour per IP.';
COMMENT ON FUNCTION public.cleanup_old_error_logs IS 'Automatic cleanup of error logs older than 90 days to prevent database bloat.';