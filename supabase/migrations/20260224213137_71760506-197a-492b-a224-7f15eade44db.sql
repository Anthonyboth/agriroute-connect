
-- Fix: Remove ambiguous overload of get_unified_freight_feed
-- Keep only the timestamptz version (compatible with Supabase JS client)
DROP FUNCTION IF EXISTS public.get_unified_freight_feed(text, uuid, uuid, date, boolean);
