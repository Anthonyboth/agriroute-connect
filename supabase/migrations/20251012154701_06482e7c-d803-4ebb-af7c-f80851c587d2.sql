-- ================================================
-- FASE 1: Criar tabela user_cities (many-to-many)
-- ================================================

-- Enum para tipo de uso da cidade
CREATE TYPE user_city_type AS ENUM (
  'MOTORISTA_ORIGEM',      -- Motorista busca fretes com origem aqui
  'MOTORISTA_DESTINO',     -- Motorista busca fretes com destino aqui
  'PRESTADOR_SERVICO',     -- Prestador oferece serviços aqui
  'PRODUTOR_LOCALIZACAO'   -- Produtor cria fretes aqui
);

-- Tabela principal user_cities
CREATE TABLE public.user_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  type user_city_type NOT NULL,
  radius_km NUMERIC NOT NULL DEFAULT 50 CHECK (radius_km > 0 AND radius_km <= 300),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, city_id, type)
);

-- Índices para performance
CREATE INDEX idx_user_cities_user_id ON public.user_cities(user_id);
CREATE INDEX idx_user_cities_city_id ON public.user_cities(city_id);
CREATE INDEX idx_user_cities_type ON public.user_cities(type);
CREATE INDEX idx_user_cities_active ON public.user_cities(is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_user_cities_updated_at
  BEFORE UPDATE ON public.user_cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FASE 2: RLS Policies para user_cities
-- ================================================

ALTER TABLE public.user_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cities"
  ON public.user_cities
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone can view active cities"
  ON public.user_cities
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all cities"
  ON public.user_cities
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ================================================
-- FASE 3: Função para buscar usuários por cidade
-- ================================================

CREATE OR REPLACE FUNCTION get_users_in_city(
  p_city_id UUID,
  p_type user_city_type,
  p_include_nearby BOOLEAN DEFAULT true
)
RETURNS TABLE(
  user_id UUID,
  city_id UUID,
  city_name TEXT,
  city_state TEXT,
  distance_m NUMERIC,
  radius_km NUMERIC
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  target_city RECORD;
BEGIN
  SELECT c.lat, c.lng, c.name, c.state
  INTO target_city
  FROM cities c
  WHERE c.id = p_city_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cidade não encontrada: %', p_city_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    uc.user_id,
    uc.city_id,
    c.name AS city_name,
    c.state AS city_state,
    CASE 
      WHEN p_include_nearby AND c.lat IS NOT NULL AND c.lng IS NOT NULL THEN
        extensions.ST_Distance(
          extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
          extensions.ST_SetSRID(extensions.ST_MakePoint(target_city.lng::double precision, target_city.lat::double precision), 4326)::extensions.geography
        )::numeric
      ELSE 0
    END AS distance_m,
    uc.radius_km
  FROM user_cities uc
  JOIN cities c ON uc.city_id = c.id
  WHERE 
    uc.type = p_type
    AND uc.is_active = true
    AND (
      uc.city_id = p_city_id
      OR
      (
        p_include_nearby 
        AND c.lat IS NOT NULL 
        AND c.lng IS NOT NULL
        AND extensions.ST_DWithin(
          extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
          extensions.ST_SetSRID(extensions.ST_MakePoint(target_city.lng::double precision, target_city.lat::double precision), 4326)::extensions.geography,
          (uc.radius_km * 1000)::double precision
        )
      )
    )
  ORDER BY distance_m ASC;
END;
$$;

-- ================================================
-- FASE 4: Função de matching para fretes
-- ================================================

CREATE OR REPLACE FUNCTION match_drivers_to_freight(
  p_freight_id UUID
)
RETURNS TABLE(
  driver_id UUID,
  driver_name TEXT,
  driver_rating NUMERIC,
  city_match_type TEXT,
  distance_m NUMERIC,
  radius_km NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freight RECORD;
BEGIN
  SELECT 
    f.origin_city,
    f.origin_state,
    f.destination_city,
    f.destination_state,
    c_origin.id AS origin_city_id,
    c_dest.id AS dest_city_id
  INTO freight
  FROM freights f
  LEFT JOIN cities c_origin ON LOWER(TRIM(c_origin.name)) = LOWER(TRIM(f.origin_city)) 
    AND LOWER(TRIM(c_origin.state)) = LOWER(TRIM(f.origin_state))
  LEFT JOIN cities c_dest ON LOWER(TRIM(c_dest.name)) = LOWER(TRIM(f.destination_city))
    AND LOWER(TRIM(c_dest.state)) = LOWER(TRIM(f.destination_state))
  WHERE f.id = p_freight_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frete não encontrado: %', p_freight_id;
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT
    p.id AS driver_id,
    p.full_name AS driver_name,
    p.rating AS driver_rating,
    CASE 
      WHEN uc.city_id = freight.origin_city_id THEN 'ORIGEM_EXATA'
      WHEN uc.city_id = freight.dest_city_id THEN 'DESTINO_EXATO'
      ELSE 'RAIO'
    END AS city_match_type,
    COALESCE(
      (SELECT distance_m FROM get_users_in_city(freight.origin_city_id, 'MOTORISTA_ORIGEM'::user_city_type) 
       WHERE user_id = p.user_id LIMIT 1),
      0
    ) AS distance_m,
    uc.radius_km
  FROM profiles p
  JOIN user_cities uc ON uc.user_id = p.user_id
  WHERE 
    p.role = 'MOTORISTA'
    AND p.status = 'APPROVED'
    AND uc.is_active = true
    AND (
      uc.type = 'MOTORISTA_ORIGEM'::user_city_type
      OR uc.type = 'MOTORISTA_DESTINO'::user_city_type
    )
    AND (
      uc.city_id = freight.origin_city_id
      OR uc.city_id = freight.dest_city_id
      OR EXISTS (
        SELECT 1 FROM get_users_in_city(
          COALESCE(freight.origin_city_id, freight.dest_city_id),
          CASE WHEN uc.type = 'MOTORISTA_ORIGEM'::user_city_type THEN 'MOTORISTA_ORIGEM'::user_city_type ELSE 'MOTORISTA_DESTINO'::user_city_type END
        )
        WHERE user_id = p.user_id
      )
    )
  ORDER BY 
    CASE city_match_type
      WHEN 'ORIGEM_EXATA' THEN 1
      WHEN 'DESTINO_EXATO' THEN 2
      ELSE 3
    END,
    distance_m ASC,
    driver_rating DESC NULLS LAST;
END;
$$;

-- ================================================
-- FASE 5: Função de matching para serviços
-- ================================================

CREATE OR REPLACE FUNCTION match_providers_to_service(
  p_service_request_id UUID
)
RETURNS TABLE(
  provider_id UUID,
  provider_name TEXT,
  provider_rating NUMERIC,
  service_types TEXT[],
  distance_m NUMERIC,
  radius_km NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_req RECORD;
BEGIN
  SELECT 
    sr.origin_city,
    sr.origin_state,
    sr.service_type,
    c.id AS city_id
  INTO service_req
  FROM service_requests sr
  LEFT JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(sr.origin_city))
    AND LOWER(TRIM(c.state)) = LOWER(TRIM(sr.origin_state))
  WHERE sr.id = p_service_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de serviço não encontrada: %', p_service_request_id;
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT
    p.id AS provider_id,
    p.full_name AS provider_name,
    p.rating AS provider_rating,
    p.service_types,
    COALESCE(
      (SELECT distance_m FROM get_users_in_city(service_req.city_id, 'PRESTADOR_SERVICO'::user_city_type)
       WHERE user_id = p.user_id LIMIT 1),
      0
    ) AS distance_m,
    uc.radius_km
  FROM profiles p
  JOIN user_cities uc ON uc.user_id = p.user_id
  WHERE 
    p.role = 'PRESTADOR_SERVICOS'
    AND p.status = 'APPROVED'
    AND uc.is_active = true
    AND uc.type = 'PRESTADOR_SERVICO'::user_city_type
    AND (
      uc.city_id = service_req.city_id
      OR EXISTS (
        SELECT 1 FROM get_users_in_city(service_req.city_id, 'PRESTADOR_SERVICO'::user_city_type)
        WHERE user_id = p.user_id
      )
    )
    AND (
      service_req.service_type = ANY(p.service_types)
      OR array_length(p.service_types, 1) IS NULL
    )
  ORDER BY 
    distance_m ASC,
    provider_rating DESC NULLS LAST;
END;
$$;

-- ================================================
-- FASE 6: Migração de dados existentes
-- ================================================

-- Migrar de driver_service_areas
INSERT INTO public.user_cities (user_id, city_id, type, radius_km, is_active)
SELECT DISTINCT
  p.user_id,
  c.id,
  'MOTORISTA_ORIGEM'::user_city_type,
  LEAST(COALESCE(dsa.radius_km, 50), 300),
  dsa.is_active
FROM driver_service_areas dsa
JOIN profiles p ON dsa.driver_id = p.id
JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(dsa.city_name))
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(dsa.state))
WHERE NOT EXISTS (
  SELECT 1 FROM user_cities uc 
  WHERE uc.user_id = p.user_id 
    AND uc.city_id = c.id 
    AND uc.type = 'MOTORISTA_ORIGEM'::user_city_type
)
ON CONFLICT (user_id, city_id, type) DO NOTHING;

-- Migrar de service_provider_areas
INSERT INTO public.user_cities (user_id, city_id, type, radius_km, is_active)
SELECT DISTINCT
  p.user_id,
  c.id,
  'PRESTADOR_SERVICO'::user_city_type,
  LEAST(COALESCE(spa.radius_km, 50), 300),
  spa.is_active
FROM service_provider_areas spa
JOIN profiles p ON spa.provider_id = p.id
JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(spa.city_name))
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(spa.state))
WHERE NOT EXISTS (
  SELECT 1 FROM user_cities uc
  WHERE uc.user_id = p.user_id
    AND uc.city_id = c.id
    AND uc.type = 'PRESTADOR_SERVICO'::user_city_type
)
ON CONFLICT (user_id, city_id, type) DO NOTHING;

