-- Inserir registro básico na tabela service_providers para prestadores existentes que não têm registro
INSERT INTO public.service_providers (
  profile_id,
  service_type,
  service_radius_km,
  service_area_cities,
  emergency_service,
  works_weekends,
  works_holidays
)
SELECT 
  p.id as profile_id,
  COALESCE(p.service_types[1], 'CHAVEIRO') as service_type, -- Primeiro tipo de serviço ou CHAVEIRO como padrão
  COALESCE(p.service_radius_km, 50) as service_radius_km,
  COALESCE(p.service_cities, ARRAY[p.current_city_name || ', ' || p.current_state]) as service_area_cities,
  true as emergency_service,
  true as works_weekends,
  true as works_holidays
FROM public.profiles p
WHERE p.role = 'PRESTADOR_SERVICOS'
  AND p.id NOT IN (SELECT profile_id FROM public.service_providers)
  AND p.service_types IS NOT NULL
  AND array_length(p.service_types, 1) > 0;

-- Atualizar função accept_service_request para funcionar com ambos os sistemas
CREATE OR REPLACE FUNCTION public.accept_service_request(
  p_provider_id uuid,
  p_request_id uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  provider_id uuid,
  accepted_at timestamptz
) AS $$
DECLARE
  is_provider boolean;
BEGIN
  -- Ensure the caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify provider exists (check both service_providers table and profiles.service_types)
  SELECT EXISTS(
    SELECT 1 FROM public.service_providers sp 
    WHERE sp.profile_id = p_provider_id
    UNION
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_provider_id 
      AND p.role = 'PRESTADOR_SERVICOS'
      AND p.service_types IS NOT NULL
      AND array_length(p.service_types, 1) > 0
  ) INTO is_provider;

  IF NOT is_provider THEN
    RAISE EXCEPTION 'provider not registered';
  END IF;

  -- Perform acceptance only if request is still open/pending and unassigned
  RETURN QUERY
  UPDATE public.service_requests sr
  SET 
    provider_id = p_provider_id,
    status = 'ACCEPTED',
    accepted_at = now(),
    updated_at = now()
  WHERE sr.id = p_request_id
    AND sr.provider_id IS NULL
    AND sr.status IN ('OPEN','PENDING')
  RETURNING sr.id, sr.status, sr.provider_id, sr.accepted_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;