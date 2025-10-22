-- =========================================
-- FIX: Service Provider Dashboard - Services Not Appearing
-- =========================================

-- PHASE 1: Drop and recreate get_services_for_provider RPC
DROP FUNCTION IF EXISTS public.get_services_for_provider(UUID);

CREATE FUNCTION public.get_services_for_provider(p_provider_id UUID)
RETURNS TABLE (
  id UUID,
  service_type TEXT,
  location_address TEXT,
  problem_description TEXT,
  urgency TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  client_id UUID,
  city_name TEXT,
  state TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  distance_km NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_service_types TEXT[];
  provider_user_id UUID;
BEGIN
  -- Get provider's auth user_id and service types
  SELECT p.user_id, p.service_types 
  INTO provider_user_id, provider_service_types
  FROM profiles p
  WHERE p.id = p_provider_id;

  -- If provider has no service types, return empty
  IF provider_service_types IS NULL OR array_length(provider_service_types, 1) = 0 THEN
    RETURN;
  END IF;

  -- Return services matching provider's types and within service areas
  RETURN QUERY
  SELECT DISTINCT
    sr.id,
    sr.service_type,
    sr.location_address,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.status,
    sr.created_at,
    sr.client_id,
    sr.city_name,
    sr.state,
    sr.location_lat,
    sr.location_lng,
    -- Calculate distance using Haversine
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
    ), 2) as distance_km
  FROM service_requests sr
  INNER JOIN user_cities uc ON uc.user_id = provider_user_id AND uc.type = 'PRESTADOR_SERVICO'
  INNER JOIN cities c ON c.id = uc.city_id
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

GRANT EXECUTE ON FUNCTION public.get_services_for_provider(UUID) TO authenticated;

-- PHASE 2: Configure Service Area
INSERT INTO user_cities (user_id, city_id, type, radius_km, is_active)
SELECT 
  p.user_id,
  '72e2661e-0ffc-4d4f-a032-004edd82a0d8',
  'PRESTADOR_SERVICO',
  50,
  true
FROM profiles p
WHERE p.id = 'f8edff7e-a6cd-4682-bfa6-e592c2280b06'
  AND NOT EXISTS (
    SELECT 1 FROM user_cities uc
    WHERE uc.user_id = p.user_id
      AND uc.city_id = '72e2661e-0ffc-4d4f-a032-004edd82a0d8'
      AND uc.type = 'PRESTADOR_SERVICO'
  );

-- PHASE 3: Update RLS Policies
DROP POLICY IF EXISTS "service_requests_select_simple" ON service_requests;
DROP POLICY IF EXISTS "providers_view_services" ON service_requests;
DROP POLICY IF EXISTS "service_requests_provider_view" ON service_requests;

CREATE POLICY "service_requests_provider_view" 
ON service_requests FOR SELECT TO authenticated
USING (
  status = 'OPEN' AND provider_id IS NULL
  OR provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);