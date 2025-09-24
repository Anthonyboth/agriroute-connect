-- Criar função para buscar solicitações de serviço na região do prestador
CREATE OR REPLACE FUNCTION public.get_service_requests_in_provider_region(
  provider_user_id uuid
)
RETURNS TABLE (
  id uuid,
  service_type text,
  location_address text,
  location_lat numeric,
  location_lng numeric,
  city_name text,
  state text,
  problem_description text,
  urgency text,
  created_at timestamp with time zone,
  distance_km numeric,
  is_emergency boolean,
  vehicle_info text,
  contact_name text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_profile_id uuid;
  provider_city text;
  provider_state text;
  provider_lat numeric;
  provider_lng numeric;
  provider_radius numeric;
BEGIN
  -- Buscar informações do prestador
  SELECT 
    p.id, 
    p.base_city_name, 
    p.base_state, 
    p.base_lat, 
    p.base_lng,
    COALESCE(p.service_radius_km, 50) as radius
  INTO 
    provider_profile_id,
    provider_city,
    provider_state,
    provider_lat,
    provider_lng,
    provider_radius
  FROM profiles p 
  WHERE p.user_id = provider_user_id 
    AND p.role IN ('PRESTADOR_SERVICOS', 'MOTORISTA');

  -- Se não encontrou o prestador ou não tem localização configurada
  IF provider_profile_id IS NULL OR provider_lat IS NULL OR provider_lng IS NULL THEN
    RETURN;
  END IF;

  -- Buscar solicitações na região do prestador
  RETURN QUERY
  SELECT 
    sr.id,
    sr.service_type,
    sr.location_address,
    sr.location_lat,
    sr.location_lng,
    sr.city_name,
    sr.state,
    sr.problem_description,
    sr.urgency::text,
    sr.created_at,
    -- Calcular distância usando fórmula haversine
    CASE 
      WHEN sr.location_lat IS NOT NULL AND sr.location_lng IS NOT NULL THEN
        ROUND(
          (6371 * acos(
            cos(radians(provider_lat)) * 
            cos(radians(sr.location_lat)) * 
            cos(radians(sr.location_lng) - radians(provider_lng)) + 
            sin(radians(provider_lat)) * 
            sin(radians(sr.location_lat))
          ))::numeric, 2
        )
      ELSE NULL
    END as distance_km,
    sr.is_emergency,
    sr.vehicle_info,
    sr.contact_name,
    sr.status
  FROM service_requests sr
  WHERE 
    sr.status = 'OPEN'
    AND sr.provider_id IS NULL -- Apenas solicitações não atribuídas
    AND (
      -- Filtrar por cidade se as coordenadas não estiverem disponíveis
      (sr.location_lat IS NULL AND LOWER(sr.city_name) = LOWER(provider_city) AND sr.state = provider_state)
      OR 
      -- Filtrar por raio geográfico se as coordenadas estiverem disponíveis
      (sr.location_lat IS NOT NULL AND sr.location_lng IS NOT NULL AND
        6371 * acos(
          cos(radians(provider_lat)) * 
          cos(radians(sr.location_lat)) * 
          cos(radians(sr.location_lng) - radians(provider_lng)) + 
          sin(radians(provider_lat)) * 
          sin(radians(sr.location_lat))
        ) <= provider_radius
      )
    )
  ORDER BY 
    sr.is_emergency DESC, -- Emergências primeiro
    CASE 
      WHEN sr.location_lat IS NOT NULL AND sr.location_lng IS NOT NULL THEN
        6371 * acos(
          cos(radians(provider_lat)) * 
          cos(radians(sr.location_lat)) * 
          cos(radians(sr.location_lng) - radians(provider_lng)) + 
          sin(radians(provider_lat)) * 
          sin(radians(sr.location_lat))
        )
      ELSE 999999 -- Colocar registros sem coordenadas no final
    END ASC, -- Mais próximos primeiro
    sr.created_at ASC; -- Mais antigos primeiro
END;
$$;

-- Criar função similar para freights (guincho)
CREATE OR REPLACE FUNCTION public.get_freights_in_provider_region(
  provider_user_id uuid
)
RETURNS TABLE (
  id uuid,
  service_type text,
  cargo_type text,
  origin_address text,
  destination_address text,
  origin_lat numeric,
  origin_lng numeric,
  origin_city text,
  origin_state text,
  price numeric,
  urgency text,
  created_at timestamp with time zone,
  distance_km numeric,
  weight numeric,
  pickup_date date,
  delivery_date date,
  status text,
  description text,
  producer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_profile_id uuid;
  provider_city text;
  provider_state text;
  provider_lat numeric;
  provider_lng numeric;
  provider_radius numeric;
BEGIN
  -- Buscar informações do prestador
  SELECT 
    p.id, 
    p.base_city_name, 
    p.base_state, 
    p.base_lat, 
    p.base_lng,
    COALESCE(p.service_radius_km, 50) as radius
  INTO 
    provider_profile_id,
    provider_city,
    provider_state,
    provider_lat,
    provider_lng,
    provider_radius
  FROM profiles p 
  WHERE p.user_id = provider_user_id 
    AND p.role IN ('PRESTADOR_SERVICOS', 'MOTORISTA');

  -- Se não encontrou o prestador ou não tem localização configurada
  IF provider_profile_id IS NULL OR provider_lat IS NULL OR provider_lng IS NULL THEN
    RETURN;
  END IF;

  -- Buscar fretes na região do prestador
  RETURN QUERY
  SELECT 
    f.id,
    COALESCE(f.service_type, 'CARGA') as service_type,
    f.cargo_type,
    f.origin_address,
    f.destination_address,
    f.origin_lat,
    f.origin_lng,
    f.origin_city,
    f.origin_state,
    f.price,
    f.urgency::text,
    f.created_at,
    -- Calcular distância usando fórmula haversine
    CASE 
      WHEN f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL THEN
        ROUND(
          (6371 * acos(
            cos(radians(provider_lat)) * 
            cos(radians(f.origin_lat)) * 
            cos(radians(f.origin_lng) - radians(provider_lng)) + 
            sin(radians(provider_lat)) * 
            sin(radians(f.origin_lat))
          ))::numeric, 2
        )
      ELSE NULL
    END as distance_km,
    f.weight,
    f.pickup_date,
    f.delivery_date,
    f.status::text,
    f.description,
    COALESCE(p.full_name, p.first_name) as producer_name
  FROM freights f
  LEFT JOIN profiles p ON f.producer_id = p.id
  WHERE 
    f.status = 'OPEN'
    AND f.driver_id IS NULL -- Apenas fretes não atribuídos
    AND (
      -- Filtrar por cidade se as coordenadas não estiverem disponíveis
      (f.origin_lat IS NULL AND LOWER(f.origin_city) = LOWER(provider_city) AND f.origin_state = provider_state)
      OR 
      -- Filtrar por raio geográfico se as coordenadas estiverem disponíveis
      (f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL AND
        6371 * acos(
          cos(radians(provider_lat)) * 
          cos(radians(f.origin_lat)) * 
          cos(radians(f.origin_lng) - radians(provider_lng)) + 
          sin(radians(provider_lat)) * 
          sin(radians(f.origin_lat))
        ) <= provider_radius
      )
    )
  ORDER BY 
    CASE WHEN f.urgency = 'HIGH' THEN 1 ELSE 2 END, -- Urgências primeiro
    CASE 
      WHEN f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL THEN
        6371 * acos(
          cos(radians(provider_lat)) * 
          cos(radians(f.origin_lat)) * 
          cos(radians(f.origin_lng) - radians(provider_lng)) + 
          sin(radians(provider_lat)) * 
          sin(radians(f.origin_lat))
        )
      ELSE 999999 -- Colocar registros sem coordenadas no final
    END ASC, -- Mais próximos primeiro
    f.created_at ASC; -- Mais antigos primeiro
END;
$$;