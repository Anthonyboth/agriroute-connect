-- Set an explicit, safe search_path for functions flagged by the Supabase linter
-- Using pg_catalog first prevents search_path hijacking of built-in functions.

ALTER FUNCTION public.calculate_freight_antifraud_score(uuid)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.classify_stop_event()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.check_offline_suspicious()
  SET search_path = pg_catalog, public;