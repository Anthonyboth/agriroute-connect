
-- 1. Adicionar colunas de timestamp para etapas intermediárias
ALTER TABLE public.service_requests 
  ADD COLUMN IF NOT EXISTS on_the_way_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP WITH TIME ZONE;

-- 2. Criar RPC atômica para transição de status de service_requests
-- SECURITY DEFINER para garantir atomicidade e validação server-side
CREATE OR REPLACE FUNCTION public.transition_service_request_status(
  p_request_id UUID,
  p_next_status TEXT,
  p_final_price NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_provider_id UUID;
  v_caller_id UUID;
  v_caller_profile_id UUID;
  v_valid_transition BOOLEAN := FALSE;
  v_result JSON;
BEGIN
  -- 1. Obter caller autenticado
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado.');
  END IF;

  -- 2. Obter profile_id do caller
  SELECT id INTO v_caller_profile_id
  FROM profiles
  WHERE user_id = v_caller_id
  LIMIT 1;

  IF v_caller_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil não encontrado.');
  END IF;

  -- 3. Lock e obter dados atuais (advisory lock para serialização)
  PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));

  SELECT status, provider_id 
  INTO v_current_status, v_provider_id
  FROM service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Solicitação de serviço não encontrada.');
  END IF;

  -- 4. Verificar que o caller é o provider do request
  IF v_provider_id IS NULL OR v_provider_id != v_caller_profile_id THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o prestador designado pode alterar o status.');
  END IF;

  -- 5. Validar transição (workflow linear, sem pulos, sem regressão)
  v_valid_transition := CASE
    WHEN v_current_status = 'ACCEPTED' AND p_next_status = 'ON_THE_WAY' THEN TRUE
    WHEN v_current_status = 'ON_THE_WAY' AND p_next_status = 'IN_PROGRESS' THEN TRUE
    WHEN v_current_status = 'IN_PROGRESS' AND p_next_status = 'COMPLETED' THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_valid_transition THEN
    -- Mensagens contextuais em PT-BR
    IF v_current_status = p_next_status THEN
      RETURN json_build_object('success', false, 'error', 'O serviço já está neste status.');
    END IF;
    
    IF v_current_status = 'COMPLETED' THEN
      RETURN json_build_object('success', false, 'error', 'O serviço já foi concluído e não pode ser alterado.');
    END IF;
    
    IF v_current_status = 'CANCELLED' THEN
      RETURN json_build_object('success', false, 'error', 'O serviço foi cancelado e não pode ser alterado.');
    END IF;

    IF v_current_status = 'ACCEPTED' AND p_next_status = 'IN_PROGRESS' THEN
      RETURN json_build_object('success', false, 'error', 'Você precisa marcar "A Caminho" antes de iniciar o serviço.');
    END IF;

    IF v_current_status = 'ACCEPTED' AND p_next_status = 'COMPLETED' THEN
      RETURN json_build_object('success', false, 'error', 'Não é possível concluir diretamente. Siga as etapas: A Caminho → Em Andamento → Concluir.');
    END IF;

    IF v_current_status = 'ON_THE_WAY' AND p_next_status = 'COMPLETED' THEN
      RETURN json_build_object('success', false, 'error', 'Você precisa "Iniciar Serviço" antes de concluir.');
    END IF;

    RETURN json_build_object('success', false, 'error', 
      format('Transição de "%s" para "%s" não é permitida.', v_current_status, p_next_status));
  END IF;

  -- 6. Atualizar status e timestamps atômicos
  UPDATE service_requests
  SET 
    status = p_next_status,
    updated_at = now(),
    on_the_way_at = CASE WHEN p_next_status = 'ON_THE_WAY' THEN now() ELSE on_the_way_at END,
    in_progress_at = CASE WHEN p_next_status = 'IN_PROGRESS' THEN now() ELSE in_progress_at END,
    completed_at = CASE WHEN p_next_status = 'COMPLETED' THEN now() ELSE completed_at END,
    final_price = CASE 
      WHEN p_next_status = 'COMPLETED' AND p_final_price IS NOT NULL THEN p_final_price
      WHEN p_next_status = 'COMPLETED' AND p_final_price IS NULL THEN COALESCE(estimated_price, 0)
      ELSE final_price 
    END
  WHERE id = p_request_id;

  -- 7. Se concluído, criar registro de pagamento na service_payments
  IF p_next_status = 'COMPLETED' THEN
    INSERT INTO service_payments (
      service_request_id,
      client_id,
      provider_id,
      amount,
      platform_fee,
      net_amount,
      status,
      payment_method,
      created_at,
      updated_at
    )
    SELECT
      p_request_id,
      sr.client_id,
      sr.provider_id,
      COALESCE(p_final_price, sr.estimated_price, 0),
      0, -- platform_fee = 0 por enquanto
      COALESCE(p_final_price, sr.estimated_price, 0),
      'proposed', -- status inicial do pagamento
      'EXTERNAL', -- pagamento externo (fora da plataforma)
      now(),
      now()
    FROM service_requests sr
    WHERE sr.id = p_request_id
    -- Evitar duplicação
    AND NOT EXISTS (
      SELECT 1 FROM service_payments sp 
      WHERE sp.service_request_id = p_request_id 
      AND sp.status IN ('proposed', 'paid_by_client', 'confirmed_by_provider')
    );
  END IF;

  RETURN json_build_object(
    'success', true, 
    'status', p_next_status,
    'message', CASE p_next_status
      WHEN 'ON_THE_WAY' THEN 'Status atualizado: A Caminho'
      WHEN 'IN_PROGRESS' THEN 'Status atualizado: Serviço Iniciado'
      WHEN 'COMPLETED' THEN 'Serviço concluído com sucesso!'
      ELSE 'Status atualizado'
    END
  );
END;
$$;

-- 3. Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.transition_service_request_status(UUID, TEXT, NUMERIC) TO authenticated;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
