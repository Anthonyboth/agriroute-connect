-- Corrigir as funções que usam status 'COMPLETED' inválido

-- Função para confirmar entrega manualmente
CREATE OR REPLACE FUNCTION confirm_delivery(freight_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  freight_record RECORD;
  result json;
BEGIN
  -- Verificar se o usuário é o produtor do frete
  SELECT * INTO freight_record 
  FROM freights f
  WHERE f.id = freight_id_param
    AND f.producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid());
    
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Frete não encontrado ou sem permissão');
  END IF;
  
  -- Verificar se o frete está no status correto
  IF freight_record.status != 'DELIVERED_PENDING_CONFIRMATION' THEN
    RETURN json_build_object('success', false, 'message', 'Frete não está aguardando confirmação');
  END IF;
  
  -- Atualizar status para DELIVERED (status final)
  UPDATE freights 
  SET 
    status = 'DELIVERED',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'confirmed_by_producer_at', now(),
      'confirmed_by_producer_id', (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  WHERE id = freight_id_param;
  
  -- Marcar notificação como lida
  UPDATE notifications 
  SET read = true 
  WHERE user_id = freight_record.producer_id
    AND type = 'delivery_confirmation_required'
    AND data->>'freight_id' = freight_id_param::text;
  
  -- Criar notificação de confirmação para o motorista
  INSERT INTO notifications (
    user_id, 
    title, 
    message, 
    type,
    data
  ) VALUES (
    freight_record.driver_id,
    'Entrega Confirmada pelo Produtor',
    'O produtor confirmou o recebimento da carga. Seu pagamento foi processado!',
    'delivery_confirmed_by_producer',
    jsonb_build_object(
      'freight_id', freight_id_param,
      'confirmed_at', now()
    )
  );
  
  RETURN json_build_object('success', true, 'message', 'Entrega confirmada com sucesso');
END;
$$;

-- Função para auto-confirmação após 72h
CREATE OR REPLACE FUNCTION auto_confirm_deliveries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Buscar fretes que estão aguardando confirmação há mais de 72h
  UPDATE freights 
  SET 
    status = 'DELIVERED',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_confirmed_at', now(),
      'auto_confirmed_reason', 'Confirmação automática após 72h'
    )
  WHERE 
    status = 'DELIVERED_PENDING_CONFIRMATION' 
    AND updated_at < now() - interval '72 hours';
    
  -- Criar notificações para os produtores dos fretes auto-confirmados
  INSERT INTO notifications (user_id, title, message, type, data)
  SELECT 
    f.producer_id,
    'Entrega Confirmada Automaticamente',
    'Sua entrega foi confirmada automaticamente após 72h. O pagamento ao motorista foi processado.',
    'delivery_auto_confirmed',
    jsonb_build_object(
      'freight_id', f.id,
      'auto_confirmed_at', now()
    )
  FROM freights f
  WHERE f.status = 'DELIVERED' 
    AND f.metadata->>'auto_confirmed_at' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE user_id = f.producer_id 
        AND type = 'delivery_auto_confirmed'
        AND data->>'freight_id' = f.id::text
    );
END;
$$;