-- Migrar de profiles.service_cities (array de texto)
INSERT INTO public.user_cities (user_id, city_id, type, radius_km, is_active)
SELECT DISTINCT
  p.user_id,
  c.id,
  CASE 
    WHEN p.role = 'MOTORISTA' THEN 'MOTORISTA_ORIGEM'::user_city_type
    WHEN p.role = 'PRESTADOR_SERVICOS' THEN 'PRESTADOR_SERVICO'::user_city_type
    ELSE 'PRODUTOR_LOCALIZACAO'::user_city_type
  END,
  50,
  true
FROM profiles p
CROSS JOIN LATERAL unnest(p.service_cities) AS city_str
JOIN cities c ON (c.name || ', ' || c.state) = city_str
WHERE 
  p.service_cities IS NOT NULL 
  AND array_length(p.service_cities, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM user_cities uc
    WHERE uc.user_id = p.user_id
      AND uc.city_id = c.id
  )
ON CONFLICT (user_id, city_id, type) DO NOTHING;

-- ================================================
-- FASE 7: Atualizar funções de matching existentes
-- ================================================

CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status text,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_user_id UUID;
  driver_services text[];
BEGIN
  SELECT p.user_id, p.service_types 
  INTO driver_user_id, driver_services
  FROM public.profiles p
  WHERE p.id = p_driver_id AND p.role = 'MOTORISTA';
  
  IF driver_user_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at
  FROM public.freights f
  WHERE 
    f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks
    AND public.is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
    AND EXISTS (
      SELECT 1 FROM user_cities uc
      JOIN cities c ON uc.city_id = c.id
      WHERE 
        uc.user_id = driver_user_id
        AND uc.is_active = true
        AND (
          uc.type = 'MOTORISTA_ORIGEM'::user_city_type 
          OR uc.type = 'MOTORISTA_DESTINO'::user_city_type
        )
        AND (
          (LOWER(TRIM(c.name)) = LOWER(TRIM(f.origin_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.origin_state)))
          OR
          (LOWER(TRIM(c.name)) = LOWER(TRIM(f.destination_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.destination_state)))
          OR
          (
            c.lat IS NOT NULL AND c.lng IS NOT NULL
            AND f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL
            AND extensions.ST_DWithin(
              extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
              extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography,
              (uc.radius_km * 1000)::double precision
            )
          )
        )
    )
  ORDER BY f.created_at DESC;
END;
$$;