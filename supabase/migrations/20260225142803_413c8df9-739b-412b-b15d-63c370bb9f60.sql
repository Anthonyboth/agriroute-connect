CREATE OR REPLACE FUNCTION public.get_authoritative_feed(p_user_id uuid, p_role text, p_debug boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_auth_uid uuid := auth.uid();
  v_role text := upper(coalesce(p_role, ''));
  v_profile_id uuid;
  v_company_id uuid;
  v_freights jsonb := '[]'::jsonb;
  v_services jsonb := '[]'::jsonb;
  v_debug_freight jsonb := jsonb_build_object('total_candidates', 0, 'total_eligible', 0, 'total_excluded', 0, 'excluded', '[]'::jsonb);
  v_debug_service jsonb := jsonb_build_object('total_candidates', 0, 'total_eligible', 0, 'total_excluded', 0, 'excluded', '[]'::jsonb);
  v_fallback_used boolean := false;
  v_total_eligible integer := 0;
  v_total_displayed integer := 0;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não autorizado: p_user_id divergente do usuário autenticado';
  END IF;

  IF v_role NOT IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS') THEN
    RAISE EXCEPTION 'Role inválida: %', p_role;
  END IF;

  -- Selecionar perfil coerente com o painel/role solicitado
  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_auth_uid
    AND (
      upper(coalesce(p.active_mode, '')) = v_role
      OR upper(coalesce(p.role::text, '')) = v_role
      OR (
        v_role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
        AND upper(coalesce(p.role::text, '')) IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
      )
    )
  ORDER BY
    CASE
      WHEN upper(coalesce(p.active_mode, '')) = v_role THEN 0
      WHEN upper(coalesce(p.role::text, '')) = v_role THEN 1
      ELSE 2
    END,
    p.created_at ASC
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    SELECT p.id
    INTO v_profile_id
    FROM public.profiles p
    WHERE p.user_id = v_auth_uid
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para usuário autenticado';
  END IF;

  IF v_role = 'TRANSPORTADORA' THEN
    SELECT tc.id
    INTO v_company_id
    FROM public.transport_companies tc
    JOIN public.profiles owner_profile ON owner_profile.id = tc.profile_id
    WHERE owner_profile.user_id = v_auth_uid
    ORDER BY tc.created_at ASC
    LIMIT 1;

    IF v_company_id IS NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Transportadora não vinculada ao usuário autenticado';
    END IF;
  END IF;

  -- Motorista afiliado: resolver empresa para fallback de escopo regional/tipos
  IF v_role = 'MOTORISTA_AFILIADO' THEN
    SELECT cd.company_id
    INTO v_company_id
    FROM public.company_drivers cd
    WHERE cd.driver_profile_id = v_profile_id
      AND upper(coalesce(cd.status, '')) = 'ACTIVE'
      AND cd.company_id IS NOT NULL
    ORDER BY cd.updated_at DESC NULLS LAST, cd.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- STRICT / authoritative freight visibility
  WITH source_profiles AS (
    SELECT p.id, p.user_id, p.service_types
    FROM public.profiles p
    WHERE (
      v_role = 'TRANSPORTADORA'
      AND (
        -- Inclui o perfil dono da transportadora como fallback de cidades/tipos
        p.id = v_profile_id
        OR EXISTS (
          SELECT 1
          FROM public.company_drivers cd
          WHERE cd.company_id = v_company_id
            AND cd.driver_profile_id = p.id
            AND upper(coalesce(cd.status, '')) = 'ACTIVE'
        )
      )
    )
    OR (
      v_role = 'MOTORISTA_AFILIADO'
      AND (
        -- Perfil do afiliado
        p.id = v_profile_id
        -- Perfil dono da empresa afiliada (fallback regional)
        OR EXISTS (
          SELECT 1
          FROM public.transport_companies tc
          WHERE tc.id = v_company_id
            AND tc.profile_id = p.id
        )
        -- Demais afiliados ativos da mesma empresa (paridade com lógica da transportadora)
        OR EXISTS (
          SELECT 1
          FROM public.company_drivers cd
          WHERE cd.company_id = v_company_id
            AND cd.driver_profile_id = p.id
            AND upper(coalesce(cd.status, '')) = 'ACTIVE'
        )
      )
    )
    OR (
      v_role NOT IN ('TRANSPORTADORA', 'MOTORISTA_AFILIADO')
      AND p.id = v_profile_id
    )
  ),
  viewer_types AS (
    SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
    FROM source_profiles sp
    LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY['CARGA']::text[])) AS t ON true
  ),
  viewer_cities AS (
    SELECT DISTINCT
      uc.city_id,
      c.lat,
      c.lng
    FROM source_profiles sp
    JOIN public.user_cities uc
      ON uc.user_id = sp.user_id
     AND uc.is_active = true
    JOIN public.cities c
      ON c.id = uc.city_id
  ),
  candidates AS (
    SELECT
      f.*,
      normalize_service_type_canonical(f.service_type) AS canonical_service_type,
      COALESCE(f.origin_lat::double precision, co.lat) AS effective_origin_lat,
      COALESCE(f.origin_lng::double precision, co.lng) AS effective_origin_lng
    FROM public.freights f
    LEFT JOIN public.cities co ON co.id = f.origin_city_id
  ),
  evaluated AS (
    SELECT
      c.*,
      EXISTS (
        SELECT 1
        FROM viewer_types vt
        WHERE vt.service_type = c.canonical_service_type
      ) AS type_match,
      EXISTS (
        SELECT 1
        FROM viewer_cities vc
        WHERE (
          c.effective_origin_lat IS NOT NULL
          AND c.effective_origin_lng IS NOT NULL
          AND vc.lat IS NOT NULL
          AND vc.lng IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(c.effective_origin_lng, c.effective_origin_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography,
            300000
          )
        ) OR (
          c.effective_origin_lat IS NULL
          AND c.effective_origin_lng IS NULL
          AND c.origin_city_id IS NOT NULL
          AND c.origin_city_id = vc.city_id
        )
      ) AS location_match,
      (
        c.status::text = 'OPEN'
        AND c.cancelled_at IS NULL
        AND coalesce(c.accepted_trucks, 0) < coalesce(c.required_trucks, 1)
      ) AS status_match
    FROM candidates c
  ),
  eligible AS (
    SELECT *
    FROM evaluated e
    WHERE e.type_match AND e.location_match AND e.status_match
    ORDER BY e.created_at DESC
  ),
  debug_rows AS (
    SELECT
      e.id,
      e.canonical_service_type,
      CASE
        WHEN NOT e.status_match THEN 'status'
        WHEN NOT e.type_match THEN 'service_type'
        WHEN NOT e.location_match THEN 'location'
        ELSE NULL
      END AS reason
    FROM evaluated e
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(el) - 'type_match' - 'location_match' - 'status_match' - 'effective_origin_lat' - 'effective_origin_lng' - 'canonical_service_type'), '[]'::jsonb),
    jsonb_build_object(
      'total_candidates', (SELECT count(*) FROM evaluated),
      'total_eligible', (SELECT count(*) FROM eligible),
      'total_excluded', (SELECT count(*) FROM debug_rows WHERE reason IS NOT NULL),
      'excluded', coalesce(
        (
          SELECT jsonb_agg(jsonb_build_object(
            'item_type', 'FREIGHT',
            'item_id', dr.id,
            'service_type', dr.canonical_service_type,
            'reason', dr.reason
          ))
          FROM debug_rows dr
          WHERE dr.reason IS NOT NULL
        ),
        '[]'::jsonb
      )
    ),
    (SELECT count(*) FROM eligible)
  INTO v_freights, v_debug_freight, v_total_eligible
  FROM eligible el;

  -- Services (provider only)
  IF v_role = 'PRESTADOR_SERVICOS' THEN
    WITH service_candidates AS (
      SELECT
        sr.*, 
        normalize_service_type_canonical(sr.service_type) AS canonical_service_type
      FROM public.service_requests sr
      WHERE sr.status = 'OPEN'
        AND sr.provider_id IS NULL
    ),
    source_profiles AS (
      SELECT p.id, p.user_id, p.service_types
      FROM public.profiles p
      WHERE p.id = v_profile_id
    ),
    viewer_types AS (
      SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
      FROM source_profiles sp
      LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY[]::text[])) AS t ON true
    ),
    viewer_cities AS (
      SELECT DISTINCT uc.city_id
      FROM source_profiles sp
      JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true
    ),
    service_eval AS (
      SELECT
        s.*, 
        EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = s.canonical_service_type) AS type_match,
        EXISTS (SELECT 1 FROM viewer_cities vc WHERE vc.city_id = s.city_id) AS city_match
      FROM service_candidates s
    ),
    service_eligible AS (
      SELECT *
      FROM service_eval
      WHERE type_match AND city_match
      ORDER BY created_at DESC
    )
    SELECT
      coalesce(jsonb_agg(to_jsonb(se) - 'canonical_service_type' - 'type_match' - 'city_match'), '[]'::jsonb),
      jsonb_build_object(
        'total_candidates', (SELECT count(*) FROM service_eval),
        'total_eligible', (SELECT count(*) FROM service_eligible),
        'total_excluded', (SELECT count(*) FROM service_eval WHERE NOT (type_match AND city_match)),
        'excluded', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'item_type', 'SERVICE',
            'item_id', x.id,
            'service_type', x.canonical_service_type,
            'reason', CASE
              WHEN NOT x.type_match THEN 'service_type'
              WHEN NOT x.city_match THEN 'location'
              ELSE 'unknown'
            END
          ))
          FROM service_eval x
          WHERE NOT (x.type_match AND city_match)
        ), '[]'::jsonb)
      )
    INTO v_services, v_debug_service
    FROM service_eligible se;
  END IF;

  v_total_displayed := coalesce(jsonb_array_length(v_freights), 0) + coalesce(jsonb_array_length(v_services), 0);

  RETURN jsonb_build_object(
    'freights', coalesce(v_freights, '[]'::jsonb),
    'service_requests', coalesce(v_services, '[]'::jsonb),
    'metrics', jsonb_build_object(
      'feed_total_eligible', coalesce(v_total_eligible, 0),
      'feed_total_displayed', coalesce(v_total_displayed, 0),
      'fallback_used', v_fallback_used,
      'role', v_role
    ),
    'debug', CASE
      WHEN p_debug THEN jsonb_build_object(
        'freight', v_debug_freight,
        'service', v_debug_service,
        'excluded_items', coalesce(v_debug_freight->'excluded', '[]'::jsonb) || coalesce(v_debug_service->'excluded', '[]'::jsonb)
      )
      ELSE NULL
    END
  );
END;
$function$;