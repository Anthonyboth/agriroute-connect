-- Remover função existente
DROP FUNCTION IF EXISTS get_provider_service_requests(uuid);

-- Criar função para calcular distância entre dois pontos (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric AS $$
DECLARE
    R numeric := 6371; -- Raio da Terra em km
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
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Criar nova função para obter solicitações de serviço filtradas por região
CREATE OR REPLACE FUNCTION get_provider_service_requests(provider_profile_id uuid)
RETURNS TABLE (
    id uuid,
    client_id uuid,
    service_type text,
    location_address text,
    location_address_safe text,
    problem_description text,
    vehicle_info text,
    urgency text,
    contact_phone text,
    contact_phone_safe text,
    contact_name text,
    preferred_datetime timestamp with time zone,
    additional_info text,
    is_emergency boolean,
    estimated_price numeric,
    status text,
    created_at timestamp with time zone,
    distance_km numeric,
    request_source text
) AS $$
DECLARE
    provider_cities text[];
    provider_states text[];
    provider_radius integer;
    provider_lat numeric;
    provider_lng numeric;
    provider_services text[];
BEGIN
    -- Buscar configurações do prestador
    SELECT 
        COALESCE(p.service_cities, ARRAY[]::text[]),
        COALESCE(p.service_states, ARRAY[]::text[]),
        COALESCE(p.service_radius_km, 50),
        p.current_location_lat,
        p.current_location_lng,
        COALESCE(p.service_types, ARRAY[]::text[])
    INTO provider_cities, provider_states, provider_radius, provider_lat, provider_lng, provider_services
    FROM profiles p
    WHERE p.id = provider_profile_id;

    -- Se não encontrou o prestador, retornar vazio
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Buscar service_requests primeiro
    RETURN QUERY
    SELECT 
        sr.id,
        sr.client_id,
        sr.service_type,
        CASE 
            WHEN sr.location_address IS NOT NULL AND sr.provider_id = provider_profile_id 
            THEN sr.location_address
            ELSE 'Endereço disponível após aceitar'
        END as location_address,
        CASE 
            WHEN sr.location_address IS NOT NULL AND sr.provider_id = provider_profile_id
            THEN sr.location_address
            ELSE 'Endereço disponível após aceitar'
        END as location_address_safe,
        sr.problem_description,
        sr.vehicle_info,
        sr.urgency,
        CASE 
            WHEN sr.contact_phone IS NOT NULL AND sr.provider_id = provider_profile_id
            THEN sr.contact_phone
            ELSE 'Telefone disponível após aceitar'
        END as contact_phone,
        CASE 
            WHEN sr.contact_phone IS NOT NULL AND sr.provider_id = provider_profile_id
            THEN sr.contact_phone
            ELSE 'Telefone disponível após aceitar'
        END as contact_phone_safe,
        sr.contact_name,
        sr.preferred_datetime,
        sr.additional_info,
        COALESCE(sr.is_emergency, false) as is_emergency,
        sr.estimated_price,
        sr.status,
        sr.created_at,
        CASE 
            WHEN provider_lat IS NOT NULL AND provider_lng IS NOT NULL AND sr.location_lat IS NOT NULL AND sr.location_lng IS NOT NULL 
            THEN calculate_distance(provider_lat, provider_lng, sr.location_lat, sr.location_lng)
            ELSE NULL
        END as distance_km,
        'service_requests'::text as request_source
    FROM service_requests sr
    WHERE (sr.provider_id = provider_profile_id OR sr.status = 'PENDING')
    AND sr.created_at > now() - interval '72 hours'
    AND (
        -- Filtrar por tipo de serviço se configurado
        array_length(provider_services, 1) IS NULL 
        OR sr.service_type = ANY(provider_services)
    )
    AND (
        -- Se não tem configuração de região, mostrar todos
        (array_length(provider_cities, 1) IS NULL AND array_length(provider_states, 1) IS NULL)
        OR
        -- Filtrar por cidades configuradas
        (array_length(provider_cities, 1) > 0 AND EXISTS (
            SELECT 1 FROM unnest(provider_cities) AS city 
            WHERE sr.location_address ILIKE '%' || city || '%'
        ))
        OR
        -- Filtrar por estados configurados  
        (array_length(provider_states, 1) > 0 AND EXISTS (
            SELECT 1 FROM unnest(provider_states) AS state 
            WHERE sr.location_address ILIKE '%' || state || '%'
        ))
        OR
        -- Filtrar por raio de distância (se tiver coordenadas)
        (provider_lat IS NOT NULL AND provider_lng IS NOT NULL 
         AND sr.location_lat IS NOT NULL AND sr.location_lng IS NOT NULL
         AND calculate_distance(provider_lat, provider_lng, sr.location_lat, sr.location_lng) <= provider_radius)
    )

    UNION ALL

    -- Buscar guest_requests
    SELECT 
        gr.id,
        NULL::uuid as client_id, -- guest_requests não tem client_id
        gr.service_type,
        CASE 
            WHEN gr.payload->>'origin_address' IS NOT NULL AND gr.provider_id = provider_profile_id
            THEN gr.payload->>'origin_address'
            ELSE 'Endereço disponível após aceitar'
        END as location_address,
        CASE 
            WHEN gr.payload->>'origin_address' IS NOT NULL AND gr.provider_id = provider_profile_id
            THEN gr.payload->>'origin_address'
            ELSE 'Endereço disponível após aceitar'
        END as location_address_safe,
        COALESCE(gr.payload->>'problem_description', 'Descrição disponível após aceitar') as problem_description,
        gr.payload->>'vehicle_type' as vehicle_info,
        CASE 
            WHEN (gr.payload->>'emergency')::boolean = true THEN 'URGENT'
            ELSE 'MEDIUM'
        END as urgency,
        CASE 
            WHEN gr.contact_phone IS NOT NULL AND gr.provider_id = provider_profile_id
            THEN gr.contact_phone
            ELSE 'Telefone disponível após aceitar'
        END as contact_phone,
        CASE 
            WHEN gr.contact_phone IS NOT NULL AND gr.provider_id = provider_profile_id
            THEN gr.contact_phone
            ELSE 'Telefone disponível após aceitar'
        END as contact_phone_safe,
        gr.contact_name,
        NULL::timestamp with time zone as preferred_datetime,
        gr.payload->>'additional_info' as additional_info,
        COALESCE((gr.payload->>'emergency')::boolean, false) as is_emergency,
        (gr.payload->>'estimated_price')::numeric as estimated_price,
        gr.status,
        gr.created_at,
        CASE 
            WHEN provider_lat IS NOT NULL AND provider_lng IS NOT NULL 
                 AND (gr.payload->>'origin_lat')::numeric IS NOT NULL 
                 AND (gr.payload->>'origin_lng')::numeric IS NOT NULL 
            THEN calculate_distance(
                provider_lat, 
                provider_lng, 
                (gr.payload->>'origin_lat')::numeric,
                (gr.payload->>'origin_lng')::numeric
            )
            ELSE NULL
        END as distance_km,
        'guest_requests'::text as request_source
    FROM guest_requests gr
    WHERE gr.request_type = 'SERVICE' 
    AND (gr.provider_id = provider_profile_id OR gr.status = 'PENDING')
    AND gr.created_at > now() - interval '72 hours'
    AND (
        -- Filtrar por tipo de serviço se configurado
        array_length(provider_services, 1) IS NULL 
        OR gr.service_type = ANY(provider_services)
    )
    AND (
        -- Se não tem configuração de região, mostrar todos
        (array_length(provider_cities, 1) IS NULL AND array_length(provider_states, 1) IS NULL)
        OR
        -- Filtrar por cidades configuradas
        (array_length(provider_cities, 1) > 0 AND EXISTS (
            SELECT 1 FROM unnest(provider_cities) AS city 
            WHERE (gr.payload->>'origin_address') ILIKE '%' || city || '%'
        ))
        OR
        -- Filtrar por estados configurados
        (array_length(provider_states, 1) > 0 AND EXISTS (
            SELECT 1 FROM unnest(provider_states) AS state 
            WHERE (gr.payload->>'origin_address') ILIKE '%' || state || '%'
        ))
        OR
        -- Filtrar por raio de distância (se tiver coordenadas)
        (provider_lat IS NOT NULL AND provider_lng IS NOT NULL 
         AND (gr.payload->>'origin_lat')::numeric IS NOT NULL 
         AND (gr.payload->>'origin_lng')::numeric IS NOT NULL
         AND calculate_distance(
             provider_lat, 
             provider_lng, 
             (gr.payload->>'origin_lat')::numeric,
             (gr.payload->>'origin_lng')::numeric
         ) <= provider_radius)
    )
    
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION get_provider_service_requests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_distance(numeric, numeric, numeric, numeric) TO authenticated;