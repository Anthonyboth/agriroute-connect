-- 1) Backfill service_provider_areas from legacy user_cities (PRESTADOR_SERVICO)
-- NOTE: radius_m is calculated by trigger from radius_km
INSERT INTO public.service_provider_areas (
  provider_id,
  city_name,
  state,
  lat,
  lng,
  radius_km,
  service_types,
  is_active,
  created_at,
  updated_at
)
SELECT
  p.id AS provider_id,
  c.name AS city_name,
  c.state AS state,
  c.lat AS lat,
  c.lng AS lng,
  uc.radius_km::numeric AS radius_km,
  uc.service_types AS service_types,
  true AS is_active,
  now() AS created_at,
  now() AS updated_at
FROM public.user_cities uc
JOIN public.profiles p
  ON p.user_id = uc.user_id
 AND p.role = 'PRESTADOR_SERVICOS'
JOIN public.cities c
  ON c.id = uc.city_id
WHERE uc.type = 'PRESTADOR_SERVICO'
  AND uc.is_active = true
  AND c.lat IS NOT NULL
  AND c.lng IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.service_provider_areas spa
    WHERE spa.provider_id = p.id
      AND lower(spa.city_name) = lower(c.name)
      AND coalesce(lower(spa.state), '') = coalesce(lower(c.state), '')
  );

-- 2) Fix/modernize the RPC used by service-provider-spatial-matching
CREATE OR REPLACE FUNCTION public.execute_service_matching_with_user_cities(
  p_service_request_id uuid,
  p_request_lat numeric,
  p_request_lng numeric,
  p_service_type text DEFAULT NULL::text
)
RETURNS TABLE(
  provider_id uuid,
  provider_city_id uuid,
  match_type text,
  distance_m numeric,
  match_score numeric,
  service_compatibility_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Reset existing matches for this request
  DELETE FROM public.service_matches WHERE service_request_id = p_service_request_id;

  -- Insert matches based on service_provider_areas
  INSERT INTO public.service_matches (
    service_request_id,
    provider_id,
    provider_area_id,
    match_type,
    distance_m,
    match_score,
    service_compatibility_score
  )
  SELECT
    p_service_request_id,
    spa.provider_id,
    spa.id AS provider_area_id,
    CASE
      WHEN p_service_type IS NOT NULL
           AND spa.service_types IS NOT NULL
           AND array_length(spa.service_types, 1) IS NOT NULL
           AND p_service_type = ANY(spa.service_types) THEN 'BOTH'
      ELSE 'LOCATION'
    END AS match_type,
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_request_lng::double precision, p_request_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(spa.lng::double precision, spa.lat::double precision), 4326)::extensions.geography
    )::numeric AS distance_m,
    GREATEST(0.1, 1.0 - (
      extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(p_request_lng::double precision, p_request_lat::double precision), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(spa.lng::double precision, spa.lat::double precision), 4326)::extensions.geography
      ) / (spa.radius_km * 1000)
    )) AS match_score,
    CASE
      WHEN p_service_type IS NULL THEN 0.75
      WHEN p_service_type IN ('SERVICO_AGRICOLA','SERVICO_TECNICO','SERVICO_LOGISTICO','SERVICO_URBANO') THEN 0.75
      WHEN spa.service_types IS NOT NULL
           AND array_length(spa.service_types, 1) IS NOT NULL
           AND p_service_type = ANY(spa.service_types) THEN 1.0
      ELSE 0.5
    END AS service_compatibility_score
  FROM public.service_provider_areas spa
  JOIN public.profiles prof
    ON prof.id = spa.provider_id
   AND prof.role = 'PRESTADOR_SERVICOS'
   AND prof.status = 'APPROVED'
  WHERE spa.is_active = true
    AND spa.lat IS NOT NULL
    AND spa.lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_request_lng::double precision, p_request_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(spa.lng::double precision, spa.lat::double precision), 4326)::extensions.geography,
      (spa.radius_km * 1000)::double precision
    )
    AND (
      p_service_type IS NULL
      OR spa.service_types IS NULL
      OR array_length(spa.service_types, 1) IS NULL
      OR p_service_type = ANY(spa.service_types)
      OR p_service_type IN ('SERVICO_AGRICOLA','SERVICO_TECNICO','SERVICO_LOGISTICO','SERVICO_URBANO')
    )
  ON CONFLICT ON CONSTRAINT service_matches_service_request_id_provider_id_provider_are_key DO NOTHING;

  -- Return matches (keep legacy column name provider_city_id for compatibility with the edge function)
  RETURN QUERY
  SELECT
    sm.provider_id,
    sm.provider_area_id AS provider_city_id,
    sm.match_type,
    sm.distance_m,
    sm.match_score,
    sm.service_compatibility_score
  FROM public.service_matches sm
  WHERE sm.service_request_id = p_service_request_id
  ORDER BY
    sm.service_compatibility_score DESC,
    sm.match_score DESC,
    sm.distance_m ASC;
END;
$function$;

-- 3) Ensure provider dashboard RPC returns category-level requests too
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
  created_at timestamp with time zone,
  client_id uuid,
  city_name text,
  state text,
  location_lat numeric,
  location_lng numeric,
  distance_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  provider_service_types TEXT[];
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
    sr.location_lat,
    sr.location_lng,
    ROUND(CAST(
      6371 * acos(
        GREATEST(-1, LEAST(1,
          cos(radians(COALESCE(sr.location_lat, c.lat))) *
          cos(radians(c.lat)) *
          cos(radians(c.lng) - radians(COALESCE(sr.location_lng, c.lng))) +
          sin(radians(COALESCE(sr.location_lat, c.lat))) *
          sin(radians(c.lat))
        ))
      ) AS NUMERIC
    ), 2) AS distance_km
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
      sr.service_type = ANY(provider_service_types)
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
        )
      ) <= uc.radius_km
    )
  ORDER BY sr.created_at DESC
  LIMIT 200;
END;
$function$;