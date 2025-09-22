-- Corrigir a função get_service_requests_in_radius para aceitar status 'OPEN'
CREATE OR REPLACE FUNCTION public.get_service_requests_in_radius(provider_profile_id uuid)
RETURNS TABLE(
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
SET search_path = 'public'
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
    
    -- Buscar solicitações dentro do raio (status OPEN ou PENDING)
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
    WHERE sr.status IN ('OPEN', 'PENDING')
    AND sr.location_lat IS NOT NULL 
    AND sr.location_lng IS NOT NULL
    AND calculate_distance_km(provider_lat, provider_lng, sr.location_lat, sr.location_lng) <= provider_radius
    ORDER BY distance_km ASC;
END;
$$;