-- 1) Adicionar expires_at em freights e service_requests
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2) Índices para filtros de expiração
CREATE INDEX IF NOT EXISTS idx_freights_expires_at ON public.freights (expires_at) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_service_requests_expires_at ON public.service_requests (expires_at) WHERE status = 'OPEN';

-- 3) Backfill freights OPEN sem expires_at
UPDATE public.freights
SET expires_at = CASE
  WHEN upper(coalesce(service_type, 'CARGA')) = 'CARGA' THEN
    CASE WHEN pickup_date IS NOT NULL THEN (pickup_date::timestamptz + interval '48 hours') ELSE (created_at + interval '72 hours') END
  WHEN upper(coalesce(service_type, '')) = 'GUINCHO' THEN created_at + interval '4 hours'
  WHEN upper(coalesce(service_type, '')) = 'FRETE_MOTO' THEN created_at + interval '24 hours'
  WHEN upper(coalesce(service_type, '')) IN ('MUDANCA', 'ENTREGA_PACOTES', 'TRANSPORTE_PET') THEN created_at + interval '72 hours'
  ELSE created_at + interval '72 hours'
END
WHERE expires_at IS NULL AND status = 'OPEN';

-- 4) Backfill service_requests OPEN sem expires_at
UPDATE public.service_requests
SET expires_at = CASE
  WHEN upper(coalesce(service_type, '')) = 'GUINCHO' THEN created_at + interval '2 hours'
  WHEN upper(coalesce(service_type, '')) = 'FRETE_MOTO' THEN created_at + interval '24 hours'
  WHEN upper(coalesce(service_type, '')) IN ('MUDANCA', 'ENTREGA_PACOTES', 'TRANSPORTE_PET') THEN created_at + interval '72 hours'
  ELSE created_at + interval '7 days'
END
WHERE expires_at IS NULL AND status = 'OPEN';

-- 5) Trigger para auto-preencher expires_at em novos registros
CREATE OR REPLACE FUNCTION public.set_default_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    IF TG_TABLE_NAME = 'freights' THEN
      NEW.expires_at := CASE
        WHEN upper(coalesce(NEW.service_type, 'CARGA')) = 'CARGA' THEN
          CASE WHEN NEW.pickup_date IS NOT NULL THEN (NEW.pickup_date::timestamptz + interval '48 hours') ELSE (NEW.created_at + interval '72 hours') END
        WHEN upper(coalesce(NEW.service_type, '')) = 'GUINCHO' THEN NEW.created_at + interval '4 hours'
        WHEN upper(coalesce(NEW.service_type, '')) = 'FRETE_MOTO' THEN NEW.created_at + interval '24 hours'
        ELSE NEW.created_at + interval '72 hours'
      END;
    ELSIF TG_TABLE_NAME = 'service_requests' THEN
      NEW.expires_at := CASE
        WHEN upper(coalesce(NEW.service_type, '')) = 'GUINCHO' THEN NEW.created_at + interval '2 hours'
        WHEN upper(coalesce(NEW.service_type, '')) = 'FRETE_MOTO' THEN NEW.created_at + interval '24 hours'
        WHEN upper(coalesce(NEW.service_type, '')) IN ('MUDANCA', 'ENTREGA_PACOTES', 'TRANSPORTE_PET') THEN NEW.created_at + interval '72 hours'
        ELSE NEW.created_at + interval '7 days'
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freights_set_expires_at ON public.freights;
CREATE TRIGGER trg_freights_set_expires_at
  BEFORE INSERT ON public.freights
  FOR EACH ROW EXECUTE FUNCTION public.set_default_expires_at();

DROP TRIGGER IF EXISTS trg_service_requests_set_expires_at ON public.service_requests;
CREATE TRIGGER trg_service_requests_set_expires_at
  BEFORE INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_default_expires_at();

