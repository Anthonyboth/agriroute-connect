-- =====================================================
-- SECURITY FIX: Drop and recreate search_cities with validation
-- =====================================================

-- Drop existing function first (required for return type changes)
DROP FUNCTION IF EXISTS public.search_cities(text, integer);

-- Recreate with input validation and search_path
CREATE OR REPLACE FUNCTION public.search_cities(
  search_term text,
  limit_count integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  name text,
  state text,
  display_name text,
  lat numeric,
  lng numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sanitized_term text;
  safe_limit integer;
BEGIN
  -- Input validation: require minimum 2 characters
  IF search_term IS NULL OR length(trim(search_term)) < 2 THEN
    RAISE EXCEPTION 'Search term must have at least 2 characters';
  END IF;
  
  -- Sanitize and prepare search term
  sanitized_term := trim(search_term);
  
  -- Enforce limit bounds (1-100)
  safe_limit := LEAST(GREATEST(COALESCE(limit_count, 10), 1), 100);
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.state,
    (c.name || ', ' || c.state) as display_name,
    c.lat,
    c.lng
  FROM public.cities c
  WHERE 
    c.name ILIKE sanitized_term || '%'
    OR c.name ILIKE '%' || sanitized_term || '%'
    OR c.state ILIKE '%' || sanitized_term || '%'
    OR (c.name || ', ' || c.state) ILIKE '%' || sanitized_term || '%'
    OR to_tsvector('portuguese', c.name || ' ' || c.state) @@ 
       plainto_tsquery('portuguese', sanitized_term)
  ORDER BY 
    CASE 
      WHEN LOWER(c.name) = LOWER(sanitized_term) THEN 1
      WHEN c.name ILIKE sanitized_term || '%' THEN 2
      WHEN c.state ILIKE sanitized_term || '%' THEN 3
      WHEN c.name ILIKE '%' || sanitized_term || '%' THEN 4
      ELSE 5
    END,
    CASE 
      WHEN c.name IN (
        'São Paulo', 'Rio de Janeiro', 'Brasília', 'Cuiabá', 'Rondonópolis',
        'Porto Alegre', 'Belo Horizonte', 'Salvador', 'Fortaleza', 'Manaus',
        'Sinop', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste',
        'Paranaguá', 'Rio Grande', 'Itajaí', 'Santos', 'Vitória'
      ) THEN 1
      ELSE 2
    END,
    c.name
  LIMIT safe_limit;
END;
$$;