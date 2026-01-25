-- =============================================
-- RPC: cancel_producer_service_request
-- Permite que um produtor cancele seu próprio service_request ABERTO
-- =============================================

CREATE OR REPLACE FUNCTION public.cancel_producer_service_request(
  p_request_id uuid,
  p_cancellation_reason text DEFAULT 'Cancelado pelo produtor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_client_id uuid;
  v_auth_uid uuid := auth.uid();
BEGIN
  -- Verificar autenticação
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Buscar dados do service_request
  SELECT sr.status, sr.client_id 
  INTO v_current_status, v_client_id
  FROM service_requests sr
  WHERE sr.id = p_request_id;

  -- Verificar se existe
  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  -- Verificar se o usuário é o dono (cliente)
  IF v_client_id != v_auth_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não é o dono desta solicitação');
  END IF;

  -- Verificar se pode ser cancelado (apenas OPEN ou ACCEPTED antes de iniciar)
  IF v_current_status NOT IN ('OPEN', 'ABERTO', 'ACCEPTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível cancelar uma solicitação em andamento ou já concluída');
  END IF;

  -- Cancelar a solicitação
  UPDATE service_requests
  SET 
    status = 'CANCELLED',
    cancellation_reason = p_cancellation_reason,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitação cancelada com sucesso',
    'request_id', p_request_id
  );
END;
$$;

-- Grant para usuários autenticados
GRANT EXECUTE ON FUNCTION public.cancel_producer_service_request(uuid, text) TO authenticated;