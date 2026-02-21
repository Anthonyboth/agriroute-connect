-- Fix service_requests_secure: convert from SECURITY DEFINER to SECURITY INVOKER
-- All columns on service_requests are already accessible to authenticated role,
-- so SECURITY DEFINER is unnecessary here.

ALTER VIEW public.service_requests_secure SET (security_invoker = true);