-- =====================================================
-- FASE 1: Atualizar RPC accept_service_request
-- Aceitar múltiplos status e usar SECURITY DEFINER
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
  is_provider boolean;
BEGIN
  -- Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verificar se é um prestador válido
  SELECT EXISTS(
    SELECT 1 FROM public.service_providers sp 
    WHERE sp.profile_id = p_provider_id
    UNION
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_provider_id 
      AND p.role = 'PRESTADOR_SERVICOS'
  ) INTO is_provider;

  IF NOT is_provider THEN
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

-- =====================================================
-- FASE 2: Adicionar política RLS para prestadores
-- verem serviços OPEN (qualquer tipo)
-- =====================================================

DROP POLICY IF EXISTS "providers_view_open_services" ON public.service_requests;

CREATE POLICY "providers_view_open_services"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  -- Serviço está disponível (OPEN ou variantes) e sem provider
  (
    status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
    AND provider_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'PRESTADOR_SERVICOS'
    )
  )
);