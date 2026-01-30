-- Move pg_net extension from public to extensions schema
-- First, drop from public (if exists)
DROP EXTENSION IF EXISTS pg_net;

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Create pg_net in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create edge_function_health table for monitoring
CREATE TABLE IF NOT EXISTS public.edge_function_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_check TIMESTAMPTZ DEFAULT now(),
  last_success TIMESTAMPTZ,
  last_error TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(function_name)
);

-- Enable RLS
ALTER TABLE public.edge_function_health ENABLE ROW LEVEL SECURITY;

-- Allow service role full access for monitoring
CREATE POLICY "Service role full access" ON public.edge_function_health
  FOR ALL USING (true) WITH CHECK (true);

-- Allow admins to view health status
CREATE POLICY "Admins can view health" ON public.edge_function_health
  FOR SELECT USING (public.is_admin());

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_edge_function_health_name ON public.edge_function_health(function_name);
CREATE INDEX IF NOT EXISTS idx_edge_function_health_status ON public.edge_function_health(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_edge_function_health_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_edge_function_health_updated_at ON public.edge_function_health;
CREATE TRIGGER update_edge_function_health_updated_at
  BEFORE UPDATE ON public.edge_function_health
  FOR EACH ROW EXECUTE FUNCTION update_edge_function_health_timestamp();