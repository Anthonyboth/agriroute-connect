-- Função para buscar solicitações de serviço para prestadores considerando compatibilidade de tipos
CREATE OR REPLACE FUNCTION get_provider_service_requests(provider_profile_id uuid)
RETURNS TABLE (
  id uuid,
  client_id uuid,
  service_type text,
  location_address_safe text,
  problem_description text,
  vehicle_info text,
  urgency text,
  contact_phone_safe text,
  contact_name text,
  preferred_datetime text,
  additional_info text,
  is_emergency boolean,
  estimated_price numeric,
  status text,
  created_at timestamp with time zone,
  request_source text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_areas record;
  compatible_service_types text[] := ARRAY[]::text[];
BEGIN
  -- Primeiro, vamos buscar as áreas de serviço do prestador
  FOR provider_areas IN 
    SELECT spa.service_types, spa.lat, spa.lng, spa.radius_km
    FROM service_provider_areas spa
    WHERE spa.provider_id = provider_profile_id 
    AND spa.is_active = true
  LOOP
    -- Adicionar os tipos de serviço compatíveis
    compatible_service_types := compatible_service_types || provider_areas.service_types;
  END LOOP;

  -- Mapear tipos de serviços similares para compatibilidade
  IF 'BORRACHARIA' = ANY(compatible_service_types) THEN
    compatible_service_types := compatible_service_types || ARRAY['BORRACHEIRO'];
  END IF;
  
  IF 'BORRACHEIRO' = ANY(compatible_service_types) THEN
    compatible_service_types := compatible_service_types || ARRAY['BORRACHARIA'];
  END IF;

  IF 'MECANICO' = ANY(compatible_service_types) THEN
    compatible_service_types := compatible_service_types || ARRAY['MECANICA'];
  END IF;

  IF 'MECANICA' = ANY(compatible_service_types) THEN
    compatible_service_types := compatible_service_types || ARRAY['MECANICO'];
  END IF;

  -- Retornar solicitações das tabelas service_requests
  RETURN QUERY
  SELECT 
    sr.id,
    sr.client_id,
    sr.service_type,
    COALESCE(sr.location_address, 'Localização disponível') as location_address_safe,
    sr.problem_description,
    sr.vehicle_info,
    sr.urgency,
    COALESCE(sr.contact_phone, 'Telefone disponível') as contact_phone_safe,
    sr.contact_name,
    sr.preferred_datetime,
    sr.additional_info,
    sr.is_emergency,
    sr.estimated_price,
    sr.status,
    sr.created_at,
    'service_requests'::text as request_source
  FROM service_requests sr
  WHERE sr.status = 'PENDING'
  AND sr.service_type = ANY(compatible_service_types)
  AND sr.provider_id IS NULL;

  -- Também retornar solicitações de guest_requests compatíveis
  RETURN QUERY
  SELECT 
    gr.id,
    NULL::uuid as client_id,
    gr.service_type,
    COALESCE((gr.payload->>'origin_address')::text, 'Localização disponível') as location_address_safe,
    COALESCE((gr.payload->>'problem_description')::text, 'Detalhes disponíveis') as problem_description,
    COALESCE((gr.payload->>'vehicle_type')::text, '') as vehicle_info,
    CASE 
      WHEN (gr.payload->>'emergency')::boolean = true THEN 'URGENT'
      ELSE 'MEDIUM'
    END as urgency,
    COALESCE(gr.contact_phone, 'Telefone disponível') as contact_phone_safe,
    COALESCE(gr.contact_name, 'Cliente') as contact_name,
    NULL::text as preferred_datetime,
    COALESCE((gr.payload->>'additional_info')::text, '') as additional_info,
    COALESCE((gr.payload->>'emergency')::boolean, false) as is_emergency,
    NULL::numeric as estimated_price,
    gr.status,
    gr.created_at,
    'guest_requests'::text as request_source
  FROM guest_requests gr
  WHERE gr.status = 'PENDING'
  AND gr.request_type = 'SERVICE'
  AND gr.service_type = ANY(compatible_service_types)
  AND gr.provider_id IS NULL;

END;
$$;