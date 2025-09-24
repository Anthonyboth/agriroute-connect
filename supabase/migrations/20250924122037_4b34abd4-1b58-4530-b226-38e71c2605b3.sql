-- Corrigir erro de tipo de dados na função get_service_requests_in_radius

DROP FUNCTION IF EXISTS public.get_service_requests_in_radius(UUID);

-- Recriar função com tipos corretos
CREATE OR REPLACE FUNCTION public.get_service_requests_in_radius(provider_profile_id UUID)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  service_type TEXT,
  location_address TEXT,
  location_city TEXT,
  location_state TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  problem_description TEXT,
  urgency TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  is_emergency BOOLEAN,
  estimated_price NUMERIC,
  status TEXT,
  service_radius_km NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE,
  distance_m DOUBLE PRECISION  -- Mudança aqui: usar DOUBLE PRECISION em vez de NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    sr.id,
    sr.client_id,
    sr.service_type,
    sr.location_address,
    sr.location_city,
    sr.location_state,
    sr.location_lat,
    sr.location_lng,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.is_emergency,
    sr.estimated_price,
    sr.status,
    sr.service_radius_km,
    sr.created_at,
    -- ST_Distance retorna double precision, não numeric
    ST_Distance(
      ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
      spa.geom::geography
    ) as distance_m
  FROM service_requests sr
  CROSS JOIN service_provider_areas spa
  JOIN service_providers sp ON spa.provider_id = sp.profile_id
  WHERE 
    sp.profile_id = provider_profile_id
    AND spa.is_active = true
    AND sr.status = 'PENDING'
    AND sr.location_lat IS NOT NULL 
    AND sr.location_lng IS NOT NULL
    -- Verificar se a solicitação está dentro do raio do prestador
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
      spa.geom::geography,
      spa.radius_km * 1000  -- converter km para metros
    )
    -- Validação adicional: se a solicitação tem raio definido, verificar se o prestador está dentro
    AND (
      sr.service_radius_km IS NULL OR
      ST_DWithin(
        spa.geom::geography,
        ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
        sr.service_radius_km * 1000  -- converter km para metros
      )
    )
    -- Filtrar por tipo de serviço compatível
    AND (
      spa.service_types IS NULL OR
      sr.service_type = ANY(spa.service_types)
    )
  ORDER BY distance_m ASC;
END;
$$;

-- Também corrigir a função get_freights_in_radius
DROP FUNCTION IF EXISTS public.get_freights_in_radius(UUID);

CREATE OR REPLACE FUNCTION public.get_freights_in_radius(driver_profile_id UUID)
RETURNS TABLE (
  id UUID,
  producer_id UUID,
  cargo_type TEXT,
  weight NUMERIC,
  origin_address TEXT,
  origin_city TEXT,
  origin_state TEXT,
  destination_address TEXT,
  destination_city TEXT,
  destination_state TEXT,
  price NUMERIC,
  pickup_date DATE,
  delivery_date DATE,
  status freight_status,
  urgency urgency_level,
  description TEXT,
  distance_km NUMERIC,
  service_radius_km NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE,
  distance_m DOUBLE PRECISION  -- Mudança aqui: usar DOUBLE PRECISION em vez de NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    f.id,
    f.producer_id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.price,
    f.pickup_date,
    f.delivery_date,
    f.status,
    f.urgency,
    f.description,
    f.distance_km,
    f.service_radius_km,
    f.created_at,
    -- ST_Distance retorna double precision, não numeric
    ST_Distance(
      f.origin_geog::geography,
      dsa.geom::geography
    ) as distance_m
  FROM freights f
  CROSS JOIN driver_service_areas dsa
  WHERE 
    dsa.driver_id = driver_profile_id
    AND dsa.is_active = true
    AND f.status = 'OPEN'
    -- Verificar se o frete está dentro do raio da área de serviço do motorista
    AND (
      f.origin_geog IS NULL OR
      ST_DWithin(
        f.origin_geog::geography,
        dsa.geom::geography,
        dsa.radius_km * 1000  -- converter km para metros
      )
    )
    -- Validação adicional: se o frete tem raio definido, verificar se o motorista está dentro do raio do frete
    AND (
      f.service_radius_km IS NULL OR
      f.origin_geog IS NULL OR
      ST_DWithin(
        dsa.geom::geography,
        f.origin_geog::geography,
        f.service_radius_km * 1000  -- converter km para metros
      )
    )
  ORDER BY distance_m ASC;
END;
$$;