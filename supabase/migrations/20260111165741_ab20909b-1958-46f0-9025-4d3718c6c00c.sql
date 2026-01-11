-- Primeiro dropar a função existente para poder alterar o tipo de retorno
DROP FUNCTION IF EXISTS public.get_platform_stats();

-- Recriar com o novo campo prestadores
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_usuarios bigint,
  total_fretes bigint,
  peso_total numeric,
  avaliacao_media numeric,
  motoristas bigint,
  produtores bigint,
  prestadores bigint,
  fretes_entregues bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE status = 'APPROVED')::bigint AS total_usuarios,
    (SELECT COUNT(*) FROM freights)::bigint AS total_fretes,
    COALESCE((SELECT SUM(weight) FROM freights WHERE status = 'DELIVERED'), 0)::numeric AS peso_total,
    COALESCE((SELECT AVG(rating) FROM ratings), 0)::numeric AS avaliacao_media,
    (SELECT COUNT(*) FROM profiles WHERE role = 'MOTORISTA' AND status = 'APPROVED')::bigint AS motoristas,
    (SELECT COUNT(*) FROM profiles WHERE role = 'PRODUTOR' AND status = 'APPROVED')::bigint AS produtores,
    (SELECT COUNT(*) FROM profiles WHERE role = 'PRESTADOR_SERVICOS' AND status = 'APPROVED')::bigint AS prestadores,
    (SELECT COUNT(*) FROM freights WHERE status = 'DELIVERED')::bigint AS fretes_entregues;
END;
$$;