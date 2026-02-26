
CREATE OR REPLACE FUNCTION public.get_unified_service_feed(
  p_profile_id uuid,
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_role text;
  v_result jsonb;
BEGIN
  SELECT upper(coalesce(active_mode, role::text, 'PRESTADOR_SERVICOS'))
  INTO v_role
  FROM public.profiles
  WHERE id = p_profile_id
    AND user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Perfil inválido para usuário autenticado';
  END IF;

  IF v_role NOT IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS') THEN
    v_role := 'PRESTADOR_SERVICOS';
  END IF;

  v_result := public.get_authoritative_feed(auth.uid(), v_role, p_debug);

  RETURN jsonb_build_object(
    'items', coalesce(v_result->'service_requests', '[]'::jsonb),
    'debug', CASE WHEN p_debug THEN coalesce(v_result->'debug'->'service', jsonb_build_object()) ELSE null END,
    'metrics', v_result->'metrics'
  );
END;
$$;

COMMENT ON FUNCTION public.get_unified_service_feed(uuid, boolean)
IS 'Feed determinístico de serviços para prestador com fallback por city_id e debug de exclusões. Fix: role::text cast para evitar erro 42804.';
