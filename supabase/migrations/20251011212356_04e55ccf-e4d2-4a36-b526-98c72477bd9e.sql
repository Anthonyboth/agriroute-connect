-- Drop e recriar função get_platform_stats com campo prestadores
DROP FUNCTION IF EXISTS public.get_platform_stats();

CREATE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  produtores bigint,
  motoristas bigint,
  prestadores bigint,
  fretes_entregues bigint,
  peso_total numeric,
  total_fretes bigint,
  total_usuarios bigint,
  avaliacao_media numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'PRODUTOR')::bigint as produtores,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'MOTORISTA')::bigint as motoristas,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'PRESTADOR_SERVICOS' AND status = 'APPROVED')::bigint as prestadores,
    (SELECT COUNT(*) FROM public.freights WHERE status = 'DELIVERED')::bigint as fretes_entregues,
    (SELECT COALESCE(SUM(weight), 0) FROM public.freights WHERE status = 'DELIVERED') as peso_total,
    (SELECT COUNT(*) FROM public.freights)::bigint as total_fretes,
    (SELECT COUNT(*) FROM public.profiles)::bigint as total_usuarios,
    (SELECT COALESCE(AVG(rating), 0) FROM public.profiles WHERE rating IS NOT NULL AND rating > 0) as avaliacao_media;
END;
$function$;