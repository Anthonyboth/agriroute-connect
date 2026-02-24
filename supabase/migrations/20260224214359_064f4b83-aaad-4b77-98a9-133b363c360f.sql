-- P0 Feed Integrity: deterministic, authoritative visibility source with built-in fallback and debug reasons
CREATE OR REPLACE FUNCTION public.get_authoritative_feed(
  p_user_id uuid,
  p_role text,
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_auth_uid
  ORDER BY p.created_at ASC
  LIMIT 1;

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

  -- STRICT / authoritative freight visibility
  WITH source_profiles AS (
    SELECT p.id, p.user_id, p.service_types
    FROM public.profiles p
    WHERE (
      v_role = 'TRANSPORTADORA'
      AND EXISTS (
        SELECT 1
        FROM public.company_drivers cd
        WHERE cd.company_id = v_company_id
          AND cd.driver_profile_id = p.id
          AND upper(coalesce(cd.status, '')) = 'ACTIVE'
      )
    )
    OR (
      v_role <> 'TRANSPORTADORA'
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
        AND coalesce(c.accepted_trucks, 0) < greatest(coalesce(c.required_trucks, 1), 1)
        AND c.driver_id IS NULL
      ) AS status_match
    FROM candidates c
  ),
  eligible AS (
    SELECT *
    FROM evaluated
    WHERE status_match AND type_match AND location_match
    ORDER BY created_at DESC
    LIMIT 300
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'kind', 'FREIGHT',
      'cargo_type', e.cargo_type,
      'weight', e.weight,
      'origin_address', e.origin_address,
      'destination_address', e.destination_address,
      'origin_city', e.origin_city,
      'origin_state', e.origin_state,
      'destination_city', e.destination_city,
      'destination_state', e.destination_state,
      'pickup_date', e.pickup_date,
      'delivery_date', e.delivery_date,
      'price', e.price,
      'urgency', e.urgency,
      'status', e.status,
      'service_type', e.canonical_service_type,
      'distance_km', e.distance_km,
      'distance_to_origin_km', (
        SELECT round(min(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(e.effective_origin_lng, e.effective_origin_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography
          ) / 1000.0
        )::numeric, 2)
        FROM (
          SELECT DISTINCT uc.city_id, c2.lat, c2.lng
          FROM public.profiles sp2
          JOIN public.user_cities uc ON uc.user_id = sp2.user_id AND uc.is_active = true
          JOIN public.cities c2 ON c2.id = uc.city_id
          WHERE (
            v_role = 'TRANSPORTADORA'
            AND EXISTS (
              SELECT 1 FROM public.company_drivers cd2
              WHERE cd2.company_id = v_company_id
                AND cd2.driver_profile_id = sp2.id
                AND upper(coalesce(cd2.status, '')) = 'ACTIVE'
            )
          ) OR (
            v_role <> 'TRANSPORTADORA' AND sp2.id = v_profile_id
          )
        ) vc
        WHERE e.effective_origin_lat IS NOT NULL AND e.effective_origin_lng IS NOT NULL
      ),
      'minimum_antt_price', e.minimum_antt_price,
      'required_trucks', e.required_trucks,
      'accepted_trucks', e.accepted_trucks,
      'created_at', e.created_at,
      'origin_city_id', e.origin_city_id,
      'vehicle_type_required', e.vehicle_type_required,
      'vehicle_axles_required', e.vehicle_axles_required,
      'pricing_type', e.pricing_type,
      'price_per_km', e.price_per_km
    ) ORDER BY e.created_at DESC), '[]'::jsonb),
    (SELECT count(*) FROM eligible)
  INTO v_freights, v_total_eligible
  FROM eligible e;

  -- STRICT / authoritative service visibility
  WITH source_profiles AS (
    SELECT p.id, p.user_id, p.service_types
    FROM public.profiles p
    WHERE (
      v_role = 'TRANSPORTADORA'
      AND EXISTS (
        SELECT 1
        FROM public.company_drivers cd
        WHERE cd.company_id = v_company_id
          AND cd.driver_profile_id = p.id
          AND upper(coalesce(cd.status, '')) = 'ACTIVE'
      )
    )
    OR (
      v_role <> 'TRANSPORTADORA'
      AND p.id = v_profile_id
    )
  ),
  viewer_types AS (
    SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
    FROM source_profiles sp
    LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY[]::text[])) AS t ON true
  ),
  viewer_cities AS (
    SELECT DISTINCT uc.city_id, c.lat, c.lng
    FROM source_profiles sp
    JOIN public.user_cities uc
      ON uc.user_id = sp.user_id
     AND uc.is_active = true
    JOIN public.cities c ON c.id = uc.city_id
  ),
  candidates AS (
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
      sr.contact_name,
      sr.vehicle_info,
      sr.additional_info,
      sr.is_emergency
    FROM public.service_requests sr
  ),
  evaluated AS (
    SELECT
      c.*,
      EXISTS (
        SELECT 1 FROM viewer_types vt WHERE vt.service_type = c.service_type
      ) AS type_match,
      EXISTS (
        SELECT 1
        FROM viewer_cities vc
        WHERE (
          c.location_lat IS NOT NULL
          AND c.location_lng IS NOT NULL
          AND vc.lat IS NOT NULL
          AND vc.lng IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(c.location_lng::double precision, c.location_lat::double precision), 4326)::geography,
            ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography,
            300000
          )
        ) OR (
          c.city_id IS NOT NULL
          AND c.city_id = vc.city_id
        )
      ) AS city_match,
      (
        c.status = 'OPEN'
        AND c.provider_id IS NULL
        AND c.cancelled_at IS NULL
      ) AS status_match
    FROM candidates c
  ),
  eligible AS (
    SELECT *
    FROM evaluated
    WHERE status_match AND type_match AND city_match
    ORDER BY created_at DESC
    LIMIT 300
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'kind', 'SERVICE',
      'service_type', e.service_type,
      'location_address', coalesce(e.location_address, e.city_name || ', ' || e.state),
      'location_city', coalesce(e.location_city, e.city_name),
      'location_state', coalesce(e.location_state, e.state),
      'city_name', e.city_name,
      'state', e.state,
      'city_id', e.city_id,
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
      'vehicle_info', e.vehicle_info,
      'additional_info', e.additional_info,
      'is_emergency', e.is_emergency,
      'location_lat', e.location_lat,
      'location_lng', e.location_lng
    ) ORDER BY e.created_at DESC), '[]'::jsonb),
    v_total_eligible + (SELECT count(*) FROM eligible)
  INTO v_services, v_total_eligible
  FROM eligible e;

  -- Fail-safe fallback: if strict feed is empty, use simplified city+type visibility only
  IF jsonb_array_length(v_freights) + jsonb_array_length(v_services) = 0 THEN
    WITH source_profiles AS (
      SELECT p.id, p.user_id, p.service_types
      FROM public.profiles p
      WHERE (
        v_role = 'TRANSPORTADORA'
        AND EXISTS (
          SELECT 1
          FROM public.company_drivers cd
          WHERE cd.company_id = v_company_id
            AND cd.driver_profile_id = p.id
            AND upper(coalesce(cd.status, '')) = 'ACTIVE'
        )
      )
      OR (
        v_role <> 'TRANSPORTADORA'
        AND p.id = v_profile_id
      )
    ),
    viewer_types AS (
      SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
      FROM source_profiles sp
      LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY[]::text[])) AS t ON true
    ),
    viewer_city_ids AS (
      SELECT DISTINCT uc.city_id
      FROM source_profiles sp
      JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true
    ),
    fallback_freights AS (
      SELECT f.*,
             normalize_service_type_canonical(f.service_type) AS canonical_service_type
      FROM public.freights f
      WHERE f.status::text = 'OPEN'
        AND f.driver_id IS NULL
        AND f.cancelled_at IS NULL
        AND coalesce(f.accepted_trucks, 0) < greatest(coalesce(f.required_trucks, 1), 1)
        AND EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = normalize_service_type_canonical(f.service_type))
        AND f.origin_city_id IN (SELECT city_id FROM viewer_city_ids)
      ORDER BY f.created_at DESC
      LIMIT 300
    ),
    fallback_services AS (
      SELECT sr.*,
             normalize_service_type_canonical(sr.service_type) AS canonical_service_type
      FROM public.service_requests sr
      WHERE sr.status = 'OPEN'
        AND sr.provider_id IS NULL
        AND sr.cancelled_at IS NULL
        AND EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = normalize_service_type_canonical(sr.service_type))
        AND sr.city_id IN (SELECT city_id FROM viewer_city_ids)
      ORDER BY sr.created_at DESC
      LIMIT 300
    )
    SELECT
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', f.id,
        'kind', 'FREIGHT',
        'cargo_type', f.cargo_type,
        'weight', f.weight,
        'origin_address', f.origin_address,
        'destination_address', f.destination_address,
        'origin_city', f.origin_city,
        'origin_state', f.origin_state,
        'destination_city', f.destination_city,
        'destination_state', f.destination_state,
        'pickup_date', f.pickup_date,
        'delivery_date', f.delivery_date,
        'price', f.price,
        'urgency', f.urgency,
        'status', f.status,
        'service_type', f.canonical_service_type,
        'distance_km', f.distance_km,
        'minimum_antt_price', f.minimum_antt_price,
        'required_trucks', f.required_trucks,
        'accepted_trucks', f.accepted_trucks,
        'created_at', f.created_at,
        'origin_city_id', f.origin_city_id,
        'vehicle_type_required', f.vehicle_type_required,
        'vehicle_axles_required', f.vehicle_axles_required,
        'pricing_type', f.pricing_type,
        'price_per_km', f.price_per_km,
        'fallback_matched', true
      )) FROM fallback_freights f), '[]'::jsonb),
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'kind', 'SERVICE',
        'service_type', s.canonical_service_type,
        'location_address', coalesce(s.location_address, s.city_name || ', ' || s.state),
        'location_city', coalesce(s.location_city, s.city_name),
        'location_state', coalesce(s.location_state, s.state),
        'city_name', s.city_name,
        'state', s.state,
        'city_id', s.city_id,
        'destination_address', s.destination_address,
        'destination_city', s.destination_city,
        'destination_state', s.destination_state,
        'problem_description', s.problem_description,
        'urgency', s.urgency,
        'status', s.status,
        'created_at', s.created_at,
        'client_id', s.client_id,
        'estimated_price', s.estimated_price,
        'contact_name', s.contact_name,
        'vehicle_info', s.vehicle_info,
        'additional_info', s.additional_info,
        'is_emergency', s.is_emergency,
        'location_lat', s.location_lat,
        'location_lng', s.location_lng,
        'fallback_matched', true
      )) FROM fallback_services s), '[]'::jsonb)
    INTO v_freights, v_services;

    IF jsonb_array_length(v_freights) + jsonb_array_length(v_services) > 0 THEN
      v_fallback_used := true;
      v_total_eligible := jsonb_array_length(v_freights) + jsonb_array_length(v_services);
    END IF;
  END IF;

  v_total_displayed := jsonb_array_length(v_freights) + jsonb_array_length(v_services);

  IF p_debug THEN
    WITH source_profiles AS (
      SELECT p.id, p.user_id, p.service_types
      FROM public.profiles p
      WHERE (
        v_role = 'TRANSPORTADORA'
        AND EXISTS (
          SELECT 1
          FROM public.company_drivers cd
          WHERE cd.company_id = v_company_id
            AND cd.driver_profile_id = p.id
            AND upper(coalesce(cd.status, '')) = 'ACTIVE'
        )
      )
      OR (
        v_role <> 'TRANSPORTADORA'
        AND p.id = v_profile_id
      )
    ),
    viewer_types AS (
      SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
      FROM source_profiles sp
      LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY[]::text[])) AS t ON true
    ),
    viewer_cities AS (
      SELECT DISTINCT uc.city_id, c.lat, c.lng
      FROM source_profiles sp
      JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true
      JOIN public.cities c ON c.id = uc.city_id
    ),
    freight_eval AS (
      SELECT
        f.id,
        normalize_service_type_canonical(f.service_type) AS service_type,
        f.created_at,
        CASE
          WHEN NOT (f.status::text = 'OPEN' AND f.cancelled_at IS NULL) THEN 'STATUS_NOT_OPEN'
          WHEN coalesce(f.accepted_trucks, 0) >= greatest(coalesce(f.required_trucks, 1), 1) OR f.driver_id IS NOT NULL THEN 'ALREADY_ASSIGNED'
          WHEN NOT EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = normalize_service_type_canonical(f.service_type)) THEN 'TYPE_NOT_COMPATIBLE'
          WHEN (coalesce(f.origin_lat::double precision, c.lat) IS NULL OR coalesce(f.origin_lng::double precision, c.lng) IS NULL) AND f.origin_city_id IS NULL THEN 'INVALID_COORDINATES'
          WHEN NOT EXISTS (
            SELECT 1 FROM viewer_cities vc
            WHERE (
              coalesce(f.origin_lat::double precision, c.lat) IS NOT NULL
              AND coalesce(f.origin_lng::double precision, c.lng) IS NOT NULL
              AND vc.lat IS NOT NULL
              AND vc.lng IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(coalesce(f.origin_lng::double precision, c.lng), coalesce(f.origin_lat::double precision, c.lat)), 4326)::geography,
                ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography,
                300000
              )
            ) OR (
              coalesce(f.origin_lat::double precision, c.lat) IS NULL
              AND coalesce(f.origin_lng::double precision, c.lng) IS NULL
              AND f.origin_city_id IS NOT NULL
              AND f.origin_city_id = vc.city_id
            )
          ) AND f.origin_city_id IS NOT NULL THEN 'CITY_NOT_MATCH'
          WHEN NOT EXISTS (
            SELECT 1 FROM viewer_cities vc
            WHERE (
              coalesce(f.origin_lat::double precision, c.lat) IS NOT NULL
              AND coalesce(f.origin_lng::double precision, c.lng) IS NOT NULL
              AND vc.lat IS NOT NULL
              AND vc.lng IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(coalesce(f.origin_lng::double precision, c.lng), coalesce(f.origin_lat::double precision, c.lat)), 4326)::geography,
                ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography,
                300000
              )
            ) OR (
              coalesce(f.origin_lat::double precision, c.lat) IS NULL
              AND coalesce(f.origin_lng::double precision, c.lng) IS NULL
              AND f.origin_city_id IS NOT NULL
              AND f.origin_city_id = vc.city_id
            )
          ) THEN 'OUTSIDE_RADIUS'
          ELSE NULL
        END AS reason
      FROM public.freights f
      LEFT JOIN public.cities c ON c.id = f.origin_city_id
    ),
    service_eval AS (
      SELECT
        sr.id,
        normalize_service_type_canonical(sr.service_type) AS service_type,
        sr.created_at,
        CASE
          WHEN NOT (sr.status = 'OPEN' AND sr.cancelled_at IS NULL) THEN 'STATUS_NOT_OPEN'
          WHEN sr.provider_id IS NOT NULL THEN 'ALREADY_ASSIGNED'
          WHEN NOT EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = normalize_service_type_canonical(sr.service_type)) THEN 'TYPE_NOT_COMPATIBLE'
          WHEN (sr.location_lat IS NULL OR sr.location_lng IS NULL) AND sr.city_id IS NULL THEN 'INVALID_COORDINATES'
          WHEN sr.city_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM viewer_cities vc WHERE vc.city_id = sr.city_id) THEN 'CITY_NOT_MATCH'
          WHEN NOT EXISTS (
            SELECT 1 FROM viewer_cities vc
            WHERE (
              sr.location_lat IS NOT NULL
              AND sr.location_lng IS NOT NULL
              AND vc.lat IS NOT NULL
              AND vc.lng IS NOT NULL
              AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision), 4326)::geography,
                ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography,
                300000
              )
            ) OR (
              sr.city_id IS NOT NULL AND sr.city_id = vc.city_id
            )
          ) THEN 'OUTSIDE_RADIUS'
          ELSE NULL
        END AS reason
      FROM public.service_requests sr
    )
    SELECT
      jsonb_build_object(
        'total_candidates', (SELECT count(*) FROM freight_eval),
        'total_eligible', (SELECT count(*) FROM freight_eval WHERE reason IS NULL),
        'total_excluded', (SELECT count(*) FROM freight_eval WHERE reason IS NOT NULL),
        'excluded', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'item_type', 'FREIGHT',
            'item_id', fe.id,
            'reason', fe.reason,
            'service_type', fe.service_type
          ) ORDER BY fe.created_at DESC)
          FROM (SELECT * FROM freight_eval WHERE reason IS NOT NULL ORDER BY created_at DESC LIMIT 100) fe
        ), '[]'::jsonb)
      ),
      jsonb_build_object(
        'total_candidates', (SELECT count(*) FROM service_eval),
        'total_eligible', (SELECT count(*) FROM service_eval WHERE reason IS NULL),
        'total_excluded', (SELECT count(*) FROM service_eval WHERE reason IS NOT NULL),
        'excluded', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'item_type', 'SERVICE',
            'item_id', se.id,
            'reason', se.reason,
            'service_type', se.service_type
          ) ORDER BY se.created_at DESC)
          FROM (SELECT * FROM service_eval WHERE reason IS NOT NULL ORDER BY created_at DESC LIMIT 100) se
        ), '[]'::jsonb)
      )
    INTO v_debug_freight, v_debug_service;
  END IF;

  RETURN jsonb_build_object(
    'freights', v_freights,
    'service_requests', v_services,
    'metrics', jsonb_build_object(
      'feed_total_eligible', v_total_eligible,
      'feed_total_displayed', v_total_displayed,
      'fallback_used', v_fallback_used,
      'role', v_role
    ),
    'debug', CASE
      WHEN p_debug THEN jsonb_build_object(
        'freight', v_debug_freight,
        'service', v_debug_service,
        'excluded_items', coalesce(v_debug_freight->'excluded', '[]'::jsonb) || coalesce(v_debug_service->'excluded', '[]'::jsonb)
      )
      ELSE null
    END
  );
END;
$$;

-- Backward-compatible wrapper for freight feed callers
CREATE OR REPLACE FUNCTION public.get_unified_freight_feed(
  p_panel text,
  p_profile_id uuid,
  p_company_id uuid DEFAULT NULL,
  p_date timestamp with time zone DEFAULT now(),
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text := upper(coalesce(p_panel, 'MOTORISTA'));
  v_result jsonb;
BEGIN
  IF v_role NOT IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA') THEN
    RAISE EXCEPTION 'Painel inválido: %', p_panel;
  END IF;

  v_result := public.get_authoritative_feed(auth.uid(), v_role, p_debug);

  RETURN jsonb_build_object(
    'items', coalesce(v_result->'freights', '[]'::jsonb),
    'debug', CASE WHEN p_debug THEN coalesce(v_result->'debug'->'freight', jsonb_build_object()) ELSE null END,
    'metrics', v_result->'metrics'
  );
END;
$$;

-- Backward-compatible wrapper for service feed callers
CREATE OR REPLACE FUNCTION public.get_unified_service_feed(
  p_profile_id uuid,
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_result jsonb;
BEGIN
  SELECT upper(coalesce(active_mode, role, 'PRESTADOR_SERVICOS'))
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