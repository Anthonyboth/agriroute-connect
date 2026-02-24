-- Feed unificado determinístico para fretes (motorista/autônomo/afiliado/transportadora)
CREATE OR REPLACE FUNCTION public.get_unified_freight_feed(
  p_panel text,
  p_profile_id uuid,
  p_company_id uuid DEFAULT NULL,
  p_date date DEFAULT CURRENT_DATE,
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_panel text := upper(coalesce(p_panel, 'MOTORISTA'));
  v_allowed_types text[] := ARRAY[]::text[];
  v_items jsonb := '[]'::jsonb;
  v_debug jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Tipos permitidos por painel
  IF v_panel IN ('MOTORISTA', 'MOTORISTA_AUTONOMO', 'MOTORISTA_AFILIADO') THEN
    SELECT coalesce(array_agg(DISTINCT normalize_service_type_canonical(t)), ARRAY[]::text[])
      INTO v_allowed_types
    FROM profiles p
    LEFT JOIN LATERAL unnest(coalesce(p.service_types, ARRAY[]::text[])) AS t ON true
    WHERE p.id = p_profile_id;
  ELSIF v_panel = 'TRANSPORTADORA' THEN
    -- União dos tipos dos motoristas afiliados ativos + perfil atual
    WITH driver_types AS (
      SELECT normalize_service_type_canonical(t) AS t
      FROM company_drivers cd
      JOIN profiles dp ON dp.id = cd.driver_profile_id
      LEFT JOIN LATERAL unnest(coalesce(dp.service_types, ARRAY[]::text[])) AS t ON true
      WHERE cd.company_id = p_company_id
        AND coalesce(cd.status, 'ACTIVE') = 'ACTIVE'
    ), owner_types AS (
      SELECT normalize_service_type_canonical(t) AS t
      FROM profiles p
      LEFT JOIN LATERAL unnest(coalesce(p.service_types, ARRAY[]::text[])) AS t ON true
      WHERE p.id = p_profile_id
    )
    SELECT coalesce(array_agg(DISTINCT t), ARRAY[]::text[])
      INTO v_allowed_types
    FROM (
      SELECT t FROM driver_types
      UNION ALL
      SELECT t FROM owner_types
    ) x;
  END IF;

  WITH coverage_cities AS (
    SELECT DISTINCT
      uc.city_id,
      c.lat,
      c.lng,
      least(300::numeric, greatest(1::numeric, coalesce(uc.radius_km, 300::numeric))) AS radius_km
    FROM user_cities uc
    JOIN cities c ON c.id = uc.city_id
    WHERE uc.is_active = true
      AND (
        (v_panel IN ('MOTORISTA', 'MOTORISTA_AUTONOMO', 'MOTORISTA_AFILIADO')
          AND uc.user_id = p_profile_id
          AND uc.type::text IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'))
        OR
        (v_panel = 'TRANSPORTADORA'
          AND EXISTS (
            SELECT 1
            FROM company_drivers cd
            WHERE cd.company_id = p_company_id
              AND cd.driver_profile_id = uc.user_id
              AND coalesce(cd.status, 'ACTIVE') = 'ACTIVE'
          )
          AND uc.type::text IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'))
      )
  ), candidates AS (
    SELECT
      f.id,
      f.cargo_type,
      f.weight,
      f.origin_address,
      f.origin_city,
      f.origin_state,
      f.destination_address,
      f.destination_city,
      f.destination_state,
      f.pickup_date,
      f.delivery_date,
      f.price,
      f.urgency::text AS urgency,
      f.status::text AS status,
      normalize_service_type_canonical(f.service_type) AS service_type,
      f.created_at,
      f.required_trucks,
      f.accepted_trucks,
      f.minimum_antt_price,
      f.origin_city_id,
      f.origin_lat,
      f.origin_lng,
      f.origin_geog,
      f.company_id,
      f.driver_id,
      f.cancelled_at
    FROM freights f
    WHERE f.status::text = 'OPEN'
      AND f.driver_id IS NULL
      AND f.cancelled_at IS NULL
      AND (
        v_panel <> 'MOTORISTA_AFILIADO'
        OR p_company_id IS NULL
        OR f.company_id = p_company_id
      )
  ), evaluated AS (
    SELECT
      c.*,
      (c.service_type = ANY(v_allowed_types)) AS type_match,
      (
        SELECT bool_or(
          CASE
            WHEN cc.lat IS NULL OR cc.lng IS NULL THEN false
            WHEN coalesce(c.origin_geog,
                CASE
                  WHEN c.origin_lat IS NOT NULL AND c.origin_lng IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(c.origin_lng::double precision, c.origin_lat::double precision), 4326)::geography
                  ELSE NULL::geography
                END
              ) IS NULL
              THEN false
            ELSE ST_DWithin(
              coalesce(c.origin_geog,
                ST_SetSRID(ST_MakePoint(c.origin_lng::double precision, c.origin_lat::double precision), 4326)::geography
              ),
              ST_SetSRID(ST_MakePoint(cc.lng::double precision, cc.lat::double precision), 4326)::geography,
              300000
            )
          END
        )
        FROM coverage_cities cc
      ) AS within_radius_300,
      (
        SELECT bool_or(c.origin_city_id IS NOT NULL AND c.origin_city_id = cc.city_id)
        FROM coverage_cities cc
      ) AS city_id_fallback_match,
      (
        SELECT min(
          CASE
            WHEN cc.lat IS NULL OR cc.lng IS NULL THEN NULL
            WHEN coalesce(c.origin_geog,
                CASE
                  WHEN c.origin_lat IS NOT NULL AND c.origin_lng IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(c.origin_lng::double precision, c.origin_lat::double precision), 4326)::geography
                  ELSE NULL::geography
                END
              ) IS NULL
              THEN NULL
            ELSE ST_Distance(
              coalesce(c.origin_geog,
                ST_SetSRID(ST_MakePoint(c.origin_lng::double precision, c.origin_lat::double precision), 4326)::geography
              ),
              ST_SetSRID(ST_MakePoint(cc.lng::double precision, cc.lat::double precision), 4326)::geography
            ) / 1000.0
          END
        )
        FROM coverage_cities cc
      ) AS distance_km
    FROM candidates c
  ), final_eval AS (
    SELECT
      e.*,
      coalesce(e.within_radius_300, false) OR coalesce(e.city_id_fallback_match, false) AS location_match,
      CASE
        WHEN cardinality(v_allowed_types) = 0 THEN 'NO_SERVICE_TYPES_ENABLED'
        WHEN NOT e.type_match THEN 'SERVICE_TYPE_NOT_ENABLED'
        WHEN (SELECT count(*) FROM coverage_cities) = 0 THEN 'NO_COVERAGE_CITIES'
        WHEN NOT (coalesce(e.within_radius_300, false) OR coalesce(e.city_id_fallback_match, false)) THEN 'OUTSIDE_RADIUS_300KM'
        ELSE NULL
      END AS exclusion_reason
    FROM evaluated e
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'kind', 'FREIGHT',
    'service_type', f.service_type,
    'cargo_type', f.cargo_type,
    'origin_address', f.origin_address,
    'origin_city', f.origin_city,
    'origin_state', f.origin_state,
    'destination_address', f.destination_address,
    'destination_city', f.destination_city,
    'destination_state', f.destination_state,
    'pickup_date', f.pickup_date,
    'delivery_date', f.delivery_date,
    'price', f.price,
    'urgency', f.urgency,
    'status', f.status,
    'created_at', f.created_at,
    'distance_km', round(coalesce(f.distance_km, 0)::numeric, 2),
    'required_trucks', f.required_trucks,
    'accepted_trucks', f.accepted_trucks,
    'minimum_antt_price', f.minimum_antt_price
  ) ORDER BY f.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM final_eval f
  WHERE f.type_match
    AND f.location_match;

  IF p_debug THEN
    WITH coverage_cities AS (
      SELECT DISTINCT uc.city_id
      FROM user_cities uc
      WHERE uc.is_active = true
        AND (
          (v_panel IN ('MOTORISTA', 'MOTORISTA_AUTONOMO', 'MOTORISTA_AFILIADO')
            AND uc.user_id = p_profile_id
            AND uc.type::text IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'))
          OR
          (v_panel = 'TRANSPORTADORA'
            AND EXISTS (
              SELECT 1 FROM company_drivers cd
              WHERE cd.company_id = p_company_id
                AND cd.driver_profile_id = uc.user_id
                AND coalesce(cd.status, 'ACTIVE') = 'ACTIVE'
            )
            AND uc.type::text IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'))
        )
    ), candidates AS (
      SELECT f.id, normalize_service_type_canonical(f.service_type) AS service_type,
             f.status::text AS status, f.created_at, f.driver_id, f.cancelled_at, f.origin_city_id,
             f.origin_lat, f.origin_lng, f.origin_geog
      FROM freights f
      WHERE f.status::text = 'OPEN' AND f.driver_id IS NULL AND f.cancelled_at IS NULL
        AND (v_panel <> 'MOTORISTA_AFILIADO' OR p_company_id IS NULL OR f.company_id = p_company_id)
    ), eval AS (
      SELECT
        c.id,
        c.service_type,
        c.created_at,
        (c.service_type = ANY(v_allowed_types)) AS type_match,
        EXISTS (
          SELECT 1
          FROM user_cities uc
          JOIN cities ci ON ci.id = uc.city_id
          WHERE uc.is_active = true
            AND (
              (v_panel IN ('MOTORISTA', 'MOTORISTA_AUTONOMO', 'MOTORISTA_AFILIADO')
                AND uc.user_id = p_profile_id
                AND uc.type::text IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'))
              OR
              (v_panel = 'TRANSPORTADORA'
                AND EXISTS (
                  SELECT 1 FROM company_drivers cd
                  WHERE cd.company_id = p_company_id
                    AND cd.driver_profile_id = uc.user_id
                    AND coalesce(cd.status, 'ACTIVE') = 'ACTIVE'
                )
                AND uc.type::text IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO'))
            )
            AND (
              (
                coalesce(c.origin_geog,
                  CASE
                    WHEN c.origin_lat IS NOT NULL AND c.origin_lng IS NOT NULL
                      THEN ST_SetSRID(ST_MakePoint(c.origin_lng::double precision, c.origin_lat::double precision), 4326)::geography
                    ELSE NULL::geography
                  END
                ) IS NOT NULL
                AND ci.lat IS NOT NULL
                AND ci.lng IS NOT NULL
                AND ST_DWithin(
                  coalesce(c.origin_geog,
                    ST_SetSRID(ST_MakePoint(c.origin_lng::double precision, c.origin_lat::double precision), 4326)::geography
                  ),
                  ST_SetSRID(ST_MakePoint(ci.lng::double precision, ci.lat::double precision), 4326)::geography,
                  300000
                )
              )
              OR (c.origin_city_id IS NOT NULL AND c.origin_city_id = uc.city_id)
            )
        ) AS location_match
      FROM candidates c
    ), excluded AS (
      SELECT
        e.id,
        e.service_type,
        e.created_at,
        CASE
          WHEN cardinality(v_allowed_types) = 0 THEN 'NO_SERVICE_TYPES_ENABLED'
          WHEN NOT e.type_match THEN 'SERVICE_TYPE_NOT_ENABLED'
          WHEN (SELECT count(*) FROM coverage_cities) = 0 THEN 'NO_COVERAGE_CITIES'
          WHEN NOT e.location_match THEN 'OUTSIDE_RADIUS_300KM'
          ELSE NULL
        END AS reason
      FROM eval e
      WHERE NOT (e.type_match AND e.location_match)
      ORDER BY e.created_at DESC
      LIMIT 10
    )
    SELECT jsonb_build_object(
      'total_candidates', (SELECT count(*) FROM candidates),
      'total_eligible', (SELECT count(*) FROM eval WHERE type_match AND location_match),
      'total_excluded', (SELECT count(*) FROM eval WHERE NOT (type_match AND location_match)),
      'excluded', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'item_type', 'FREIGHT',
          'item_id', ex.id,
          'service_type', ex.service_type,
          'reason', ex.reason
        )) FROM excluded ex
      ), '[]'::jsonb)
    ) INTO v_debug;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'debug', CASE WHEN p_debug THEN v_debug ELSE '[]'::jsonb END
  );
