-- Atualizar get_service_requests_by_city para considerar áreas ativas E cidades do perfil
CREATE OR REPLACE FUNCTION get_service_requests_by_city(
  provider_profile_id uuid,
  provider_current_city text DEFAULT NULL,
  provider_current_state text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  client_id uuid,
  service_type text,
  location_address text,
  location_lat numeric,
  location_lng numeric,
  city_name text,
  state text,
  problem_description text,
  vehicle_info text,
  urgency text,
  contact_phone text,
  contact_name text,
  additional_info text,
  is_emergency boolean,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  provider_service_types text[];
BEGIN
  -- Buscar tipos de serviço do prestador
  SELECT service_types INTO provider_service_types
  FROM profiles 
  WHERE id = provider_profile_id;

  RETURN QUERY
  SELECT 
    sr.id,
    sr.client_id,
    sr.service_type,
    sr.location_address,
    sr.location_lat,
    sr.location_lng,
    sr.city_name,
    sr.state,
    sr.problem_description,
    sr.vehicle_info,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.additional_info,
    sr.is_emergency,
    sr.status,
    sr.created_at,
    sr.updated_at
  FROM service_requests sr
  WHERE 
    sr.provider_id IS NULL
    AND sr.status = 'OPEN'
    -- Filtrar por tipo de serviço do prestador
    AND (
      array_length(provider_service_types, 1) IS NULL
      OR sr.service_type = ANY(provider_service_types)
    )
    -- Garantir que cidade e estado existem
    AND sr.city_name IS NOT NULL
    AND sr.state IS NOT NULL
    -- Verificar se a cidade está nas áreas ativas OU no perfil
    AND (
      -- 1) Áreas de atendimento ATIVAS
      EXISTS (
        SELECT 1
        FROM service_provider_areas spa
        WHERE spa.provider_id = provider_profile_id
          AND spa.is_active = true
          AND LOWER(TRIM(spa.city_name)) = LOWER(TRIM(sr.city_name))
          AND LOWER(TRIM(spa.state)) = LOWER(TRIM(sr.state))
      )
      -- 2) Cidade atual do perfil
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = provider_profile_id
          AND p.current_city_name IS NOT NULL
          AND p.current_state IS NOT NULL
          AND LOWER(TRIM(p.current_city_name)) = LOWER(TRIM(sr.city_name))
          AND LOWER(TRIM(p.current_state)) = LOWER(TRIM(sr.state))
      )
      -- 3) Lista de cidades do perfil (service_cities: "Cidade, UF")
      OR EXISTS (
        SELECT 1
        FROM profiles p,
             LATERAL unnest(p.service_cities) AS cs
        WHERE p.id = provider_profile_id
          AND p.service_cities IS NOT NULL
          AND LOWER(TRIM(cs)) = LOWER(TRIM(sr.city_name || ', ' || sr.state))
      )
    )
  ORDER BY sr.created_at ASC;
END;
$$;