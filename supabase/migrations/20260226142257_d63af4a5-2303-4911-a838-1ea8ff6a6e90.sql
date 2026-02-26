-- Fix: PostGIS "geography does not exist" error
-- Root cause: get_authoritative_feed was recreated with search_path = public only,
-- but PostGIS types (geography) and functions (ST_DWithin, ST_Distance, etc.) live in 'extensions' schema.
-- This broke the entire driver freight feed.

ALTER FUNCTION public.get_authoritative_feed(uuid, text, boolean, text[], text, text) SET search_path = 'public', 'extensions';

-- Also fix get_unified_freight_feed if it exists with wrong search_path
DO $$
BEGIN
  -- Try different signatures that may exist
  BEGIN
    ALTER FUNCTION public.get_unified_freight_feed(text, uuid, uuid, date, boolean) SET search_path = 'public', 'extensions';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
  BEGIN
    ALTER FUNCTION public.get_unified_freight_feed(text, uuid, uuid, timestamptz, boolean) SET search_path = 'public', 'extensions';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END $$;