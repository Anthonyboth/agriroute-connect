-- P0 HOTFIX: Add 'extensions' to search_path so PostGIS types (geography, ST_DWithin, etc.) are visible.
-- Root cause: PostGIS is installed in the 'extensions' schema, but functions had search_path = 'public' only.

-- Fix get_authoritative_feed
ALTER FUNCTION public.get_authoritative_feed(uuid, text, boolean) SET search_path = 'public', 'extensions';

-- Fix get_unified_freight_feed
ALTER FUNCTION public.get_unified_freight_feed(text, uuid, uuid, timestamptz, boolean) SET search_path = 'public', 'extensions';

-- Fix get_unified_service_feed
ALTER FUNCTION public.get_unified_service_feed(uuid, boolean) SET search_path = 'public', 'extensions';