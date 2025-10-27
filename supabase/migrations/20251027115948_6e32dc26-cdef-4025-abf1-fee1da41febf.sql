-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.get_platform_stats();

-- Create fixed platform stats RPC to work for unauthenticated users
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
    (SELECT COUNT(*) FROM profiles WHERE role = 'PRODUTOR')::bigint AS produtores,
    (SELECT COUNT(*) FROM profiles WHERE role IN ('MOTORISTA','MOTORISTA_AFILIADO'))::bigint AS motoristas,
    (SELECT COUNT(*) FROM freights WHERE status IN ('DELIVERED','COMPLETED'))::bigint AS fretes_entregues,
    (SELECT COALESCE(SUM(weight), 0) FROM freights WHERE status IN ('DELIVERED','COMPLETED')) AS peso_total,
    (SELECT COUNT(*) FROM freights)::bigint AS total_fretes,
    (SELECT COUNT(*) FROM profiles)::bigint AS total_usuarios,
    (SELECT COALESCE(AVG(rating), 0) FROM profiles WHERE rating IS NOT NULL AND rating > 0) AS avaliacao_media;
END;
$$;