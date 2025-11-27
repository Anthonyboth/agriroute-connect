-- ==============================================================================
-- SECURITY FIX: Add SET search_path to SECURITY DEFINER functions
-- Prevents search path injection attacks by fixing mutable search paths
-- ==============================================================================

-- Strategy: ALTER each function to add SET search_path = public
-- This preserves function signatures while adding security protection

-- 1. clean_expired_zip_cache
ALTER FUNCTION public.clean_expired_zip_cache()
SET search_path = public;

-- 2. search_city_by_zip - must drop and recreate due to return type
DROP FUNCTION IF EXISTS public.search_city_by_zip(TEXT);

CREATE FUNCTION public.search_city_by_zip(p_zip_code TEXT)
RETURNS TABLE(
  city_id UUID, 
  city_name TEXT, 
  state TEXT, 
  neighborhood TEXT, 
  street TEXT, 
  lat NUMERIC, 
  lng NUMERIC, 
  source TEXT, 
  from_cache BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalizar CEP (remover traços e espaços)
  p_zip_code := REGEXP_REPLACE(p_zip_code, '[^0-9]', '', 'g');
  
  -- Buscar no cache
  RETURN QUERY
  SELECT 
    zc.city_id,
    zc.city_name,
    zc.state,
    zc.neighborhood,
    zc.street,
    zc.lat,
    zc.lng,
    zc.source,
    true as from_cache
  FROM zip_code_cache zc
  WHERE zc.zip_code = p_zip_code
    AND zc.expires_at > NOW()
  LIMIT 1;
END;
$$;

-- 3. save_zip_to_cache
ALTER FUNCTION public.save_zip_to_cache(
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID, NUMERIC, NUMERIC, TEXT
)
SET search_path = public;

-- 4. process_telegram_queue
ALTER FUNCTION public.process_telegram_queue()
SET search_path = public;

-- 5. sync_freight_assignment_status
ALTER FUNCTION public.sync_freight_assignment_status()
SET search_path = public;

-- 6. fix_freight_statuses
ALTER FUNCTION public.fix_freight_statuses()
SET search_path = public;

-- 7. cancel_freight_optimized
ALTER FUNCTION public.cancel_freight_optimized(UUID, TIMESTAMP WITH TIME ZONE, TEXT)
SET search_path = public;

-- Add documentation
COMMENT ON FUNCTION public.clean_expired_zip_cache IS 
  'Cleans expired zip code cache entries - protected against search path injection';
  
COMMENT ON FUNCTION public.search_city_by_zip IS 
  'Searches city by zip code - protected against search path injection';
  
COMMENT ON FUNCTION public.save_zip_to_cache IS 
  'Saves zip code to cache - protected against search path injection';
  
COMMENT ON FUNCTION public.process_telegram_queue IS 
  'Processes telegram notification queue - protected against search path injection';
  
COMMENT ON FUNCTION public.sync_freight_assignment_status IS 
  'Syncs freight assignment status - protected against search path injection';
  
COMMENT ON FUNCTION public.fix_freight_statuses IS 
  'Fixes inconsistent freight statuses - protected against search path injection';
  
COMMENT ON FUNCTION public.cancel_freight_optimized IS 
  'Cancels freight with optimized query - protected against search path injection';