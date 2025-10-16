-- Corrigir filtro de tipos de serviço para prestadores
-- Excluir fretes do painel de prestadores de serviços

-- Primeiro, remover a função antiga
DROP FUNCTION IF EXISTS get_service_requests_for_provider_cities(uuid);

-- Recriar função com filtros corretos
CREATE OR REPLACE FUNCTION get_service_requests_for_provider_cities(p_provider_id uuid)
RETURNS TABLE(
  id uuid,
  service_type text,
  status text,
  created_at timestamp with time zone,
  client_id uuid,
  location_lat numeric,
  location_lng numeric,
  location_address text,
  city_name text,
  state text,
  description text,
  scheduled_date timestamp with time zone,
  urgency text,
  price_range text,
  metadata jsonb,
  distance_km numeric,
  provider_city_name text,
  provider_city_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    sr.id,
    sr.service_type,
    sr.status,
    sr.created_at,
    sr.client_id,
    sr.location_lat,
    sr.location_lng,
    sr.location_address,
    sr.city_name,
    sr.state,
    sr.description,
    sr.scheduled_date,
    sr.urgency,
    sr.price_range,
    sr.metadata,
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(uc.lng::double precision, uc.lat::double precision), 4326)::extensions.geography
    )::numeric / 1000 AS distance_km,
    uc.city_name AS provider_city_name,
    uc.city_id AS provider_city_id
  FROM service_requests sr
  INNER JOIN user_cities uc 
    ON uc.user_id IN (
      SELECT user_id FROM profiles WHERE id = p_provider_id
    )
    AND uc.role = 'PRESTADOR_SERVICOS'
  INNER JOIN profiles p 
    ON p.id = p_provider_id 
    AND p.role = 'PRESTADOR_SERVICOS'
  WHERE sr.status IN ('PENDING', 'OPEN')
    AND sr.provider_id IS NULL
    AND sr.location_lat IS NOT NULL
    AND sr.location_lng IS NOT NULL
    -- FILTRO CRÍTICO: Excluir todos os tipos de frete
    AND sr.service_type NOT IN ('FRETE_MOTO', 'GUINCHO_FREIGHT', 'CARGA_FREIGHT', 'MUDANCA_FREIGHT', 'CARGA', 'GUINCHO', 'MUDANCA')
    -- FILTRO CRÍTICO: Apenas serviços oferecidos pelo prestador
    AND p.service_types IS NOT NULL
    AND array_length(p.service_types, 1) > 0
    AND sr.service_type = ANY(p.service_types)
    -- Verificar distância
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(sr.location_lng::double precision, sr.location_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(uc.lng::double precision, uc.lat::double precision), 4326)::extensions.geography,
      (uc.radius_km * 1000)::double precision
    )
  ORDER BY distance_km ASC;
END;
$$;