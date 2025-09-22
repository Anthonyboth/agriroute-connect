-- Melhorias no sistema de geolocalização e filtro regional

-- Garantir que PostGIS está habilitado
CREATE EXTENSION IF NOT EXISTS postgis;

-- Atualizar tabela de perfis para melhor suporte a geolocalização
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS base_city_name text,
ADD COLUMN IF NOT EXISTS base_state text,
ADD COLUMN IF NOT EXISTS base_lat numeric,
ADD COLUMN IF NOT EXISTS base_lng numeric,
ADD COLUMN IF NOT EXISTS service_radius_km integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS location_enabled boolean DEFAULT false;

-- Atualizar tabela service_requests para garantir coordenadas
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS location_lat numeric,
ADD COLUMN IF NOT EXISTS location_lng numeric;

-- Criar índices geoespaciais se não existirem
CREATE INDEX IF NOT EXISTS idx_profiles_base_location ON profiles USING BTREE (base_lat, base_lng) WHERE base_lat IS NOT NULL AND base_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_requests_location ON service_requests USING BTREE (location_lat, location_lng) WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_freights_origin_location ON freights USING BTREE (origin_lat, origin_lng) WHERE origin_lat IS NOT NULL AND origin_lng IS NOT NULL;

-- Função para calcular distância entre dois pontos (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric AS $$
DECLARE
    earth_radius constant numeric := 6371; -- Raio da Terra em KM
    dlat numeric;
    dlng numeric;
    a numeric;
    c numeric;
BEGIN
    IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para buscar service_requests dentro do raio do prestador
CREATE OR REPLACE FUNCTION get_service_requests_in_radius(provider_profile_id uuid)
RETURNS TABLE (
    id uuid,
    client_id uuid,
    service_type text,
    location_address text,
    location_lat numeric,
    location_lng numeric,
    problem_description text,
    urgency text,
    contact_phone text,
    status text,
    created_at timestamp with time zone,
    distance_km numeric
) AS $$
DECLARE
    provider_lat numeric;
    provider_lng numeric;
    provider_radius integer;
BEGIN
    -- Buscar localização e raio do prestador
    SELECT base_lat, base_lng, COALESCE(service_radius_km, 100)
    INTO provider_lat, provider_lng, provider_radius
    FROM profiles 
    WHERE profiles.id = provider_profile_id;
    
    -- Se não tem localização definida, retornar vazio
    IF provider_lat IS NULL OR provider_lng IS NULL THEN
        RETURN;
    END IF;
    
    -- Buscar solicitações dentro do raio
    RETURN QUERY
    SELECT 
        sr.id,
        sr.client_id,
        sr.service_type,
        sr.location_address,
        sr.location_lat,
        sr.location_lng,
        sr.problem_description,
        sr.urgency,
        sr.contact_phone,
        sr.status,
        sr.created_at,
        calculate_distance_km(provider_lat, provider_lng, sr.location_lat, sr.location_lng) as distance_km
    FROM service_requests sr
    WHERE sr.status = 'PENDING'
    AND sr.location_lat IS NOT NULL 
    AND sr.location_lng IS NOT NULL
    AND calculate_distance_km(provider_lat, provider_lng, sr.location_lat, sr.location_lng) <= provider_radius
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar fretes dentro do raio do motorista
CREATE OR REPLACE FUNCTION get_freights_in_radius(driver_profile_id uuid)
RETURNS TABLE (
    id uuid,
    producer_id uuid,
    cargo_type text,
    weight numeric,
    origin_address text,
    destination_address text,
    origin_lat numeric,
    origin_lng numeric,
    destination_lat numeric,
    destination_lng numeric,
    pickup_date date,
    delivery_date date,
    price numeric,
    urgency text,
    status text,
    created_at timestamp with time zone,
    distance_km numeric
) AS $$
DECLARE
    driver_lat numeric;
    driver_lng numeric;
    driver_radius integer;
BEGIN
    -- Buscar localização e raio do motorista
    SELECT base_lat, base_lng, COALESCE(service_radius_km, 200)
    INTO driver_lat, driver_lng, driver_radius
    FROM profiles 
    WHERE profiles.id = driver_profile_id;
    
    -- Se não tem localização definida, retornar vazio
    IF driver_lat IS NULL OR driver_lng IS NULL THEN
        RETURN;
    END IF;
    
    -- Buscar fretes dentro do raio
    RETURN QUERY
    SELECT 
        f.id,
        f.producer_id,
        f.cargo_type,
        f.weight,
        f.origin_address,
        f.destination_address,
        f.origin_lat,
        f.origin_lng,
        f.destination_lat,
        f.destination_lng,
        f.pickup_date,
        f.delivery_date,
        f.price,
        f.urgency::text,
        f.status::text,
        f.created_at,
        calculate_distance_km(driver_lat, driver_lng, f.origin_lat, f.origin_lng) as distance_km
    FROM freights f
    WHERE f.status = 'OPEN'
    AND f.origin_lat IS NOT NULL 
    AND f.origin_lng IS NOT NULL
    AND calculate_distance_km(driver_lat, driver_lng, f.origin_lat, f.origin_lng) <= driver_radius
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar coordenadas automaticamente quando endereços são inseridos
CREATE OR REPLACE FUNCTION update_location_coordinates()
RETURNS TRIGGER AS $$
BEGIN
    -- Este trigger pode ser expandido para usar APIs de geocoding
    -- Por enquanto, apenas garante que os campos existem
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;