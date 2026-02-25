-- Fix critical RPC overload causing PGRST203 and zeroed marketplace cards
-- Keep only the authoritative 6-parameter signature used by frontend filters
DROP FUNCTION IF EXISTS public.get_authoritative_feed(uuid, text, boolean);