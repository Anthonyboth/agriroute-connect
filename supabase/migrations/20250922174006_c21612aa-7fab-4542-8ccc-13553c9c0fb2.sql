-- Corrigir avisos de segurança

-- 1. Corrigir search_path nas funções
DROP FUNCTION IF EXISTS calculate_distance_km(numeric, numeric, numeric, numeric);
CREATE OR REPLACE FUNCTION calculate_distance_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric 
LANGUAGE plpgsql 
IMMUTABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;

-- 2. Corrigir função get_service_requests_in_radius
DROP FUNCTION IF EXISTS get_service_requests_in_radius(uuid);
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
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;

-- 3. Corrigir função get_freights_in_radius
DROP FUNCTION IF EXISTS get_freights_in_radius(uuid);
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
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;

-- 4. Corrigir função update_location_coordinates
DROP FUNCTION IF EXISTS update_location_coordinates();
CREATE OR REPLACE FUNCTION update_location_coordinates()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Este trigger pode ser expandido para usar APIs de geocoding
    -- Por enquanto, apenas garante que os campos existem
    RETURN NEW;
END;
$$;