-- Unified deterministic feed for freights (driver/company) and services (provider)
-- Goal: never hide eligible OPEN items; ranking is optional and must not block visibility.

CREATE OR REPLACE FUNCTION public.get_unified_freight_feed(
  p_panel text,
  p_profile_id uuid,
  p_company_id uuid DEFAULT NULL,
  p_date timestamptz DEFAULT now(),
  p_debug boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_panel text := upper(coalesce(p_panel, ''));
  v_allowed boolean := false;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF v_panel NOT IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA') THEN
    RAISE EXCEPTION 'Painel inválido: %', p_panel;
  END IF;

  -- Authorization
  IF v_panel = 'TRANSPORTADORA' THEN
    IF p_company_id IS NULL THEN
      RAISE EXCEPTION 'p_company_id é obrigatório para TRANSPORTADORA';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.transport_companies tc
      JOIN public.profiles p ON p.id = tc.profile_id
      WHERE tc.id = p_company_id
        AND p.user_id = auth.uid()
    ) OR public.is_admin()
    INTO v_allowed;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_profile_id
        AND p.user_id = auth.uid()
    ) OR (
      p_company_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.transport_companies tc
        JOIN public.profiles owner_p ON owner_p.id = tc.profile_id
        JOIN public.company_drivers cd ON cd.company_id = tc.id
        WHERE tc.id = p_company_id
          AND owner_p.user_id = auth.uid()
          AND cd.driver_profile_id = p_profile_id
          AND upper(coalesce(cd.status, '')) = 'ACTIVE'
      )
    ) OR public.is_admin()
    INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  WITH viewer_profiles AS (
    SELECT p.id AS profile_id, p.user_id, p.service_types
    FROM public.profiles p
    WHERE (
      (v_panel IN ('MOTORISTA', 'MOTORISTA_AFILIADO') AND p.id = p_profile_id)
      OR (
        v_panel = 'TRANSPORTADORA'
        AND EXISTS (
          SELECT 1
          FROM public.company_drivers cd
          WHERE cd.company_id = p_company_id
            AND cd.driver_profile_id = p.id
            AND upper(coalesce(cd.status, '')) = 'ACTIVE'
        )
      )
    )
  ),
  viewer_types_raw AS (
    SELECT vp.profile_id, unnest(coalesce(vp.service_types, ARRAY['CARGA'])) AS raw_service_type
    FROM viewer_profiles vp
  ),
  viewer_types AS (
    SELECT DISTINCT normalize_service_type_canonical(raw_service_type) AS service_type
    FROM viewer_types_raw
  ),
  viewer_cities AS (
    SELECT DISTINCT
      uc.city_id,
      c.lat,
      c.lng,
      LEAST(COALESCE(uc.radius_km, 300), 300)::double precision AS radius_km
    FROM viewer_profiles vp
    JOIN public.user_cities uc
      ON uc.user_id = vp.user_id
     AND uc.is_active = true
    JOIN public.cities c
      ON c.id = uc.city_id
  ),
  freight_base AS (
    SELECT
      f.id,
      f.cargo_type,
      f.weight,
      f.origin_address,
      f.destination_address,
      f.origin_city,
      f.origin_state,
      f.destination_city,
      f.destination_state,
      f.pickup_date,
      f.delivery_date,
      f.price,
      f.urgency::text AS urgency,
      f.status::text AS status,
      f.service_type,
      normalize_service_type_canonical(f.service_type) AS canonical_service_type,
      f.distance_km,
      f.minimum_antt_price,
      f.required_trucks,
      f.accepted_trucks,
      f.created_at,
      f.origin_city_id,
      f.vehicle_type_required::text AS vehicle_type_required,
      f.vehicle_axles_required,
      f.pricing_type::text AS pricing_type,
      f.price_per_km,
      f.cancelled_at,
      COALESCE(f.origin_lat::double precision, city_origin.lat) AS origin_lat_match,
      COALESCE(f.origin_lng::double precision, city_origin.lng) AS origin_lng_match,
      (
        f.status::text = 'OPEN'
        AND coalesce(f.cancelled_at, NULL) IS NULL
        AND coalesce(f.driver_id, NULL) IS NULL
      ) AS status_ok,
      EXISTS (
        SELECT 1
        FROM viewer_types vt
        WHERE vt.service_type = normalize_service_type_canonical(f.service_type)
      ) AS type_ok,
      EXISTS (
        SELECT 1
        FROM viewer_cities vc
        WHERE (
          (
            COALESCE(f.origin_lat::double precision, city_origin.lat) IS NOT NULL
            AND COALESCE(f.origin_lng::double precision, city_origin.lng) IS NOT NULL
            AND vc.lat IS NOT NULL
            AND vc.lng IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(COALESCE(f.origin_lng::double precision, city_origin.lng), COALESCE(f.origin_lat::double precision, city_origin.lat)), 4326)::geography,
              ST_SetSRID(ST_MakePoint(vc.lng, vc.lat), 4326)::geography,
              (vc.radius_km * 1000)
            )
          )
          OR (
            COALESCE(f.origin_lat::double precision, city_origin.lat) IS NULL
            AND COALESCE(f.origin_lng::double precision, city_origin.lng) IS NULL
            AND f.origin_city_id IS NOT NULL
            AND f.origin_city_id = vc.city_id
          )
        )
      ) AS location_ok,
      (
        SELECT MIN(
          CASE
            WHEN COALESCE(f.origin_lat::double precision, city_origin.lat) IS NOT NULL
              AND COALESCE(f.origin_lng::double precision, city_origin.lng) IS NOT NULL
              AND vc.lat IS NOT NULL
              AND vc.lng IS NOT NULL
            THEN ST_Distance(
              ST_SetSRID(ST_MakePoint(COALESCE(f.origin_lng::double precision, city_origin.lng), COALESCE(f.origin_lat::double precision, city_origin.lat)), 4326)::geography,
              ST_SetSRID(ST_MakePoint(vc.lng, vc.lat), 4326)::geography
            ) / 1000.0
            ELSE NULL
          END
        )
        FROM viewer_cities vc
      ) AS distance_to_origin_km
    FROM public.freights f
    LEFT JOIN public.cities city_origin
      ON city_origin.id = f.origin_city_id
    WHERE f.created_at <= p_date
  ),
  freight_evaluated AS (
    SELECT
      fb.*,
      (fb.status_ok AND fb.type_ok AND fb.location_ok) AS eligible,
      CASE
        WHEN NOT fb.status_ok THEN 'STATUS_NOT_OPEN_OR_ALREADY_ASSIGNED'
        WHEN NOT fb.type_ok THEN 'SERVICE_TYPE_NOT_ENABLED'
        WHEN NOT fb.location_ok AND fb.origin_city_id IS NOT NULL
          AND fb.origin_lat_match IS NULL
          AND fb.origin_lng_match IS NULL
          THEN 'CITY_ID_NOT_COVERED'
        WHEN NOT fb.location_ok THEN 'OUTSIDE_RADIUS_300KM'
        ELSE 'ELIGIBLE'
      END AS exclusion_reason
    FROM freight_base fb
  ),
  freight_items AS (
    SELECT jsonb_build_object(
      'id', fe.id,
      'kind', 'FREIGHT',
      'cargo_type', fe.cargo_type,
      'weight', fe.weight,
      'origin_address', fe.origin_address,
      'destination_address', fe.destination_address,
      'origin_city', fe.origin_city,
      'origin_state', fe.origin_state,
      'destination_city', fe.destination_city,
      'destination_state', fe.destination_state,
      'pickup_date', fe.pickup_date,
      'delivery_date', fe.delivery_date,
      'price', fe.price,
      'urgency', fe.urgency,
      'status', fe.status,
      'service_type', fe.canonical_service_type,
      'distance_km', fe.distance_km,
      'distance_to_origin_km', round(coalesce(fe.distance_to_origin_km, 0)::numeric, 2),
      'minimum_antt_price', fe.minimum_antt_price,
      'required_trucks', fe.required_trucks,
      'accepted_trucks', fe.accepted_trucks,
      'created_at', fe.created_at,
      'origin_city_id', fe.origin_city_id,
      'vehicle_type_required', fe.vehicle_type_required,
      'vehicle_axles_required', fe.vehicle_axles_required,
      'pricing_type', fe.pricing_type,
      'price_per_km', fe.price_per_km
    ) AS item
    FROM freight_evaluated fe
    WHERE fe.eligible = true
    ORDER BY fe.created_at DESC
    LIMIT 200
  ),
  debug_excluded AS (
    SELECT jsonb_build_object(
      'item_type', 'FREIGHT',
      'item_id', fe.id,
      'reason', fe.exclusion_reason,
      'service_type', fe.canonical_service_type,
      'status', fe.status
    ) AS item
    FROM freight_evaluated fe
    WHERE fe.eligible = false
    ORDER BY fe.created_at DESC
    LIMIT 10
  ),
  stats AS (
    SELECT
      COUNT(*) AS total_candidates,
      COUNT(*) FILTER (WHERE eligible) AS total_eligible,
      COUNT(*) FILTER (WHERE NOT eligible) AS total_excluded
    FROM freight_evaluated
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(fi.item) FROM freight_items fi), '[]'::jsonb),
    'debug', CASE
      WHEN p_debug THEN jsonb_build_object(
        'total_candidates', (SELECT total_candidates FROM stats),
        'total_eligible', (SELECT total_eligible FROM stats),
        'total_excluded', (SELECT total_excluded FROM stats),
        'shown_count', COALESCE((SELECT count(*) FROM freight_items), 0),
        'excluded', COALESCE((SELECT jsonb_agg(de.item) FROM debug_excluded de), '[]'::jsonb)
      )
      ELSE jsonb_build_object(
        'total_candidates', NULL,
        'total_eligible', NULL,
        'total_excluded', NULL,
        'shown_count', COALESCE((SELECT count(*) FROM freight_items), 0),
        'excluded', '[]'::jsonb
      )
    END
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

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
  v_provider_user_id uuid;
  v_allowed boolean := false;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT p.user_id
  INTO v_provider_user_id
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  IF v_provider_user_id IS NULL THEN
    RAISE EXCEPTION 'Prestador não encontrado';
  END IF;

  SELECT (v_provider_user_id = auth.uid()) OR public.is_admin()
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  WITH provider_profile AS (
    SELECT p.id, p.user_id, p.service_types
    FROM public.profiles p
    WHERE p.id = p_profile_id
  ),
  provider_types AS (
    SELECT DISTINCT normalize_service_type_canonical(unnest(coalesce(pp.service_types, ARRAY[]::text[]))) AS service_type
    FROM provider_profile pp
  ),
  provider_cities AS (
    SELECT DISTINCT
      uc.city_id,
      c.lat,
      c.lng,
      LEAST(COALESCE(uc.radius_km, 300), 300)::double precision AS radius_km
    FROM provider_profile pp
    JOIN public.user_cities uc
      ON uc.user_id = pp.user_id
     AND uc.is_active = true
    JOIN public.cities c
      ON c.id = uc.city_id
  ),
  service_base AS (
    SELECT
      sr.id,
      sr.service_type,
      normalize_service_type_canonical(sr.service_type) AS canonical_service_type,
      sr.status,
      sr.provider_id,
      sr.created_at,
      sr.updated_at,
      sr.location_address,
      sr.location_city,
      sr.location_state,
      sr.city_name,
      sr.state,
      sr.city_id,
      sr.destination_address,
      sr.destination_city,
      sr.destination_state,
      sr.problem_description,
      sr.urgency,
      sr.estimated_price,
      sr.preferred_datetime,
      sr.additional_info,
      sr.vehicle_info,
      sr.is_emergency,
      sr.client_id,
      sr.location_lat::double precision AS location_lat_raw,
      sr.location_lng::double precision AS location_lng_raw,
      city_ref.lat AS city_lat,
      city_ref.lng AS city_lng,
      sr.cancelled_at,
      (sr.status = 'OPEN' AND sr.provider_id IS NULL AND sr.cancelled_at IS NULL) AS status_ok,
      EXISTS (
        SELECT 1 FROM provider_types pt
        WHERE pt.service_type = normalize_service_type_canonical(sr.service_type)
      ) AS type_ok,
      EXISTS (
        SELECT 1
        FROM provider_cities pc
        WHERE (
          (
            COALESCE(sr.location_lat::double precision, city_ref.lat) IS NOT NULL
            AND COALESCE(sr.location_lng::double precision, city_ref.lng) IS NOT NULL
            AND pc.lat IS NOT NULL
            AND pc.lng IS NOT NULL
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(COALESCE(sr.location_lng::double precision, city_ref.lng), COALESCE(sr.location_lat::double precision, city_ref.lat)), 4326)::geography,
              ST_SetSRID(ST_MakePoint(pc.lng, pc.lat), 4326)::geography,
              (pc.radius_km * 1000)
            )
          )
          OR (
            COALESCE(sr.location_lat::double precision, city_ref.lat) IS NULL
            AND COALESCE(sr.location_lng::double precision, city_ref.lng) IS NULL
            AND sr.city_id IS NOT NULL
            AND sr.city_id = pc.city_id
          )
        )
      ) AS location_ok,
      (
        SELECT MIN(
          CASE
            WHEN COALESCE(sr.location_lat::double precision, city_ref.lat) IS NOT NULL
              AND COALESCE(sr.location_lng::double precision, city_ref.lng) IS NOT NULL
              AND pc.lat IS NOT NULL
              AND pc.lng IS NOT NULL
            THEN ST_Distance(
              ST_SetSRID(ST_MakePoint(COALESCE(sr.location_lng::double precision, city_ref.lng), COALESCE(sr.location_lat::double precision, city_ref.lat)), 4326)::geography,
              ST_SetSRID(ST_MakePoint(pc.lng, pc.lat), 4326)::geography
            ) / 1000.0
            ELSE NULL
          END
        )
        FROM provider_cities pc
      ) AS distance_km
    FROM public.service_requests sr
    LEFT JOIN public.cities city_ref
      ON city_ref.id = sr.city_id
  ),
  service_evaluated AS (
    SELECT
      sb.*,
      (sb.status_ok AND sb.type_ok AND sb.location_ok) AS eligible,
      CASE
        WHEN NOT sb.status_ok THEN 'STATUS_NOT_OPEN'
        WHEN NOT sb.type_ok THEN 'SERVICE_TYPE_NOT_ENABLED'
        WHEN NOT sb.location_ok
          AND sb.city_id IS NOT NULL
          AND sb.location_lat_raw IS NULL
          AND sb.location_lng_raw IS NULL
          THEN 'CITY_ID_NOT_COVERED'
        WHEN NOT sb.location_ok THEN 'OUTSIDE_RADIUS_300KM'
        ELSE 'ELIGIBLE'
      END AS exclusion_reason
    FROM service_base sb
  ),
  service_items AS (
    SELECT jsonb_build_object(
      'id', se.id,
      'kind', 'SERVICE',
      'service_type', se.canonical_service_type,
      'status', se.status,
      'created_at', se.created_at,
      'updated_at', se.updated_at,
      'location_address', se.location_address,
      'location_city', se.location_city,
      'location_state', se.location_state,
      'city_name', se.city_name,
      'state', se.state,
      'city_id', se.city_id,
      'destination_address', se.destination_address,
      'destination_city', se.destination_city,
      'destination_state', se.destination_state,
      'problem_description', se.problem_description,
      'urgency', se.urgency,
      'estimated_price', se.estimated_price,
      'preferred_datetime', se.preferred_datetime,
      'additional_info', se.additional_info,
      'vehicle_info', se.vehicle_info,
      'is_emergency', se.is_emergency,
      'client_id', se.client_id,
      'distance_km', round(coalesce(se.distance_km, 0)::numeric, 2)
    ) AS item
    FROM service_evaluated se
    WHERE se.eligible = true
    ORDER BY se.created_at DESC
    LIMIT 200
  ),
  debug_excluded AS (
    SELECT jsonb_build_object(
      'item_type', 'SERVICE',
      'item_id', se.id,
      'reason', se.exclusion_reason,
      'service_type', se.canonical_service_type,
      'status', se.status
    ) AS item
    FROM service_evaluated se
    WHERE se.eligible = false
    ORDER BY se.created_at DESC
    LIMIT 10
  ),
  stats AS (
    SELECT
      COUNT(*) AS total_candidates,
      COUNT(*) FILTER (WHERE eligible) AS total_eligible,
      COUNT(*) FILTER (WHERE NOT eligible) AS total_excluded
    FROM service_evaluated
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(si.item) FROM service_items si), '[]'::jsonb),
    'debug', CASE
      WHEN p_debug THEN jsonb_build_object(
        'total_candidates', (SELECT total_candidates FROM stats),
        'total_eligible', (SELECT total_eligible FROM stats),
        'total_excluded', (SELECT total_excluded FROM stats),
        'shown_count', COALESCE((SELECT count(*) FROM service_items), 0),
        'excluded', COALESCE((SELECT jsonb_agg(de.item) FROM debug_excluded de), '[]'::jsonb)
      )
      ELSE jsonb_build_object(
        'total_candidates', NULL,
        'total_eligible', NULL,
        'total_excluded', NULL,
        'shown_count', COALESCE((SELECT count(*) FROM service_items), 0),
        'excluded', '[]'::jsonb
      )
    END
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_unified_freight_feed(text, uuid, uuid, timestamptz, boolean)
IS 'Feed determinístico de fretes para motorista/transportadora com fallback por city_id e debug de exclusões.';

COMMENT ON FUNCTION public.get_unified_service_feed(uuid, boolean)
IS 'Feed determinístico de serviços para prestador com fallback por city_id e debug de exclusões.';