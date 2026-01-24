-- =====================================================
-- ENHANCED RATE LIMITING FOR EDGE FUNCTIONS
-- =====================================================

-- Add columns to api_rate_limits if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'ip_address') THEN
    ALTER TABLE public.api_rate_limits ADD COLUMN ip_address inet;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'blocked_until') THEN
    ALTER TABLE public.api_rate_limits ADD COLUMN blocked_until timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_rate_limits' AND column_name = 'block_reason') THEN
    ALTER TABLE public.api_rate_limits ADD COLUMN block_reason text;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup 
ON public.api_rate_limits(endpoint, user_id, window_start);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_ip_lookup 
ON public.api_rate_limits(endpoint, ip_address, window_start);

-- Create edge function rate limiter (distinct from existing check_rate_limit)
CREATE OR REPLACE FUNCTION public.edge_function_rate_check(
  p_user_id uuid,
  p_ip_address inet,
  p_endpoint text,
  p_max_requests integer DEFAULT 60,
  p_window_minutes integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamp with time zone;
  v_current_count integer;
  v_blocked_until timestamp with time zone;
BEGIN
  -- Calculate window start
  v_window_start := date_trunc('minute', now()) - 
    (EXTRACT(minute FROM now())::integer % p_window_minutes) * interval '1 minute';
  
  -- Check if blocked
  SELECT blocked_until INTO v_blocked_until
  FROM public.api_rate_limits
  WHERE endpoint = p_endpoint
    AND (user_id = p_user_id OR (p_user_id IS NULL AND ip_address = p_ip_address))
    AND blocked_until > now()
  ORDER BY blocked_until DESC
  LIMIT 1;
  
  IF v_blocked_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_blocked_until,
      'blocked', true,
      'message', 'Rate limit exceeded. Temporarily blocked.'
    );
  END IF;
  
  -- Get current request count in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM public.api_rate_limits
  WHERE endpoint = p_endpoint
    AND window_start >= v_window_start
    AND (user_id = p_user_id OR (p_user_id IS NULL AND ip_address = p_ip_address));
  
  -- Increment counter
  INSERT INTO public.api_rate_limits (
    id, user_id, ip_address, endpoint, request_count, window_start, created_at
  )
  VALUES (
    gen_random_uuid(), p_user_id, p_ip_address, p_endpoint, 1, v_window_start, now()
  )
  ON CONFLICT DO NOTHING;
  
  -- Update if exists
  UPDATE public.api_rate_limits
  SET request_count = request_count + 1
  WHERE endpoint = p_endpoint
    AND window_start = v_window_start
    AND ((p_user_id IS NOT NULL AND user_id = p_user_id) OR (p_user_id IS NULL AND ip_address = p_ip_address));
  
  v_current_count := v_current_count + 1;
  
  -- Check if limit exceeded
  IF v_current_count > p_max_requests THEN
    -- Calculate block duration
    v_blocked_until := now() + 
      CASE 
        WHEN v_current_count > p_max_requests * 5 THEN interval '1 hour'
        WHEN v_current_count > p_max_requests * 2 THEN interval '15 minutes'
        ELSE interval '5 minutes'
      END;
    
    -- Set block
    UPDATE public.api_rate_limits
    SET blocked_until = v_blocked_until,
        block_reason = 'Rate limit exceeded: ' || v_current_count || '/' || p_max_requests
    WHERE endpoint = p_endpoint
      AND window_start = v_window_start
      AND ((p_user_id IS NOT NULL AND user_id = p_user_id) OR (p_user_id IS NULL AND ip_address = p_ip_address));
    
    -- Log violation
    INSERT INTO public.audit_logs (
      table_name, operation, new_data, ip_address, user_id
    )
    VALUES (
      'api_rate_limits',
      'RATE_LIMIT_EXCEEDED',
      jsonb_build_object(
        'endpoint', p_endpoint,
        'request_count', v_current_count,
        'max_requests', p_max_requests,
        'blocked_until', v_blocked_until
      ),
      p_ip_address,
      p_user_id
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'current', v_current_count,
      'limit', p_max_requests,
      'reset_at', v_blocked_until,
      'blocked', true,
      'message', 'Rate limit exceeded. Please wait before retrying.'
    );
  END IF;
  
  -- Return success
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_requests - v_current_count,
    'current', v_current_count,
    'limit', p_max_requests,
    'reset_at', v_window_start + (p_window_minutes * interval '1 minute'),
    'blocked', false
  );
END;
$$;

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < now() - interval '24 hours'
    AND (blocked_until IS NULL OR blocked_until < now());
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Rate limit configuration table
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_pattern text NOT NULL UNIQUE,
  max_requests_per_minute integer NOT NULL DEFAULT 60,
  max_requests_per_hour integer NOT NULL DEFAULT 1000,
  burst_limit integer NOT NULL DEFAULT 10,
  block_duration_minutes integer NOT NULL DEFAULT 5,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Admins can manage rate limit config" ON public.rate_limit_config;

CREATE POLICY "Admins can manage rate limit config"
ON public.rate_limit_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Insert default configurations
INSERT INTO public.rate_limit_config (endpoint_pattern, max_requests_per_minute, max_requests_per_hour, burst_limit, description)
VALUES 
  ('accept-freight', 30, 300, 5, 'Freight acceptance endpoint'),
  ('send-proposal', 20, 200, 3, 'Proposal submission endpoint'),
  ('create-checkout', 10, 50, 2, 'Payment checkout endpoint'),
  ('driver-proposals', 60, 600, 10, 'Driver proposals listing'),
  ('notify-new-freight', 30, 300, 5, 'Notification endpoint'),
  ('fiscalizacao-consulta', 100, 1000, 20, 'PRF fiscalization queries'),
  ('default', 60, 600, 10, 'Default rate limit for unspecified endpoints')
ON CONFLICT (endpoint_pattern) DO NOTHING;

-- Add documentation
COMMENT ON FUNCTION public.edge_function_rate_check IS 'Rate limit check for edge functions with progressive blocking and audit logging';
COMMENT ON FUNCTION public.cleanup_rate_limits IS 'Cleanup old rate limit records - should be scheduled daily';
COMMENT ON TABLE public.rate_limit_config IS 'Configuration for endpoint-specific rate limits';