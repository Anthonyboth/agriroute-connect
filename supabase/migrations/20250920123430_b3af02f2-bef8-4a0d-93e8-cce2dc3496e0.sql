-- Fix critical security vulnerabilities

-- 1. Add proper RLS policies for sensitive tables

-- Restrict pricing_plans to authenticated users only
DROP POLICY IF EXISTS "Anyone can view pricing plans" ON public.pricing_plans;
CREATE POLICY "Authenticated users can view pricing plans" 
ON public.pricing_plans 
FOR SELECT 
TO authenticated
USING (true);

-- Restrict driver_availability to authenticated users
DROP POLICY IF EXISTS "Users can view driver availability" ON public.driver_availability;
CREATE POLICY "Authenticated users can view driver availability" 
ON public.driver_availability 
FOR SELECT 
TO authenticated
USING (true);

-- Restrict antt_freight_prices to authenticated users
DROP POLICY IF EXISTS "Anyone can view ANTT prices" ON public.antt_freight_prices;
CREATE POLICY "Authenticated users can view ANTT prices" 
ON public.antt_freight_prices 
FOR SELECT 
TO authenticated
USING (true);

-- 2. Fix database functions with immutable search paths
-- Update all existing functions to use immutable search_path

CREATE OR REPLACE FUNCTION public.get_public_stats()
 RETURNS TABLE(total_drivers bigint, total_producers bigint, total_freights bigint, active_freights bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 STABLE
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'MOTORISTA' AND status = 'APPROVED')::bigint AS total_drivers,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'PRODUTOR' AND status = 'APPROVED')::bigint AS total_producers,
    (SELECT COUNT(*) FROM public.freights)::bigint AS total_freights,
    (SELECT COUNT(*) FROM public.freights WHERE status IN ('OPEN','ACCEPTED','IN_TRANSIT'))::bigint AS active_freights;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_platform_stats()
 RETURNS TABLE(produtores bigint, motoristas bigint, fretes_entregues bigint, peso_total numeric, total_fretes bigint, total_usuarios bigint, avaliacao_media numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 STABLE
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'PRODUTOR')::bigint as produtores,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'MOTORISTA')::bigint as motoristas,
    (SELECT COUNT(*) FROM public.freights WHERE status = 'DELIVERED')::bigint as fretes_entregues,
    (SELECT COALESCE(SUM(weight), 0) FROM public.freights WHERE status = 'DELIVERED') as peso_total,
    (SELECT COUNT(*) FROM public.freights)::bigint as total_fretes,
    (SELECT COUNT(*) FROM public.profiles)::bigint as total_usuarios,
    (SELECT COALESCE(AVG(rating), 0) FROM public.profiles WHERE rating IS NOT NULL AND rating > 0) as avaliacao_media;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE 
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE 
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  );
$function$;

-- 3. Add rate limiting table for API calls
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rate limiting table
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limiting policies
CREATE POLICY "Users can view their own rate limits" 
ON public.api_rate_limits 
FOR SELECT 
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "System can manage rate limits" 
ON public.api_rate_limits 
FOR ALL 
USING (true);

-- 4. Add security audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource text,
  ip_address inet,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log policies - only admins can read
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can create audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);