-- Sistema de Localização Inteligente - Parte 2: Funções e Triggers

-- 1. Função melhorada para buscar fretes por região com validação rigorosa
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
  distance_m NUMERIC
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
    -- Calcular distância entre origem do frete e área de serviço do motorista
    COALESCE(
      ST_Distance(
        f.origin_geog::geography,
        dsa.geom::geography
      ), 0
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

-- 2. Função melhorada para buscar service_requests por região
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
  distance_m NUMERIC
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
    -- Calcular distância entre localização da solicitação e área do prestador
    COALESCE(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(sr.location_lng, sr.location_lat), 4326)::geography,
        spa.geom::geography
      ), 0
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

-- 3. Trigger para auto-inserir cidades quando fretes são criados
CREATE OR REPLACE FUNCTION public.auto_insert_freight_cities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-inserir cidade de origem se fornecida
  IF NEW.origin_city IS NOT NULL AND NEW.origin_state IS NOT NULL THEN
    PERFORM auto_insert_city(NEW.origin_city, NEW.origin_state, NEW.origin_lat, NEW.origin_lng);
  END IF;
  
  -- Auto-inserir cidade de destino se fornecida
  IF NEW.destination_city IS NOT NULL AND NEW.destination_state IS NOT NULL THEN
    PERFORM auto_insert_city(NEW.destination_city, NEW.destination_state, NEW.destination_lat, NEW.destination_lng);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para fretes
DROP TRIGGER IF EXISTS trigger_auto_insert_freight_cities ON public.freights;
CREATE TRIGGER trigger_auto_insert_freight_cities
  BEFORE INSERT OR UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_freight_cities();

-- 4. Trigger para auto-inserir cidades quando service_requests são criadas
CREATE OR REPLACE FUNCTION public.auto_insert_service_request_cities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-inserir cidade da localização se fornecida
  IF NEW.location_city IS NOT NULL AND NEW.location_state IS NOT NULL THEN
    PERFORM auto_insert_city(NEW.location_city, NEW.location_state, NEW.location_lat, NEW.location_lng);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para service_requests
DROP TRIGGER IF EXISTS trigger_auto_insert_service_request_cities ON public.service_requests;
CREATE TRIGGER trigger_auto_insert_service_request_cities
  BEFORE INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_service_request_cities();

-- 5. Função para buscar cidades para autocomplete
CREATE OR REPLACE FUNCTION public.search_cities(search_term TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  name TEXT,
  state TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.state,
    c.name || ', ' || c.state as display_name
  FROM cities c
  WHERE 
    LOWER(c.name) LIKE LOWER('%' || search_term || '%')
    OR LOWER(c.state) LIKE LOWER('%' || search_term || '%')
  ORDER BY 
    LENGTH(c.name),  -- Priorizar nomes mais curtos (mais específicos)
    c.name,
    c.state
  LIMIT limit_count;
END;
$$;

-- 6. Índices para otimização de performance
CREATE INDEX IF NOT EXISTS idx_cities_name_state ON public.cities(LOWER(name), LOWER(state));
CREATE INDEX IF NOT EXISTS idx_freights_origin_city_state ON public.freights(origin_city, origin_state) WHERE origin_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_freights_destination_city_state ON public.freights(destination_city, destination_state) WHERE destination_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_location_city_state ON public.service_requests(location_city, location_state) WHERE location_city IS NOT NULL;