-- =====================================================
-- ATUALIZAÇÃO RPC: MOTORISTAS TAMBÉM PODEM ACEITAR
-- =====================================================

CREATE OR REPLACE FUNCTION public.accept_service_request(
  p_provider_id uuid,
  p_request_id uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  provider_id uuid,
  accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_valid_user boolean;
BEGIN
  -- Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verificar se é um motorista OU prestador válido
  SELECT EXISTS(
    SELECT 1 FROM public.service_providers sp 
    WHERE sp.profile_id = p_provider_id
    UNION
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_provider_id 
      AND p.role IN ('PRESTADOR_SERVICOS', 'MOTORISTA')
  ) INTO is_valid_user;

  IF NOT is_valid_user THEN
    RAISE EXCEPTION 'provider not registered';
  END IF;

  -- Tentar aceitar o serviço (atomicamente)
  -- Aceita múltiplos status possíveis: OPEN, PENDING, AVAILABLE, CREATED
  RETURN QUERY
  UPDATE public.service_requests sr
  SET 
    provider_id = p_provider_id,
    status = 'ACCEPTED',
    accepted_at = now(),
    updated_at = now()
  WHERE sr.id = p_request_id
    AND sr.provider_id IS NULL
    AND sr.status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
  RETURNING sr.id, sr.status, sr.provider_id, sr.accepted_at;
END;
$$;