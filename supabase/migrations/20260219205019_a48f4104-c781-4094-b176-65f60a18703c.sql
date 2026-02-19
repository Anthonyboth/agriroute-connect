
-- Cria função SQL de normalização canônica de tipos de serviço
-- Espelha a lógica do frontend (service-type-normalization.ts)
CREATE OR REPLACE FUNCTION public.normalize_service_type_canonical(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_upper TEXT;
BEGIN
  IF p_type IS NULL THEN RETURN 'CARGA'; END IF;
  v_upper := upper(trim(p_type));

  -- Mapeamento explícito (espelho do frontend)
  RETURN CASE v_upper
    -- CARGA
    WHEN 'CARGA'               THEN 'CARGA'
    WHEN 'CARGA_FREIGHT'       THEN 'CARGA'
    WHEN 'FRETE'               THEN 'CARGA'
    WHEN 'TRANSPORTE_CARGA'    THEN 'CARGA'

    -- GUINCHO
    WHEN 'GUINCHO'             THEN 'GUINCHO'
    WHEN 'GUINCHO_FREIGHT'     THEN 'GUINCHO'
    WHEN 'REBOQUE'             THEN 'GUINCHO'

    -- MUDANCA
    WHEN 'MUDANCA'             THEN 'MUDANCA'
    WHEN 'MUDANCA_FREIGHT'     THEN 'MUDANCA'
    WHEN 'MUDANCAS'            THEN 'MUDANCA'
    WHEN 'MUDANCA_RESIDENCIAL' THEN 'MUDANCA'
    WHEN 'MUDANCA_COMERCIAL'   THEN 'MUDANCA'

    -- FRETE_MOTO
    WHEN 'FRETE_MOTO'          THEN 'FRETE_MOTO'
    WHEN 'MOTO'                THEN 'FRETE_MOTO'
    WHEN 'MOTOBOY'             THEN 'FRETE_MOTO'

    -- ENTREGA_PACOTES
    WHEN 'ENTREGA_PACOTES'     THEN 'ENTREGA_PACOTES'
    WHEN 'PACOTES'             THEN 'ENTREGA_PACOTES'
    WHEN 'ENTREGA'             THEN 'ENTREGA_PACOTES'

    -- TRANSPORTE_PET
    WHEN 'TRANSPORTE_PET'      THEN 'TRANSPORTE_PET'
    WHEN 'PET'                 THEN 'TRANSPORTE_PET'
    WHEN 'TRANSPORTE_ANIMAL'   THEN 'TRANSPORTE_PET'

    -- Tipos compostos com sufixo → base
    ELSE regexp_replace(
      v_upper,
      '(_TECH|_AGR|_RURAL|_URBANO|_URB|_LOG|_RESIDENCIAL|_COMERCIAL|_FREIGHT)$',
      ''
    )
  END;
END;
$$;

-- Atualiza get_services_for_provider para usar a nova função de normalização
CREATE OR REPLACE FUNCTION public.get_services_for_provider(p_provider_id uuid)
RETURNS TABLE(
  id uuid,
  service_type text,
  location_address text,
  problem_description text,
  urgency text,
  contact_phone text,
  contact_name text,
  status text,
  created_at timestamptz,
  client_id uuid,
  city_name text,
  state text,
  location_lat double precision,
  location_lng double precision,
  distance_km double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_service_types TEXT[];
  provider_service_types_normalized TEXT[];
  provider_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT prof.user_id, prof.service_types
  INTO provider_user_id, provider_service_types
  FROM public.profiles prof
  WHERE prof.id = p_provider_id;

  IF provider_user_id IS NULL THEN
    RAISE EXCEPTION 'Prestador não encontrado';
  END IF;

  IF NOT (
    auth.uid() = provider_user_id
    OR public.is_admin()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF provider_service_types IS NULL OR array_length(provider_service_types, 1) = 0 THEN
    RETURN;
  END IF;

  -- Normaliza tipos do prestador usando a função canônica
  SELECT array_agg(DISTINCT public.normalize_service_type_canonical(t))
  INTO provider_service_types_normalized
  FROM unnest(provider_service_types) AS t;

  RETURN QUERY
  SELECT DISTINCT
    sr.id,
    sr.service_type,
    CASE
      WHEN sr.city_name IS NOT NULL AND sr.state IS NOT NULL THEN sr.city_name || ', ' || upper(sr.state)
      WHEN sr.location_city IS NOT NULL AND sr.location_state IS NOT NULL THEN sr.location_city || ', ' || upper(sr.location_state)
      ELSE 'Localização restrita'
    END AS location_address,
    sr.problem_description,
    sr.urgency,
    '***-****'::text AS contact_phone,
    CASE
      WHEN sr.contact_name IS NULL OR length(sr.contact_name) < 3 THEN '***'
      ELSE left(sr.contact_name, 3) || '***'
    END AS contact_name,
    sr.status,
    sr.created_at,
    sr.client_id,
    sr.city_name,
    sr.state,
    CAST(sr.location_lat AS DOUBLE PRECISION) AS location_lat,
    CAST(sr.location_lng AS DOUBLE PRECISION) AS location_lng,
    CAST(
      6371 * acos(
        GREATEST(-1, LEAST(1,
          cos(radians(COALESCE(sr.location_lat, c.lat))) *
          cos(radians(c.lat)) *
          cos(radians(c.lng) - radians(COALESCE(sr.location_lng, c.lng))) +
          sin(radians(COALESCE(sr.location_lat, c.lat))) *
          sin(radians(c.lat))
        ))
      ) AS DOUBLE PRECISION
    ) AS distance_km
  FROM public.service_requests sr
  INNER JOIN public.user_cities uc
    ON uc.user_id = provider_user_id
   AND uc.type = 'PRESTADOR_SERVICO'
  INNER JOIN public.cities c
    ON c.id = uc.city_id
  WHERE sr.status = 'OPEN'
    AND sr.provider_id IS NULL
    AND uc.is_active = true
    AND (
      -- Match canônico: normaliza o tipo do serviço e compara com tipos normalizados do prestador
      public.normalize_service_type_canonical(sr.service_type) = ANY(provider_service_types_normalized)
      -- Match direto: caso o prestador tenha o tipo exato cadastrado
      OR sr.service_type = ANY(provider_service_types)
      -- Tipos genéricos que qualquer prestador pode atender
      OR sr.service_type IN ('SERVICO_AGRICOLA','SERVICO_TECNICO','SERVICO_LOGISTICO','SERVICO_URBANO')
    )
    AND (
      (LOWER(sr.city_name) = LOWER(c.name) AND LOWER(sr.state) = LOWER(c.state))
      OR
      (
        6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians(COALESCE(sr.location_lat, c.lat))) *
            cos(radians(c.lat)) *
            cos(radians(c.lng) - radians(COALESCE(sr.location_lng, c.lng))) +
            sin(radians(COALESCE(sr.location_lat, c.lat))) *
            sin(radians(c.lat))
          ))
        ) <= COALESCE(uc.radius_km, 50)
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM match_exposures me
      WHERE me.viewer_user_id = provider_user_id
        AND me.item_type = 'SERVICE'
        AND me.item_id = sr.id
        AND me.expires_at > now()
        AND me.status IN ('SEEN', 'DISMISSED', 'ACCEPTED')
    );
END;
$$;
