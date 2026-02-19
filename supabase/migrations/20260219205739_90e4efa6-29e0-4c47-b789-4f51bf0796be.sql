
-- Fix crítico: get_services_for_provider NÃO deve retornar tipos de frete urbano
-- Fretes urbanos (GUINCHO, MUDANCA, FRETE_MOTO, etc.) pertencem ao painel de motorista/transportadora
-- Prestador de serviços só deve ver serviços técnicos/agrícolas (não transporte)

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
  -- Tipos que são FRETE URBANO — pertencem ao painel de motorista, NUNCA ao prestador de serviços
  freight_urban_types TEXT[] := ARRAY[
    'FRETE_MOTO', 'FRETE_URBANO', 'GUINCHO', 'GUINCHO_FREIGHT',
    'MUDANCA', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL',
    'CARGA_FREIGHT', 'ENTREGA_PACOTES', 'TRANSPORTE_PET',
    'FRETE_GUINCHO', 'FRETE_MUDANCA', 'REBOQUE', 'GUINDASTE'
  ];
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

  -- Normaliza removendo sufixos técnicos: _TECH, _AGR, _RURAL, _URBANO, _URB, _LOG, _RESIDENCIAL, _COMERCIAL, _FREIGHT
  SELECT array_agg(DISTINCT
    CASE upper(t)
      WHEN 'MUDANCAS' THEN 'MUDANCA'
      WHEN 'REBOQUE'  THEN 'GUINCHO'
      WHEN 'PET'      THEN 'TRANSPORTE_PET'
      ELSE regexp_replace(upper(t), '(_TECH|_AGR|_RURAL|_URBANO|_URB|_LOG|_RESIDENCIAL|_COMERCIAL|_FREIGHT)$', '')
    END
  )
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
    -- ✅ CRÍTICO: EXCLUIR EXPLICITAMENTE tipos de frete urbano
    -- Esses tipos pertencem ao painel de motorista/transportadora
    AND upper(sr.service_type) != ALL(freight_urban_types)
    -- Também excluir qualquer tipo que comece com FRETE_ ou termine com _FREIGHT
    AND upper(sr.service_type) NOT LIKE 'FRETE_%'
    AND upper(sr.service_type) NOT LIKE '%_FREIGHT'
    AND (
      -- Match normalizado: tipo do serviço normalizado bate com tipo do prestador normalizado
      CASE upper(sr.service_type)
        WHEN 'MUDANCAS' THEN 'MUDANCA'
        WHEN 'REBOQUE'  THEN 'GUINCHO'
        WHEN 'PET'      THEN 'TRANSPORTE_PET'
        ELSE regexp_replace(upper(sr.service_type), '(_TECH|_AGR|_RURAL|_URBANO|_URB|_LOG|_RESIDENCIAL|_COMERCIAL|_FREIGHT)$', '')
      END = ANY(provider_service_types_normalized)
      -- Match direto sem normalização (caso o prestador tenha o tipo exato)
      OR sr.service_type = ANY(provider_service_types)
      -- Tipos genéricos que qualquer prestador de serviços pode atender
      OR sr.service_type IN ('SERVICO_AGRICOLA','SERVICO_TECNICO','SERVICO_LOGISTICO')
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

GRANT EXECUTE ON FUNCTION public.get_services_for_provider(uuid) TO authenticated;
