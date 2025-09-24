-- Remover função existente e criar nova função para buscar cidades
-- Para o componente CitySelector

-- Primeiro, remover a função existente se ela existir
DROP FUNCTION IF EXISTS search_cities(text, integer);

-- Criar a nova função
CREATE OR REPLACE FUNCTION search_cities(
  search_term text,
  limit_count integer DEFAULT 10
)
RETURNS TABLE(
  id text,
  name text,
  state text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id::text,
    c.name,
    c.state,
    (c.name || ', ' || c.state) as display_name
  FROM cities c
  WHERE 
    c.name ILIKE '%' || search_term || '%'
    OR c.state ILIKE '%' || search_term || '%'
  ORDER BY 
    -- Priorizar correspondências exatas
    CASE WHEN LOWER(c.name) = LOWER(search_term) THEN 1 ELSE 2 END,
    -- Depois correspondências que começam com o termo
    CASE WHEN LOWER(c.name) LIKE LOWER(search_term) || '%' THEN 1 ELSE 2 END,
    -- Por fim, ordenar alfabeticamente
    c.name
  LIMIT limit_count;
END;
$$;