-- 6) Atualizar get_authoritative_feed com parâmetros de filtro
CREATE OR REPLACE FUNCTION public.get_authoritative_feed(
  p_user_id uuid,
  p_role text,
  p_debug boolean DEFAULT false,
  p_types text[] DEFAULT NULL,
  p_expiry_bucket text DEFAULT NULL,
  p_sort text DEFAULT 'EXPIRY_ASC'
)
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
  v_debug_viewer jsonb := '{}'::jsonb;
  v_fallback_used boolean := false;
  v_total_eligible integer := 0;
  v_total_displayed integer := 0;
  v_has_urban_types boolean := false;
  v_urban_transport_types text[] := ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'ENTREGA_PACOTES', 'TRANSPORTE_PET'];
  v_sort text := upper(coalesce(p_sort, 'EXPIRY_ASC'));
  v_expiry_bucket text := upper(coalesce(p_expiry_bucket, ''));
  v_filter_types text[] := p_types;
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

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_auth_uid
    AND (
      upper(coalesce(p.active_mode, '')) = v_role
      OR upper(coalesce(p.role::text, '')) = v_role
      OR (v_role IN ('MOTORISTA', 'MOTORISTA_AFILIADO') AND upper(coalesce(p.role::text, '')) IN ('MOTORISTA', 'MOTORISTA_AFILIADO'))
    )
  ORDER BY
    CASE WHEN upper(coalesce(p.active_mode, '')) = v_role THEN 0 WHEN upper(coalesce(p.role::text, '')) = v_role THEN 1 ELSE 2 END,
    p.created_at ASC
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = v_auth_uid ORDER BY p.created_at ASC LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para usuário autenticado';
  END IF;

  IF v_role = 'TRANSPORTADORA' THEN
    SELECT tc.id INTO v_company_id
    FROM public.transport_companies tc JOIN public.profiles op ON op.id = tc.profile_id
    WHERE op.user_id = v_auth_uid ORDER BY tc.created_at ASC LIMIT 1;
    IF v_company_id IS NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Transportadora não vinculada ao usuário autenticado';
    END IF;
  END IF;

  IF v_role = 'MOTORISTA_AFILIADO' THEN
    SELECT cd.company_id INTO v_company_id
    FROM public.company_drivers cd
    WHERE cd.driver_profile_id = v_profile_id AND upper(coalesce(cd.status, '')) = 'ACTIVE' AND cd.company_id IS NOT NULL
    ORDER BY cd.updated_at DESC NULLS LAST, cd.created_at DESC NULLS LAST LIMIT 1;
  END IF;

  -- ========== FREIGHT VISIBILITY ==========
  WITH source_profiles AS (
    SELECT p.id, p.user_id, p.service_types FROM public.profiles p
    WHERE (v_role = 'TRANSPORTADORA' AND (p.id = v_profile_id OR EXISTS (SELECT 1 FROM public.company_drivers cd WHERE cd.company_id = v_company_id AND cd.driver_profile_id = p.id AND upper(coalesce(cd.status, '')) = 'ACTIVE')))
    OR (v_role = 'MOTORISTA_AFILIADO' AND (p.id = v_profile_id OR EXISTS (SELECT 1 FROM public.transport_companies tc WHERE tc.id = v_company_id AND tc.profile_id = p.id) OR EXISTS (SELECT 1 FROM public.company_drivers cd WHERE cd.company_id = v_company_id AND cd.driver_profile_id = p.id AND upper(coalesce(cd.status, '')) = 'ACTIVE')))
    OR (v_role NOT IN ('TRANSPORTADORA', 'MOTORISTA_AFILIADO') AND p.id = v_profile_id)
  ),
  viewer_types AS (
    SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
    FROM source_profiles sp LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY['CARGA']::text[])) AS t ON true
  ),
  viewer_cities AS (
    SELECT DISTINCT uc.city_id, c.lat, c.lng
    FROM source_profiles sp
    JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true
    JOIN public.cities c ON c.id = uc.city_id
  ),
  candidates AS (
    SELECT f.*, normalize_service_type_canonical(f.service_type) AS canonical_service_type,
      COALESCE(f.origin_lat::double precision, co.lat) AS effective_origin_lat,
      COALESCE(f.origin_lng::double precision, co.lng) AS effective_origin_lng
    FROM public.freights f LEFT JOIN public.cities co ON co.id = f.origin_city_id
  ),
  evaluated AS (
    SELECT c.*,
      EXISTS (SELECT 1 FROM viewer_types vt WHERE vt.service_type = c.canonical_service_type) AS type_match,
      EXISTS (SELECT 1 FROM viewer_cities vc WHERE
        (c.effective_origin_lat IS NOT NULL AND c.effective_origin_lng IS NOT NULL AND vc.lat IS NOT NULL AND vc.lng IS NOT NULL
         AND ST_DWithin(ST_SetSRID(ST_MakePoint(c.effective_origin_lng, c.effective_origin_lat), 4326)::geography, ST_SetSRID(ST_MakePoint(vc.lng::double precision, vc.lat::double precision), 4326)::geography, 300000))
        OR (c.effective_origin_lat IS NULL AND c.effective_origin_lng IS NULL AND c.origin_city_id IS NOT NULL AND c.origin_city_id = vc.city_id)
      ) AS location_match,
      (c.status::text = 'OPEN' AND c.cancelled_at IS NULL AND coalesce(c.accepted_trucks, 0) < coalesce(c.required_trucks, 1)) AS status_match,
      (v_filter_types IS NULL OR c.canonical_service_type = ANY(v_filter_types)) AS user_type_match,
      CASE
        WHEN v_expiry_bucket = 'NOW_6H' THEN c.expires_at IS NOT NULL AND c.expires_at <= now() + interval '6 hours'
        WHEN v_expiry_bucket = 'TODAY_24H' THEN c.expires_at IS NOT NULL AND c.expires_at <= now() + interval '24 hours'
        WHEN v_expiry_bucket = 'NEXT_72H' THEN c.expires_at IS NOT NULL AND c.expires_at <= now() + interval '72 hours'
        WHEN v_expiry_bucket = 'LATER' THEN c.expires_at IS NULL OR c.expires_at > now() + interval '72 hours'
        ELSE true
      END AS expiry_match
    FROM candidates c
  ),
  eligible AS (
    SELECT * FROM evaluated e
    WHERE e.type_match AND e.location_match AND e.status_match AND e.user_type_match AND e.expiry_match
    ORDER BY
      CASE WHEN v_sort = 'EXPIRY_ASC' THEN e.expires_at END ASC NULLS LAST,
      CASE WHEN v_sort = 'PRICE_DESC' THEN e.price END DESC NULLS LAST,
      CASE WHEN v_sort = 'RPM_DESC' THEN CASE WHEN coalesce(e.distance_km, 0) > 0 THEN e.price / e.distance_km ELSE 0 END END DESC NULLS LAST,
      CASE WHEN v_sort = 'DIST_ASC' THEN e.distance_km END ASC NULLS LAST,
      CASE WHEN v_sort = 'NEWEST' THEN e.created_at END DESC NULLS LAST,
      e.created_at DESC
  ),
  debug_rows AS (
    SELECT e.id, e.canonical_service_type,
      CASE WHEN NOT e.status_match THEN 'status' WHEN NOT e.type_match THEN 'service_type' WHEN NOT e.location_match THEN 'location' WHEN NOT e.user_type_match THEN 'user_filter_type' WHEN NOT e.expiry_match THEN 'user_filter_expiry' ELSE NULL END AS reason
    FROM evaluated e
  )
  SELECT
    coalesce(jsonb_agg(to_jsonb(el) - 'type_match' - 'location_match' - 'status_match' - 'user_type_match' - 'expiry_match' - 'effective_origin_lat' - 'effective_origin_lng' - 'canonical_service_type'), '[]'::jsonb),
    jsonb_build_object(
      'total_candidates', (SELECT count(*) FROM evaluated),
      'total_eligible', (SELECT count(*) FROM eligible),
      'total_excluded', (SELECT count(*) FROM debug_rows WHERE reason IS NOT NULL),
      'excluded', coalesce((SELECT jsonb_agg(jsonb_build_object('item_type', 'FREIGHT', 'item_id', dr.id, 'service_type', dr.canonical_service_type, 'reason', dr.reason)) FROM debug_rows dr WHERE dr.reason IS NOT NULL), '[]'::jsonb)
    ),
    (SELECT count(*) FROM eligible)
  INTO v_freights, v_debug_freight, v_total_eligible
  FROM eligible el;

  -- ========== DEBUG VIEWER CONTEXT ==========
  IF p_debug THEN
    WITH dbg_source AS (
      SELECT p.id, p.user_id, p.service_types FROM public.profiles p
      WHERE (v_role = 'TRANSPORTADORA' AND (p.id = v_profile_id OR EXISTS (SELECT 1 FROM public.company_drivers cd WHERE cd.company_id = v_company_id AND cd.driver_profile_id = p.id AND upper(coalesce(cd.status, '')) = 'ACTIVE')))
      OR (v_role = 'MOTORISTA_AFILIADO' AND (p.id = v_profile_id OR EXISTS (SELECT 1 FROM public.transport_companies tc WHERE tc.id = v_company_id AND tc.profile_id = p.id) OR EXISTS (SELECT 1 FROM public.company_drivers cd WHERE cd.company_id = v_company_id AND cd.driver_profile_id = p.id AND upper(coalesce(cd.status, '')) = 'ACTIVE')))
      OR (v_role NOT IN ('TRANSPORTADORA', 'MOTORISTA_AFILIADO') AND p.id = v_profile_id)
    )
    SELECT jsonb_build_object(
      'viewer_profile_id', v_profile_id,
      'viewer_panel', v_role,
      'viewer_company_id', v_company_id,
      'viewer_cities', coalesce((SELECT jsonb_agg(DISTINCT uc.city_id) FROM dbg_source sp JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true), '[]'::jsonb),
      'viewer_types', coalesce((SELECT jsonb_agg(DISTINCT normalize_service_type_canonical(t)) FROM dbg_source sp LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY['CARGA']::text[])) AS t ON true), '[]'::jsonb),
      'source_profile_count', (SELECT count(*) FROM dbg_source),
      'filters_applied', jsonb_build_object(
        'p_types', coalesce(to_jsonb(v_filter_types), 'null'::jsonb),
        'p_expiry_bucket', coalesce(v_expiry_bucket, ''),
        'p_sort', v_sort
      ),
      'why_empty', CASE
        WHEN (SELECT count(*) FROM dbg_source sp JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true) = 0 THEN 'sem_cidades_ativas'
        WHEN v_total_eligible = 0 THEN 'sem_fretes_open_compativeis'
        ELSE NULL
      END
    ) INTO v_debug_viewer;
  END IF;

  -- ========== SERVICE REQUESTS VISIBILITY ==========
  IF v_role = 'PRESTADOR_SERVICOS' THEN
    v_has_urban_types := true;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_profile_id AND p.service_types && v_urban_transport_types)
    INTO v_has_urban_types;
    IF NOT v_has_urban_types AND v_role = 'TRANSPORTADORA' AND v_company_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.company_drivers cd JOIN public.profiles p ON p.id = cd.driver_profile_id WHERE cd.company_id = v_company_id AND upper(coalesce(cd.status, '')) = 'ACTIVE' AND p.service_types && v_urban_transport_types)
      INTO v_has_urban_types;
    END IF;
    IF NOT v_has_urban_types AND v_role = 'MOTORISTA_AFILIADO' AND v_company_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.transport_companies tc JOIN public.profiles p ON p.id = tc.profile_id WHERE tc.id = v_company_id AND p.service_types && v_urban_transport_types)
      INTO v_has_urban_types;
    END IF;
  END IF;

  IF v_has_urban_types THEN
    WITH svc_source AS (
      SELECT p.id, p.user_id, p.service_types FROM public.profiles p
      WHERE (v_role = 'TRANSPORTADORA' AND (p.id = v_profile_id OR EXISTS (SELECT 1 FROM public.company_drivers cd WHERE cd.company_id = v_company_id AND cd.driver_profile_id = p.id AND upper(coalesce(cd.status, '')) = 'ACTIVE')))
      OR (v_role = 'MOTORISTA_AFILIADO' AND (p.id = v_profile_id OR EXISTS (SELECT 1 FROM public.transport_companies tc WHERE tc.id = v_company_id AND tc.profile_id = p.id) OR EXISTS (SELECT 1 FROM public.company_drivers cd WHERE cd.company_id = v_company_id AND cd.driver_profile_id = p.id AND upper(coalesce(cd.status, '')) = 'ACTIVE')))
      OR (v_role NOT IN ('TRANSPORTADORA', 'MOTORISTA_AFILIADO') AND p.id = v_profile_id)
    ),
    svc_viewer_types AS (
      SELECT DISTINCT normalize_service_type_canonical(t) AS service_type
      FROM svc_source sp LEFT JOIN LATERAL unnest(coalesce(sp.service_types, ARRAY[]::text[])) AS t ON true
      WHERE v_role = 'PRESTADOR_SERVICOS' OR normalize_service_type_canonical(t) = ANY(v_urban_transport_types)
    ),
    svc_viewer_cities AS (
      SELECT DISTINCT uc.city_id FROM svc_source sp JOIN public.user_cities uc ON uc.user_id = sp.user_id AND uc.is_active = true
    ),
    service_candidates AS (
      SELECT sr.*, normalize_service_type_canonical(sr.service_type) AS canonical_service_type
      FROM public.service_requests sr WHERE sr.status = 'OPEN' AND sr.provider_id IS NULL
    ),
    service_eval AS (
      SELECT s.*,
        EXISTS (SELECT 1 FROM svc_viewer_types vt WHERE vt.service_type = s.canonical_service_type) AS type_match,
        EXISTS (SELECT 1 FROM svc_viewer_cities vc WHERE vc.city_id = s.city_id) AS city_match,
        (v_filter_types IS NULL OR s.canonical_service_type = ANY(v_filter_types)) AS user_type_match,
        CASE
          WHEN v_expiry_bucket = 'NOW_6H' THEN s.expires_at IS NOT NULL AND s.expires_at <= now() + interval '6 hours'
          WHEN v_expiry_bucket = 'TODAY_24H' THEN s.expires_at IS NOT NULL AND s.expires_at <= now() + interval '24 hours'
          WHEN v_expiry_bucket = 'NEXT_72H' THEN s.expires_at IS NOT NULL AND s.expires_at <= now() + interval '72 hours'
          WHEN v_expiry_bucket = 'LATER' THEN s.expires_at IS NULL OR s.expires_at > now() + interval '72 hours'
          ELSE true
        END AS expiry_match
      FROM service_candidates s
    ),
    service_eligible AS (
      SELECT * FROM service_eval se WHERE se.type_match AND se.city_match AND se.user_type_match AND se.expiry_match
      ORDER BY
        CASE WHEN v_sort = 'EXPIRY_ASC' THEN se.expires_at END ASC NULLS LAST,
        CASE WHEN v_sort = 'PRICE_DESC' THEN se.estimated_price END DESC NULLS LAST,
        CASE WHEN v_sort = 'NEWEST' THEN se.created_at END DESC NULLS LAST,
        se.created_at DESC
    )
    SELECT
      coalesce(jsonb_agg(to_jsonb(se) - 'canonical_service_type' - 'type_match' - 'city_match' - 'user_type_match' - 'expiry_match'), '[]'::jsonb),
      jsonb_build_object(
        'total_candidates', (SELECT count(*) FROM service_eval),
        'total_eligible', (SELECT count(*) FROM service_eligible),
        'total_excluded', (SELECT count(*) FROM service_eval se2 WHERE NOT (se2.type_match AND se2.city_match AND se2.user_type_match AND se2.expiry_match)),
        'excluded', coalesce((SELECT jsonb_agg(jsonb_build_object('item_type', 'SERVICE', 'item_id', x.id, 'service_type', x.canonical_service_type, 'reason', CASE WHEN NOT x.type_match THEN 'service_type' WHEN NOT x.city_match THEN 'location' WHEN NOT x.user_type_match THEN 'user_filter_type' WHEN NOT x.expiry_match THEN 'user_filter_expiry' ELSE 'unknown' END)) FROM service_eval x WHERE NOT (x.type_match AND x.city_match AND x.user_type_match AND x.expiry_match)), '[]'::jsonb)
      )
    INTO v_services, v_debug_service
    FROM service_eligible se;
  END IF;

  v_total_displayed := coalesce(jsonb_array_length(v_freights), 0) + coalesce(jsonb_array_length(v_services), 0);

  RETURN jsonb_build_object(
    'freights', coalesce(v_freights, '[]'::jsonb),
    'service_requests', coalesce(v_services, '[]'::jsonb),
    'metrics', jsonb_build_object(
      'feed_total_eligible', coalesce(v_total_eligible, 0) + coalesce(jsonb_array_length(v_services), 0),
      'feed_total_displayed', coalesce(v_total_displayed, 0),
      'fallback_used', v_fallback_used,
      'role', v_role,
      'filters', jsonb_build_object('types', coalesce(to_jsonb(v_filter_types), 'null'::jsonb), 'expiry_bucket', coalesce(v_expiry_bucket, ''), 'sort', v_sort)
    ),
    'debug', CASE
      WHEN p_debug THEN jsonb_build_object(
        'freight', v_debug_freight,
        'service', v_debug_service,
        'excluded_items', coalesce(v_debug_freight->'excluded', '[]'::jsonb) || coalesce(v_debug_service->'excluded', '[]'::jsonb),
        'viewer', v_debug_viewer
      )
      ELSE NULL
    END
  );
END;
$function$;