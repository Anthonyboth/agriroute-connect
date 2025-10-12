-- =========================================
-- MATCHING INTELIGENTE PARA PRESTADORES DE SERVIÇOS
-- =========================================

-- 1. Criar função RPC para buscar solicitações compatíveis
CREATE OR REPLACE FUNCTION public.get_compatible_service_requests_for_provider(p_provider_id uuid)
RETURNS TABLE(
  request_id uuid, 
  service_type text, 
  location_address text,
  city_name text,
  state text,
  problem_description text, 
  urgency text, 
  contact_phone text,
  contact_name text,
  status text,
  created_at timestamp with time zone,
  location_lat numeric,
  location_lng numeric,
  vehicle_info text,
  additional_info text,
  is_emergency boolean,
  estimated_price numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  provider_service_types text[];
BEGIN
  -- Buscar tipos de serviço do prestador
  SELECT service_types INTO provider_service_types
  FROM public.profiles 
  WHERE id = p_provider_id AND role = 'PRESTADOR_SERVICOS';
  
  -- Se não tem tipos configurados, retorna vazio
  IF provider_service_types IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    sr.id,
    sr.service_type,
    sr.location_address,
    sr.city_name,
    sr.state,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.status,
    sr.created_at,
    sr.location_lat,
    sr.location_lng,
    sr.vehicle_info,
    sr.additional_info,
    sr.is_emergency,
    sr.estimated_price
  FROM public.service_requests sr
  WHERE 
    sr.status = 'OPEN'
    AND sr.provider_id IS NULL
    -- Filtro por tipo de serviço
    AND (
      array_length(provider_service_types, 1) IS NULL
      OR sr.service_type = ANY(provider_service_types)
    )
    -- Filtro por cidade/região usando service_provider_areas
    AND (
      EXISTS (
        SELECT 1 
        FROM public.service_provider_areas spa
        WHERE spa.provider_id = p_provider_id
          AND spa.is_active = true
          AND (
            -- Match por cidade/estado exato
            (
              sr.city_name IS NOT NULL 
              AND sr.state IS NOT NULL
              AND LOWER(TRIM(spa.city_name)) = LOWER(TRIM(sr.city_name))
              AND LOWER(TRIM(spa.state)) = LOWER(TRIM(sr.state))
            )
            OR
            -- Match por proximidade geográfica (se houver coordenadas)
            (
              sr.location_lat IS NOT NULL
              AND sr.location_lng IS NOT NULL
              AND spa.geom IS NOT NULL
              AND extensions.ST_DWithin(
                spa.geom::extensions.geography,
                extensions.ST_SetSRID(
                  extensions.ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision),
                  4326
                )::extensions.geography,
                COALESCE(spa.radius_m, spa.radius_km * 1000)::double precision
              )
            )
          )
          -- Filtro adicional por tipo de serviço na área (se configurado)
          AND (
            array_length(spa.service_types, 1) IS NULL
            OR sr.service_type = ANY(spa.service_types)
          )
      )
    )
  ORDER BY 
    -- Priorizar emergências
    sr.is_emergency DESC NULLS LAST,
    -- Depois por urgência
    CASE sr.urgency
      WHEN 'URGENT' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      ELSE 5
    END,
    -- Por fim, mais antigas primeiro
    sr.created_at ASC;
END;
$$;

-- 2. Criar trigger para garantir geom e radius_m em service_provider_areas
CREATE OR REPLACE FUNCTION public.ensure_service_provider_area_geom()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  -- Garantir geom a partir de lat/lng
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := extensions.ST_SetSRID(
      extensions.ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision),
      4326
    );
  END IF;
  
  -- Garantir radius_m a partir de radius_km
  NEW.radius_m := COALESCE(NEW.radius_m, NEW.radius_km * 1000);
  
  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS ensure_service_provider_area_geom_trigger ON service_provider_areas;

-- Criar trigger
CREATE TRIGGER ensure_service_provider_area_geom_trigger
  BEFORE INSERT OR UPDATE ON service_provider_areas
  FOR EACH ROW
  EXECUTE FUNCTION ensure_service_provider_area_geom();

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_service_provider_areas_geom 
  ON service_provider_areas USING GIST(geom);

CREATE INDEX IF NOT EXISTS idx_service_provider_areas_active_provider 
  ON service_provider_areas(provider_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_service_requests_location 
  ON service_requests(city_name, state);

CREATE INDEX IF NOT EXISTS idx_service_requests_status_type 
  ON service_requests(status, service_type) WHERE provider_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_coords
  ON service_requests(location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- 4. Atualizar áreas existentes para garantir geom
UPDATE service_provider_areas
SET updated_at = now()
WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;