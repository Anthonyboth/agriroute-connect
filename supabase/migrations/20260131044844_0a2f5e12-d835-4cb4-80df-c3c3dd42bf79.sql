-- Fix Supabase linter: Function Search Path Mutable
-- Sets a fixed search_path so it cannot be manipulated at runtime.

ALTER FUNCTION public.update_edge_function_health_timestamp()
SET search_path = public, extensions;