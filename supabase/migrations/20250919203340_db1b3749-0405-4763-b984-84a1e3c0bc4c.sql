-- Adicionar campos de área de atendimento na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_regions text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_radius_km integer DEFAULT 50;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_cities text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_states text[];

-- Atualizar a função get_provider_service_requests para filtrar por região
CREATE OR REPLACE FUNCTION public.get_provider_service_requests(provider_profile_id uuid)
RETURNS TABLE(
  id uuid, 
  client_id uuid, 
  service_type text, 
  problem_description text, 
  vehicle_info text, 
  urgency text, 
  estimated_price numeric, 
  status text, 
  created_at timestamp with time zone, 
  is_emergency boolean, 
  contact_phone_safe text, 
  location_address_safe text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  provider_services text[];
  provider_cities text[];
  provider_states text[];
BEGIN
  -- Limpar solicitações expiradas antes de buscar
  PERFORM cleanup_expired_requests();
  
  -- Buscar os tipos de serviço e regiões do prestador
  SELECT service_types, service_cities, service_states 
  INTO provider_services, provider_cities, provider_states
  FROM profiles 
  WHERE profiles.id = provider_profile_id;
  
  -- Se não encontrou o prestador, retorna vazio
  IF provider_services IS NULL THEN
    RETURN;
  END IF;

  -- Retornar solicitações da tabela service_requests (não expiradas e na região)
  RETURN QUERY
  SELECT 
    r.id,
    r.client_id,
    r.service_type,
    r.problem_description,
    r.vehicle_info,
    r.urgency,
    r.estimated_price,
    r.status,
    r.created_at,
    r.is_emergency,
    -- Dados sensíveis apenas quando o prestador foi atribuído e status não é PENDING
    CASE 
      WHEN r.provider_id = provider_profile_id AND r.status IN ('ACCEPTED', 'COMPLETED')
      THEN COALESCE(decrypt_sensitive_data(r.contact_phone_encrypted), r.contact_phone)
      ELSE '***-****-****'
    END as contact_phone_safe,
    CASE 
      WHEN r.provider_id = provider_profile_id AND r.status IN ('ACCEPTED', 'COMPLETED')
      THEN COALESCE(decrypt_sensitive_data(r.location_address_encrypted), r.location_address)
      ELSE 'Endereço disponível após aceitar'
    END as location_address_safe
  FROM public.service_requests r
  WHERE (r.provider_id = provider_profile_id OR r.status = 'PENDING')
    AND r.service_type = ANY(provider_services)
    AND r.created_at >= now() - interval '72 hours'  -- Excluir expiradas
    AND (
      provider_cities IS NULL 
      OR array_length(provider_cities, 1) IS NULL 
      OR EXISTS (
        SELECT 1 FROM unnest(provider_cities) AS city 
        WHERE r.location_address ILIKE '%' || city || '%'
      )
    )
  
  UNION ALL
  
  -- Retornar solicitações da tabela guest_requests (não expiradas e na região)
  SELECT 
    gr.id,
    NULL::uuid as client_id,
    gr.service_type,
    COALESCE(gr.payload->>'problem_description', 'Solicitação via convidado') as problem_description,
    COALESCE(gr.payload->>'vehicle_type', '') as vehicle_info,
    CASE WHEN gr.payload->>'emergency' = 'true' THEN 'ALTA' ELSE 'MEDIA' END as urgency,
    COALESCE((gr.payload->>'estimated_price')::numeric, 0) as estimated_price,
    gr.status,
    gr.created_at,
    COALESCE((gr.payload->>'emergency')::boolean, false) as is_emergency,
    -- Dados de contato protegidos até aceitar
    CASE 
      WHEN gr.provider_id = provider_profile_id AND gr.status IN ('ACCEPTED', 'COMPLETED')
      THEN COALESCE(gr.contact_phone, '***-****-****')
      ELSE '***-****-****'
    END as contact_phone_safe,
    CASE 
      WHEN gr.provider_id = provider_profile_id AND gr.status IN ('ACCEPTED', 'COMPLETED')
      THEN COALESCE(gr.payload->>'origin_address', 'Localização não informada')
      ELSE 'Endereço disponível após aceitar'
    END as location_address_safe
  FROM public.guest_requests gr
  WHERE gr.request_type = 'SERVICE'
    AND (gr.provider_id = provider_profile_id OR gr.provider_id IS NULL)
    AND gr.service_type = ANY(provider_services)
    AND gr.status = 'PENDING'
    AND gr.created_at >= now() - interval '72 hours'  -- Excluir expiradas
    AND (
      provider_cities IS NULL 
      OR array_length(provider_cities, 1) IS NULL 
      OR EXISTS (
        SELECT 1 FROM unnest(provider_cities) AS city 
        WHERE (gr.payload->>'origin_address') ILIKE '%' || city || '%'
      )
    )
  
  ORDER BY created_at DESC;
END;
$function$;

-- Atualizar a função get_compatible_freights_for_driver para filtrar por região
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(freight_id uuid, cargo_type text, weight numeric, origin_address text, destination_address text, pickup_date date, delivery_date date, price numeric, urgency text, status text, service_type text, distance_km numeric, minimum_antt_price numeric, required_trucks integer, accepted_trucks integer, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  driver_services text[];
  driver_cities text[];
BEGIN
  -- Buscar os tipos de serviço e cidades do motorista
  SELECT service_types, service_cities INTO driver_services, driver_cities
  FROM profiles 
  WHERE id = p_driver_id AND role = 'MOTORISTA';
  
  -- Se não encontrou o motorista, retorna vazio
  IF driver_services IS NULL THEN
    RETURN;
  END IF;
  
  -- Retorna fretes compatíveis que ainda têm vagas e estão na região
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at
  FROM freights f
  WHERE 
    f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks  -- Ainda tem vagas
    AND is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
    AND (
      driver_cities IS NULL 
      OR array_length(driver_cities, 1) IS NULL 
      OR EXISTS (
        SELECT 1 FROM unnest(driver_cities) AS city 
        WHERE f.origin_address ILIKE '%' || city || '%' 
           OR f.destination_address ILIKE '%' || city || '%'
      )
    )
  ORDER BY f.created_at DESC;
END;
$function$;