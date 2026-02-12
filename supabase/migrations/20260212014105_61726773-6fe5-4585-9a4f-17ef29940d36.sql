
-- Fix: A RPC get_services_for_provider precisa ser SECURITY DEFINER
-- porque as policies RLS de SELECT na service_requests não cobrem
-- serviços OPEN de tipos como ARMAZENAGEM, AGRONOMO, ANALISE_SOLO, etc.
-- A RPC já faz validação de auth.uid() e autorização interna.

CREATE OR REPLACE FUNCTION public.get_services_for_provider(p_provider_id uuid)
 RETURNS TABLE(id uuid, service_type text, location_address text, problem_description text, urgency text, contact_phone text, contact_name text, status text, created_at timestamp with time zone, client_id uuid, city_name text, state text, location_lat double precision, location_lng double precision, distance_km numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT array_agg(DISTINCT regexp_replace(upper(t), '_URB$', ''))
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
      regexp_replace(upper(sr.service_type), '_URB$', '') = ANY(provider_service_types_normalized)
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
    -- DEDUPE: excluir itens já vistos com exposure ativa
    AND NOT EXISTS (
      SELECT 1 FROM match_exposures me
      WHERE me.viewer_user_id = provider_user_id
        AND me.item_type = 'SERVICE'
        AND me.item_id = sr.id
        AND me.expires_at > now()
        AND me.status IN ('SEEN', 'DISMISSED', 'ACCEPTED')
    );
END;
$function$;
