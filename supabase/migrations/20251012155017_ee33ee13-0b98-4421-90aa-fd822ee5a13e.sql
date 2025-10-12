-- ================================================
-- Criar tabela user_cities (verifica existência)
-- ================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_city_type') THEN
    CREATE TYPE user_city_type AS ENUM (
      'MOTORISTA_ORIGEM',
      'MOTORISTA_DESTINO',
      'PRESTADOR_SERVICO',
      'PRODUTOR_LOCALIZACAO'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_cities (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_cities_user_id ON public.user_cities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cities_city_id ON public.user_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_user_cities_type ON public.user_cities(type);
CREATE INDEX IF NOT EXISTS idx_user_cities_active ON public.user_cities(is_active) WHERE is_active = true;

-- Trigger
DROP TRIGGER IF EXISTS update_user_cities_updated_at ON public.user_cities;
CREATE TRIGGER update_user_cities_updated_at
  BEFORE UPDATE ON public.user_cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.user_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own cities" ON public.user_cities;
CREATE POLICY "Users can manage their own cities"
  ON public.user_cities FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view active cities" ON public.user_cities;
CREATE POLICY "Anyone can view active cities"
  ON public.user_cities FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all cities" ON public.user_cities;
CREATE POLICY "Admins can view all cities"
  ON public.user_cities FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Função get_users_in_city
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
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  target_city RECORD;
BEGIN
  SELECT c.lat, c.lng, c.name, c.state INTO target_city
  FROM cities c WHERE c.id = p_city_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cidade não encontrada: %', p_city_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    uc.user_id, uc.city_id, c.name, c.state,
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
    uc.type = p_type AND uc.is_active = true
    AND (
      uc.city_id = p_city_id OR
      (p_include_nearby AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        AND extensions.ST_DWithin(
          extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
          extensions.ST_SetSRID(extensions.ST_MakePoint(target_city.lng::double precision, target_city.lat::double precision), 4326)::extensions.geography,
          (uc.radius_km * 1000)::double precision
        ))
    )
  ORDER BY distance_m ASC;
END;
$$;

-- Migração de dados
INSERT INTO public.user_cities (user_id, city_id, type, radius_km, is_active)
SELECT DISTINCT p.user_id, c.id, 'MOTORISTA_ORIGEM'::user_city_type,
  LEAST(COALESCE(dsa.radius_km, 50), 300), dsa.is_active
FROM driver_service_areas dsa
JOIN profiles p ON dsa.driver_id = p.id
JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(dsa.city_name))
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(dsa.state))
ON CONFLICT (user_id, city_id, type) DO NOTHING;

INSERT INTO public.user_cities (user_id, city_id, type, radius_km, is_active)
SELECT DISTINCT p.user_id, c.id, 'PRESTADOR_SERVICO'::user_city_type,
  LEAST(COALESCE(spa.radius_km, 50), 300), spa.is_active
FROM service_provider_areas spa
JOIN profiles p ON spa.provider_id = p.id
JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(spa.city_name))
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(spa.state))
ON CONFLICT (user_id, city_id, type) DO NOTHING;

-- Atualizar get_compatible_freights_for_driver
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  freight_id uuid, cargo_type text, weight numeric, origin_address text,
  destination_address text, pickup_date date, delivery_date date, price numeric,
  urgency text, status text, service_type text, distance_km numeric,
  minimum_antt_price numeric, required_trucks integer, accepted_trucks integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE driver_user_id UUID; driver_services text[];
BEGIN
  SELECT p.user_id, p.service_types INTO driver_user_id, driver_services
  FROM public.profiles p WHERE p.id = p_driver_id AND p.role = 'MOTORISTA';
  
  IF driver_user_id IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  SELECT f.id, f.cargo_type, f.weight, f.origin_address, f.destination_address,
    f.pickup_date, f.delivery_date, f.price, f.urgency::text, f.status::text,
    f.service_type, f.distance_km, f.minimum_antt_price, f.required_trucks,
    f.accepted_trucks, f.created_at
  FROM public.freights f
  WHERE f.status = 'OPEN' AND f.accepted_trucks < f.required_trucks
    AND public.is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
    AND EXISTS (
      SELECT 1 FROM user_cities uc
      JOIN cities c ON uc.city_id = c.id
      WHERE uc.user_id = driver_user_id AND uc.is_active = true
        AND (uc.type = 'MOTORISTA_ORIGEM'::user_city_type OR uc.type = 'MOTORISTA_DESTINO'::user_city_type)
        AND (
          (LOWER(TRIM(c.name)) = LOWER(TRIM(f.origin_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.origin_state)))
          OR (LOWER(TRIM(c.name)) = LOWER(TRIM(f.destination_city)) AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.destination_state)))
          OR (c.lat IS NOT NULL AND c.lng IS NOT NULL AND f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL
            AND extensions.ST_DWithin(
              extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
              extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography,
              (uc.radius_km * 1000)::double precision
            ))
        )
    )
  ORDER BY f.created_at DESC;
END;
$$;