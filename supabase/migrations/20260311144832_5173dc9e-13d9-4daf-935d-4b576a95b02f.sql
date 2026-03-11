-- Fix guest city search failures (42501) in unauthenticated flows
-- Allow both anon and authenticated roles to execute the city autocomplete RPC
GRANT EXECUTE ON FUNCTION public.search_cities(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_cities(text, integer) TO authenticated;