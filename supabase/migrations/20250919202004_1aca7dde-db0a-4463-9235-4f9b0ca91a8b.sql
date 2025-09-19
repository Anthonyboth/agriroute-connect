-- Criar função simplificada para limpar solicitações expiradas (72 horas)
CREATE OR REPLACE FUNCTION cleanup_expired_requests()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Deletar guest_requests pendentes com mais de 72 horas
  DELETE FROM guest_requests 
  WHERE status = 'PENDING' 
    AND created_at < now() - interval '72 hours';
  
  -- Deletar service_requests pendentes com mais de 72 horas
  DELETE FROM service_requests 
  WHERE status = 'PENDING' 
    AND created_at < now() - interval '72 hours';
END;
$function$;

-- Modificar a função get_provider_service_requests para excluir solicitações expiradas
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
BEGIN
  -- Limpar solicitações expiradas antes de buscar
  PERFORM cleanup_expired_requests();
  
  -- Buscar os tipos de serviço do prestador
  SELECT service_types INTO provider_services
  FROM profiles 
  WHERE profiles.id = provider_profile_id;
  
  -- Se não encontrou o prestador, retorna vazio
  IF provider_services IS NULL THEN
    RETURN;
  END IF;

  -- Retornar solicitações da tabela service_requests (não expiradas)
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
    -- Dados sensíveis apenas para provedores autorizados ou quando status é PENDING
    CASE 
      WHEN r.provider_id = provider_profile_id OR r.status = 'PENDING'
      THEN COALESCE(decrypt_sensitive_data(r.contact_phone_encrypted), r.contact_phone)
      ELSE '***-****-****'
    END as contact_phone_safe,
    CASE 
      WHEN r.provider_id = provider_profile_id OR r.status = 'PENDING'
      THEN COALESCE(decrypt_sensitive_data(r.location_address_encrypted), r.location_address)
      ELSE 'Endereço restrito até aceitar'
    END as location_address_safe
  FROM public.service_requests r
  WHERE (r.provider_id = provider_profile_id OR r.status = 'PENDING')
    AND r.service_type = ANY(provider_services)
    AND r.created_at >= now() - interval '72 hours'  -- Excluir expiradas
  
  UNION ALL
  
  -- Retornar solicitações da tabela guest_requests (não expiradas)
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
    -- Dados de contato sempre visíveis para guest requests
    COALESCE(gr.contact_phone, '***-****-****') as contact_phone_safe,
    COALESCE(gr.payload->>'origin_address', 'Localização não informada') as location_address_safe
  FROM public.guest_requests gr
  WHERE gr.request_type = 'SERVICE'
    AND (gr.provider_id = provider_profile_id OR gr.provider_id IS NULL)
    AND gr.service_type = ANY(provider_services)
    AND gr.status = 'PENDING'
    AND gr.created_at >= now() - interval '72 hours'  -- Excluir expiradas
  
  ORDER BY created_at DESC;
END;
$function$;