END;
$$;

-- Feed unificado determinístico para serviços (prestador)
CREATE OR REPLACE FUNCTION public.get_unified_service_feed(
  p_profile_id uuid,
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_allowed_types text[] := ARRAY[]::text[];
  v_items jsonb := '[]'::jsonb;
  v_debug jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT coalesce(array_agg(DISTINCT normalize_service_type_canonical(t)), ARRAY[]::text[])
    INTO v_allowed_types
  FROM profiles p
  LEFT JOIN LATERAL unnest(coalesce(p.service_types, ARRAY[]::text[])) AS t ON true
  WHERE p.id = p_profile_id;

  WITH coverage_cities AS (
    SELECT DISTINCT uc.city_id, c.lat, c.lng
    FROM user_cities uc
    JOIN cities c ON c.id = uc.city_id
    WHERE uc.user_id = p_profile_id
      AND uc.is_active = true
      AND uc.type::text = 'PRESTADOR_SERVICO'
  ), candidates AS (
    SELECT
      sr.id,
      sr.client_id,
      normalize_service_type_canonical(sr.service_type) AS service_type,
      sr.location_address,
      sr.location_city,
      sr.location_state,
      sr.city_name,
      sr.state,
      sr.city_id,
      sr.destination_address,
      sr.destination_city,
      sr.destination_state,
      sr.location_lat,
      sr.location_lng,
      sr.problem_description,
      sr.urgency,
      sr.status,
      sr.created_at,
      sr.provider_id,
      sr.cancelled_at,
      sr.estimated_price,
      sr.contact_name
    FROM service_requests sr
    WHERE sr.status = 'OPEN'
      AND sr.provider_id IS NULL
      AND sr.cancelled_at IS NULL
  ), evaluated AS (
    SELECT
      c.*,
      (c.service_type = ANY(v_allowed_types)) AS type_match,
      (
        SELECT bool_or(
          CASE
            WHEN c.location_lat IS NOT NULL AND c.location_lng IS NOT NULL AND cc.lat IS NOT NULL AND cc.lng IS NOT NULL THEN
              ST_DWithin(
                ST_SetSRID(ST_MakePoint(c.location_lng::double precision, c.location_lat::double precision), 4326)::geography,
                ST_SetSRID(ST_MakePoint(cc.lng::double precision, cc.lat::double precision), 4326)::geography,
                300000
              )
            WHEN c.city_id IS NOT NULL THEN c.city_id = cc.city_id
            ELSE false
          END
        )
        FROM coverage_cities cc
      ) AS location_match,
      (
        SELECT min(
          CASE
            WHEN c.location_lat IS NOT NULL AND c.location_lng IS NOT NULL AND cc.lat IS NOT NULL AND cc.lng IS NOT NULL THEN
              ST_Distance(
                ST_SetSRID(ST_MakePoint(c.location_lng::double precision, c.location_lat::double precision), 4326)::geography,
                ST_SetSRID(ST_MakePoint(cc.lng::double precision, cc.lat::double precision), 4326)::geography
              ) / 1000.0
            ELSE NULL
          END
        )
        FROM coverage_cities cc
      ) AS distance_km
    FROM candidates c
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'kind', 'SERVICE',
    'service_type', e.service_type,
    'location_address', coalesce(e.location_address, e.city_name || ', ' || e.state),
    'location_city', coalesce(e.location_city, e.city_name),
    'location_state', coalesce(e.location_state, e.state),
    'destination_address', e.destination_address,
    'destination_city', e.destination_city,
    'destination_state', e.destination_state,
    'problem_description', e.problem_description,
    'urgency', e.urgency,
    'status', e.status,
    'created_at', e.created_at,
    'client_id', e.client_id,
    'estimated_price', e.estimated_price,
    'contact_name', e.contact_name,
    'distance_km', round(coalesce(e.distance_km, 0)::numeric, 2)
  ) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM evaluated e
  WHERE e.type_match AND coalesce(e.location_match, false);

  IF p_debug THEN
    WITH coverage_cities AS (
      SELECT DISTINCT uc.city_id
      FROM user_cities uc
      WHERE uc.user_id = p_profile_id
        AND uc.is_active = true
        AND uc.type::text = 'PRESTADOR_SERVICO'
    ), candidates AS (
      SELECT sr.id,
             normalize_service_type_canonical(sr.service_type) AS service_type,
             sr.city_id,
             sr.location_lat,
             sr.location_lng,
             sr.created_at
      FROM service_requests sr
      WHERE sr.status = 'OPEN' AND sr.provider_id IS NULL AND sr.cancelled_at IS NULL
    ), eval AS (
      SELECT
        c.id,
        c.service_type,
        c.created_at,
        (c.service_type = ANY(v_allowed_types)) AS type_match,
        EXISTS (
          SELECT 1
          FROM user_cities uc
          JOIN cities ci ON ci.id = uc.city_id
          WHERE uc.user_id = p_profile_id
            AND uc.is_active = true
            AND uc.type::text = 'PRESTADOR_SERVICO'
            AND (
              (
                c.location_lat IS NOT NULL
                AND c.location_lng IS NOT NULL
                AND ci.lat IS NOT NULL
                AND ci.lng IS NOT NULL
                AND ST_DWithin(
                  ST_SetSRID(ST_MakePoint(c.location_lng::double precision, c.location_lat::double precision), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(ci.lng::double precision, ci.lat::double precision), 4326)::geography,
                  300000
                )
              )
              OR (c.city_id IS NOT NULL AND c.city_id = uc.city_id)
            )
        ) AS location_match
      FROM candidates c
    ), excluded AS (
      SELECT
        e.id,
        e.service_type,
        e.created_at,
        CASE
          WHEN cardinality(v_allowed_types) = 0 THEN 'NO_SERVICE_TYPES_ENABLED'
          WHEN NOT e.type_match THEN 'SERVICE_TYPE_NOT_ENABLED'
          WHEN (SELECT count(*) FROM coverage_cities) = 0 THEN 'NO_COVERAGE_CITIES'
          WHEN NOT e.location_match THEN 'OUTSIDE_RADIUS_300KM'
          ELSE NULL
        END AS reason
      FROM eval e
      WHERE NOT (e.type_match AND e.location_match)
      ORDER BY e.created_at DESC
      LIMIT 10
    )
    SELECT jsonb_build_object(
      'total_candidates', (SELECT count(*) FROM candidates),
      'total_eligible', (SELECT count(*) FROM eval WHERE type_match AND location_match),
      'total_excluded', (SELECT count(*) FROM eval WHERE NOT (type_match AND location_match)),
      'excluded', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'item_type', 'SERVICE',
          'item_id', ex.id,
          'service_type', ex.service_type,
          'reason', ex.reason
        )) FROM excluded ex
      ), '[]'::jsonb)
    ) INTO v_debug;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'debug', CASE WHEN p_debug THEN v_debug ELSE '[]'::jsonb END
  );
END;
$$;