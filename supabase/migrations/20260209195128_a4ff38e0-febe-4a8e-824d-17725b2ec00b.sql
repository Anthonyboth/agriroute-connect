
-- RPC para cliente confirmar entrega de serviço PET/Pacote
-- Atualiza service_payment de 'proposed' para 'paid_by_client'
CREATE OR REPLACE FUNCTION public.confirm_service_delivery(
  p_service_request_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_sr RECORD;
  v_payment RECORD;
BEGIN
  -- Resolver profile_id do usuário autenticado
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  -- Buscar service_request
  SELECT id, client_id, provider_id, service_type, status
  INTO v_sr
  FROM service_requests
  WHERE id = p_service_request_id;

  IF v_sr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  -- Verificar se é o cliente
  IF v_sr.client_id != v_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o solicitante pode confirmar a entrega');
  END IF;

  -- Verificar se é PET ou Pacotes
  IF v_sr.service_type NOT IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Confirmação de entrega disponível apenas para Transporte de Pet e Entrega de Pacotes');
  END IF;

  -- Verificar se serviço está COMPLETED
  IF v_sr.status != 'COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O serviço precisa estar concluído para confirmar a entrega');
  END IF;

  -- Buscar pagamento pendente
  SELECT id, status INTO v_payment
  FROM service_payments
  WHERE service_request_id = p_service_request_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum registro de pagamento encontrado');
  END IF;

  IF v_payment.status != 'proposed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pagamento já foi processado (status: ' || v_payment.status || ')');
  END IF;

  -- Atualizar pagamento para paid_by_client
  UPDATE service_payments
  SET status = 'paid_by_client',
      updated_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'confirmed_by_client_at', now(),
        'client_notes', COALESCE(p_notes, '')
      )
  WHERE id = v_payment.id;

  -- Criar notificação para o prestador/motorista
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    v_sr.provider_id,
    'Entrega confirmada pelo cliente',
    'O cliente confirmou o recebimento. Por favor, confirme o recebimento do pagamento.',
    'service_delivery_confirmed',
    jsonb_build_object('service_request_id', p_service_request_id, 'payment_id', v_payment.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Entrega confirmada com sucesso! O motorista será notificado.',
    'payment_id', v_payment.id
  );
END;
$$;

-- RPC para motorista confirmar recebimento do pagamento de serviço PET/Pacote
CREATE OR REPLACE FUNCTION public.confirm_service_payment_receipt(
  p_service_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_sr RECORD;
  v_payment RECORD;
BEGIN
  -- Resolver profile_id
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  -- Buscar service_request
  SELECT id, client_id, provider_id, service_type, status
  INTO v_sr
  FROM service_requests
  WHERE id = p_service_request_id;

  IF v_sr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;

  -- Verificar se é o motorista/prestador
  IF v_sr.provider_id != v_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o motorista/prestador pode confirmar o recebimento');
  END IF;

  -- Buscar pagamento
  SELECT id, status INTO v_payment
  FROM service_payments
  WHERE service_request_id = p_service_request_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum registro de pagamento encontrado');
  END IF;

  IF v_payment.status != 'paid_by_client' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O cliente ainda não confirmou o pagamento');
  END IF;

  -- Atualizar para confirmed_by_provider
  UPDATE service_payments
  SET status = 'confirmed_by_provider',
      processed_at = now(),
      updated_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'confirmed_by_provider_at', now()
      )
  WHERE id = v_payment.id;

  -- Notificar o cliente
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    v_sr.client_id,
    'Pagamento confirmado pelo motorista',
    'O motorista confirmou o recebimento do pagamento. Agora você pode avaliar o serviço!',
    'service_payment_confirmed',
    jsonb_build_object('service_request_id', p_service_request_id, 'payment_id', v_payment.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Recebimento confirmado com sucesso!',
    'payment_id', v_payment.id
  );
END;
$$;
