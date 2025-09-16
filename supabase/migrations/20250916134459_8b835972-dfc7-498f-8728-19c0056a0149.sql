-- Public stats function to bypass RLS safely
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE(
  total_drivers bigint,
  total_producers bigint,
  total_freights bigint,
  active_freights bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'MOTORISTA' AND status = 'APPROVED')::bigint AS total_drivers,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'PRODUTOR' AND status = 'APPROVED')::bigint AS total_producers,
    (SELECT COUNT(*) FROM public.freights)::bigint AS total_freights,
    (SELECT COUNT(*) FROM public.freights WHERE status IN ('OPEN','ACCEPTED','IN_TRANSIT'))::bigint AS active_freights;
END;
$function$;