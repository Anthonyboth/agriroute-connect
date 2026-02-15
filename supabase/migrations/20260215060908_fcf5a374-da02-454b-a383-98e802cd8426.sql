-- Fix: service_requests_secure deve usar security_invoker para respeitar RLS do usuário chamador
ALTER VIEW public.service_requests_secure SET (security_invoker = on);