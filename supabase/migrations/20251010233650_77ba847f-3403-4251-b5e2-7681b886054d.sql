-- Drop the existing search_cities function
DROP FUNCTION IF EXISTS public.search_cities(text, integer);

-- Create the search_cities function with lat and lng fields
CREATE OR REPLACE FUNCTION public.search_cities(
  search_term text,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  state text,
  display_name text,
  lat numeric,
  lng numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.state,
    (c.name || ', ' || c.state) as display_name,
    c.lat,
    c.lng
  FROM cities c
  WHERE 
    c.name ILIKE '%' || search_term || '%' 
    OR c.state ILIKE '%' || search_term || '%'
    OR (c.name || ', ' || c.state) ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE 
      WHEN c.name ILIKE search_term || '%' THEN 1
      WHEN c.name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    c.name
  LIMIT limit_count;
END;
$$;