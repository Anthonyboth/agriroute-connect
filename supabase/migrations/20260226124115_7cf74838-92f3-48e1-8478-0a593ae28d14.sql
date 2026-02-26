CREATE OR REPLACE FUNCTION public.get_unified_service_feed(
  p_profile_id uuid,
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_role text;
  v_profile_service_types text[];
  v_result jsonb;
  v_items jsonb := '[]'::jsonb;
  v_debug jsonb := jsonb_build_object(
    'total_candidates', 0,
    'total_eligible', 0,
    'total_excluded', 0,
    'excluded', '[]'::jsonb
  );
  v_fallback_used boolean := false;
BEGIN
  SELECT
    upper(coalesce(active_mode, role::text, 'PRESTADOR_SERVICOS')),
    coalesce(service_types, ARRAY[]::text[])
  INTO v_role, v_profile_service_types
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

  IF v_role = 'PRESTADOR_SERVICOS' THEN
    WITH viewer_types AS (
      SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
      FROM unnest(v_profile_service_types) AS t
    ),
    viewer_cities AS (
      SELECT DISTINCT uc.city_id
      FROM public.user_cities uc
      WHERE uc.user_id = auth.uid()
        AND uc.is_active = true
    ),
    candidates AS (
      SELECT
        sr.*,
        normalize_service_type_canonical(sr.service_type) AS canonical_service_type
      FROM public.service_requests sr
      WHERE sr.status = 'OPEN'
        AND sr.provider_id IS NULL
    ),
    service_eval AS (
      SELECT
        c.*,
        EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = c.canonical_service_type) AS type_match,
        EXISTS (SELECT 1 FROM viewer_cities vc WHERE vc.city_id = c.city_id) AS city_match
      FROM candidates c
    ),
    eligible_strict AS (
      SELECT *
      FROM service_eval
      WHERE type_match
        AND city_match
    ),
    strict_count AS (
      SELECT count(*)::int AS cnt FROM eligible_strict
    ),
    chosen AS (
      SELECT * FROM eligible_strict
      UNION ALL
      SELECT *
      FROM service_eval
      WHERE (SELECT cnt FROM strict_count) = 0
    ),
    chosen_limited AS (
      SELECT *
      FROM chosen
      ORDER BY created_at DESC
      LIMIT 50
    )
    SELECT
      coalesce(
        jsonb_agg(to_jsonb(e) - 'canonical_service_type' - 'type_match' - 'city_match'),
        '[]'::jsonb
      ),
      jsonb_build_object(
        'total_candidates', (SELECT count(*) FROM service_eval),
        'total_eligible', (SELECT count(*) FROM eligible_strict),
        'total_excluded', (SELECT count(*) FROM service_eval se WHERE NOT (se.type_match AND se.city_match)),
        'excluded', coalesce(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'item_type', 'SERVICE',
                'item_id', x.id,
                'service_type', x.canonical_service_type,
                'reason', CASE
                  WHEN NOT x.type_match THEN 'service_type'
                  WHEN NOT x.city_match THEN 'location'
                  ELSE 'unknown'
                END
              )
            )
            FROM service_eval x
            WHERE NOT (x.type_match AND x.city_match)
          ),
          '[]'::jsonb
        )
      ),
      ((SELECT cnt FROM strict_count) = 0 AND (SELECT count(*) FROM service_eval) > 0)
    INTO v_items, v_debug, v_fallback_used
    FROM chosen_limited e;

    RETURN jsonb_build_object(
      'items', v_items,
      'debug', CASE WHEN p_debug THEN v_debug ELSE null END,
      'metrics', jsonb_build_object(
        'feed_total_eligible', coalesce((v_debug->>'total_eligible')::int, 0),
        'feed_total_displayed', coalesce(jsonb_array_length(v_items), 0),
        'fallback_used', v_fallback_used,
        'role', v_role
      )
    );
  END IF;

  v_result := public.get_authoritative_feed(auth.uid(), v_role, p_debug);

  RETURN jsonb_build_object(
    'items', coalesce(v_result->'service_requests', '[]'::jsonb),
    'debug', CASE WHEN p_debug THEN coalesce(v_result->'debug'->'service', jsonb_build_object()) ELSE null END,
    'metrics', v_result->'metrics'
  );
END;
$function$;

COMMENT ON FUNCTION public.get_unified_service_feed(uuid, boolean)
IS 'Feed unificado de serviços com cast role::text e fallback controlado para PRESTADOR_SERVICOS quando não houver match estrito por tipo+cidade.';