-- Adicionar campos de cidade às tabelas de solicitações e perfis
-- Para implementar correspondência assertiva por cidade

-- Adicionar campos de cidade à tabela service_requests
ALTER TABLE public.service_requests 
ADD COLUMN IF NOT EXISTS city_name text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS city_lat numeric,
ADD COLUMN IF NOT EXISTS city_lng numeric;

-- Create index for faster city-based queries
CREATE INDEX IF NOT EXISTS idx_service_requests_city ON public.service_requests(city_name, state);

-- Adicionar campos de cidades de atendimento aos perfis de prestadores
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS service_cities text[],
ADD COLUMN IF NOT EXISTS current_city_name text,
ADD COLUMN IF NOT EXISTS current_state text;

-- Create index for service cities
CREATE INDEX IF NOT EXISTS idx_profiles_service_cities ON public.profiles USING GIN(service_cities);
CREATE INDEX IF NOT EXISTS idx_profiles_current_city ON public.profiles(current_city_name, current_state);

-- Atualizar tabela de guest_requests para incluir cidade
ALTER TABLE public.guest_requests
ADD COLUMN IF NOT EXISTS city_name text,
ADD COLUMN IF NOT EXISTS state text;

-- Criar função para buscar solicitações por cidade para prestadores
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
SET search_path = public
AS $$
DECLARE
  provider_cities text[];
  provider_city text;
  provider_state text;
BEGIN
  -- Buscar cidades de atendimento do prestador
  SELECT 
    p.service_cities,
    p.current_city_name,
    p.current_state
  INTO 
    provider_cities,
    provider_city,
    provider_state
  FROM profiles p
  WHERE p.id = provider_profile_id;

  -- Se não foram passados parâmetros de cidade atual, usar do perfil
  IF provider_current_city IS NULL THEN
    provider_current_city := provider_city;
  END IF;
  IF provider_current_state IS NULL THEN
    provider_current_state := provider_state;
  END IF;

  -- Retornar solicitações onde:
  -- 1. Status é OPEN/PENDING
  -- 2. Não tem prestador atribuído
  -- 3. A cidade da solicitação está nas cidades de atendimento do prestador
  --    OU é da mesma cidade atual do prestador
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
    AND sr.status IN ('OPEN', 'PENDING')
    AND (
      -- Cidade da solicitação está nas cidades de atendimento do prestador
      (provider_cities IS NOT NULL AND sr.city_name = ANY(provider_cities))
      OR
      -- Mesma cidade atual do prestador
      (sr.city_name = provider_current_city AND sr.state = provider_current_state)
      OR
      -- Fallback: se não há informação de cidade, mostrar todas (compatibilidade)
      (sr.city_name IS NULL OR provider_cities IS NULL)
    )
  ORDER BY sr.created_at ASC; -- Mais antigas primeiro
END;
$$;