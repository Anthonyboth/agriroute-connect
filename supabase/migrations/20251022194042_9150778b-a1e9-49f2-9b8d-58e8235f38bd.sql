-- =====================================================
-- Fix: Incluir TODAS as fontes de avaliação no perfil
-- =====================================================
-- Problema: get_user_rating_distribution só buscava da tabela 'ratings'
-- Solução: Fazer UNION ALL de ratings, freight_ratings e service_ratings

-- Atualizar função RPC para buscar de todas as tabelas
CREATE OR REPLACE FUNCTION public.get_user_rating_distribution(p_user_id UUID)
RETURNS TABLE(
  star_rating INTEGER,
  count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    combined.rating as star_rating,
    COUNT(*)::BIGINT as count
  FROM (
    -- Ratings antigos
    SELECT rating 
    FROM public.ratings 
    WHERE rated_user_id = p_user_id
    
    UNION ALL
    
    -- Avaliações de fretes
    SELECT rating 
    FROM public.freight_ratings 
    WHERE rated_user_id = p_user_id
    
    UNION ALL
    
    -- Avaliações de serviços
    SELECT rating 
    FROM public.service_ratings 
    WHERE rated_user_id = p_user_id
  ) AS combined
  GROUP BY combined.rating
  ORDER BY combined.rating DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_rating_distribution IS 
'Retorna distribuição de avaliações por estrelas. Busca em ratings, freight_ratings e service_ratings.';

-- =====================================================
-- Nova função auxiliar para estatísticas consolidadas
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_rating_stats(p_user_id UUID)
RETURNS TABLE(
  total_ratings BIGINT,
  average_rating NUMERIC,
  five_star BIGINT,
  four_star BIGINT,
  three_star BIGINT,
  two_star BIGINT,
  one_star BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH all_ratings AS (
    SELECT rating FROM public.ratings WHERE rated_user_id = p_user_id
    UNION ALL
    SELECT rating FROM public.freight_ratings WHERE rated_user_id = p_user_id
    UNION ALL
    SELECT rating FROM public.service_ratings WHERE rated_user_id = p_user_id
  )
  SELECT 
    COUNT(*)::BIGINT as total_ratings,
    ROUND(AVG(rating)::numeric, 1) as average_rating,
    COUNT(CASE WHEN rating = 5 THEN 1 END)::BIGINT as five_star,
    COUNT(CASE WHEN rating = 4 THEN 1 END)::BIGINT as four_star,
    COUNT(CASE WHEN rating = 3 THEN 1 END)::BIGINT as three_star,
    COUNT(CASE WHEN rating = 2 THEN 1 END)::BIGINT as two_star,
    COUNT(CASE WHEN rating = 1 THEN 1 END)::BIGINT as one_star
  FROM all_ratings;
END;
$$;

COMMENT ON FUNCTION public.get_user_rating_stats IS 
'Retorna estatísticas consolidadas de avaliações do usuário de todas as fontes (ratings, freight_ratings, service_ratings).';