-- Criar função para buscar estatísticas da plataforma
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  produtores bigint,
  motoristas bigint,
  fretes_entregues bigint,
  peso_total numeric,
  total_fretes bigint,
  total_usuarios bigint,
  avaliacao_media numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE role = 'PRODUTOR')::bigint as produtores,
    (SELECT COUNT(*) FROM profiles WHERE role = 'MOTORISTA')::bigint as motoristas,
    (SELECT COUNT(*) FROM freights WHERE status = 'DELIVERED')::bigint as fretes_entregues,
    (SELECT COALESCE(SUM(weight), 0) FROM freights WHERE status = 'DELIVERED') as peso_total,
    (SELECT COUNT(*) FROM freights)::bigint as total_fretes,
    (SELECT COUNT(*) FROM profiles)::bigint as total_usuarios,
    (SELECT COALESCE(AVG(rating), 0) FROM profiles WHERE rating IS NOT NULL AND rating > 0) as avaliacao_media;
END;
$$;