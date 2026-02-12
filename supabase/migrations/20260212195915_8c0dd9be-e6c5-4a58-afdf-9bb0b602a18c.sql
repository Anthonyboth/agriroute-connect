
-- Fix SECURITY DEFINER view warning: usar INVOKER para que RLS seja aplicado pelo usuário chamador
ALTER VIEW public.profiles_secure SET (security_invoker = on);
