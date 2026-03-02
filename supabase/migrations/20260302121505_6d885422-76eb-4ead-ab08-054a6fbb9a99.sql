
-- Fix: get_platform_stats is called from the public landing page (no auth)
-- It's a SECURITY DEFINER function that returns only aggregate counts, safe for anon
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon;
