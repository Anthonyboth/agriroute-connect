-- Fix: prevent exposure of service request contact info via open-listing RPC and permissive SELECT policies
-- 1) Harden get_services_for_provider(): enforce caller authorization and return redacted contact/location for OPEN/unassigned requests
-- 2) Remove SELECT policies that allowed providers/drivers to read OPEN/unassigned rows directly (which exposes contact fields)

BEGIN;

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
SET search_path = public
AS $$
DECLARE
  provider_service_types TEXT[];
  provider_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Get provider auth user_id + allowed service types
  SELECT p.user_id, p.service_types
  INTO provider_user_id, provider_service_types
  FROM public.profiles p
  WHERE p.id = p_provider_id;

  IF provider_user_id IS NULL THEN
    RAISE EXCEPTION 'Prestador não encontrado';
  END IF;

  -- Authorization: only the provider themself (or admin) can call this function with this provider id
  IF NOT (
    auth.uid() = provider_user_id
    OR public.is_admin()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- If provider has no service types, return empty
  IF provider_service_types IS NULL OR array_length(provider_service_types, 1) = 0 THEN
    RETURN;
  END IF;

  -- Return OPEN/unassigned services, but with PII redacted
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
    AND sr.service_type = ANY(provider_service_types)
    AND uc.is_active = true
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
$$;

-- Remove SELECT policies that allowed reading OPEN/unassigned rows directly (exposes contact_* fields)
DROP POLICY IF EXISTS "prestadores_view_services" ON public.service_requests;
DROP POLICY IF EXISTS "motoristas_view_transport_services" ON public.service_requests;
DROP POLICY IF EXISTS "providers_can_view_guest_service_requests" ON public.service_requests;

COMMIT;
