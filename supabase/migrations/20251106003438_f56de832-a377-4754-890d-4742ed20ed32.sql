-- Security Fix: Rate limiting for guest user validation
CREATE OR REPLACE FUNCTION public.check_guest_validation_rate_limit(
  p_ip_address TEXT
)
RETURNS JSONB AS $$
DECLARE
  recent_attempts INTEGER;
  max_allowed INTEGER := 3; -- Max 3 attempts per hour per IP
  window_minutes INTEGER := 60;
  last_attempt TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count attempts from this IP in the last hour
  SELECT COUNT(*), MAX(created_at) INTO recent_attempts, last_attempt
  FROM prospect_users
  WHERE (metadata->>'ip_address') = p_ip_address
    AND created_at > NOW() - (window_minutes || ' minutes')::INTERVAL;
  
  -- Return whether request is allowed
  RETURN jsonb_build_object(
    'allowed', recent_attempts < max_allowed,
    'current_attempts', recent_attempts,
    'max_allowed', max_allowed,
    'window_minutes', window_minutes,
    'last_attempt', last_attempt,
    'reset_at', CASE 
      WHEN recent_attempts >= max_allowed THEN last_attempt + (window_minutes || ' minutes')::INTERVAL
      ELSE NULL
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add metadata column to prospect_users if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prospect_users' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.prospect_users 
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_prospect_users_ip_created 
ON prospect_users ((metadata->>'ip_address'), created_at DESC);

COMMENT ON FUNCTION public.check_guest_validation_rate_limit IS 'Rate limiting for guest user validation to prevent user enumeration attacks. Max 3 attempts per hour per IP.';