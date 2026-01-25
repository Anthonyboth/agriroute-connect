-- P0: Corrigir RPC de cancelamento para usar profile_id ao invés de auth.uid()
-- Bug: client_id armazena profiles.id, mas RPC comparava com auth.uid() (users.id)

DROP FUNCTION IF EXISTS public.cancel_producer_service_request(uuid, text);

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
  v_current_profile_id uuid;
BEGIN
  -- ✅ P0 FIX: Buscar o profile_id correto do usuário autenticado
  v_current_profile_id := current_profile_id();
  
  -- Verificar autenticação
  IF v_current_profile_id IS NULL THEN
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

  -- ✅ P0 FIX: Comparar profile_id com profile_id (não auth.uid())
  IF v_client_id != v_current_profile_id THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Você não é o dono desta solicitação',
      'debug_info', jsonb_build_object(
        'client_id', v_client_id,
        'current_profile_id', v_current_profile_id
      )
    );
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

COMMENT ON FUNCTION public.cancel_producer_service_request IS 'P0 FIX: Cancela service_request validando ownership por profile_id (não auth.uid())';
