-- Atualizar RPC driver_update_freight_status para sincronizar freight_assignments.status
CREATE OR REPLACE FUNCTION driver_update_freight_status(
  p_freight_id uuid,
  p_new_status freight_status,
  p_notes text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
  v_driver_profile_id uuid;
  v_result json;
BEGIN
  -- Buscar perfil do motorista autenticado
  SELECT id INTO v_driver_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_driver_profile_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Perfil não encontrado');
  END IF;

  -- Buscar o frete com lock
  SELECT f.* INTO v_freight
  FROM freights f
  WHERE f.id = p_freight_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Frete não encontrado');
  END IF;

  -- CRÍTICO: Bloquear mudanças se frete já foi confirmado pelo produtor
  IF v_freight.metadata->>'confirmed_by_producer' = 'true' 
     OR v_freight.metadata->>'delivery_confirmed_at' IS NOT NULL THEN
    RETURN json_build_object(
      'ok', false, 
      'error', 'FREIGHT_ALREADY_CONFIRMED',
      'message', 'Este frete já foi entregue e confirmado. Não é possível alterar o status.'
    );
  END IF;

  -- Verificar se o motorista está atribuído ao frete
  IF NOT EXISTS (
    SELECT 1 FROM freight_assignments
    WHERE freight_id = p_freight_id
      AND driver_id = v_driver_profile_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'Você não está atribuído a este frete');
  END IF;

  -- Validar transições de status permitidas (INCLUINDO OPEN)
  IF NOT (
    (v_freight.status = 'ACCEPTED' AND p_new_status IN ('LOADING', 'CANCELLED')) OR
    (v_freight.status = 'LOADING' AND p_new_status IN ('LOADED', 'CANCELLED')) OR
    (v_freight.status = 'LOADED' AND p_new_status IN ('IN_TRANSIT', 'CANCELLED')) OR
    (v_freight.status = 'IN_TRANSIT' AND p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'CANCELLED')) OR
    (v_freight.status = 'OPEN' AND p_new_status IN ('LOADING', 'ACCEPTED')) OR
    (v_freight.status = 'DELIVERED_PENDING_CONFIRMATION' AND p_new_status = 'DELIVERED')
  ) THEN
    RETURN json_build_object(
      'ok', false, 
      'error', 'TRANSITION_NOT_ALLOWED',
      'message', format('Não é possível mudar de %s para %s', v_freight.status, p_new_status),
      'current_status', v_freight.status,
      'attempted_status', p_new_status
    );
  END IF;

  -- Atualizar status do frete
  UPDATE freights
  SET 
    status = p_new_status,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'last_status_update', NOW(),
        'last_status_update_by', v_driver_profile_id,
        'status_notes', p_notes
      )
  WHERE id = p_freight_id;

  -- ✅ NOVO: Sincronizar status do freight_assignment
  UPDATE freight_assignments
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE freight_id = p_freight_id
    AND driver_id = v_driver_profile_id;

  -- Registrar checkin se localização foi fornecida
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    INSERT INTO freight_checkins (
      freight_id,
      user_id,
      checkin_type,
      lat,
      lng,
      observations,
      status
    ) VALUES (
      p_freight_id,
      v_driver_profile_id,
      CASE 
        WHEN p_new_status = 'LOADING' THEN 'PICKUP'
        WHEN p_new_status = 'IN_TRANSIT' THEN 'DEPARTURE'
        WHEN p_new_status = 'DELIVERED_PENDING_CONFIRMATION' THEN 'DELIVERY'
        ELSE 'OTHER'
      END,
      p_lat,
      p_lng,
      p_notes,
      'CONFIRMED'
    );
  END IF;

  -- Log da mudança de status
  INSERT INTO audit_logs (
    user_id,
    table_name,
    operation,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    'freights',
    'STATUS_UPDATE',
    json_build_object('freight_id', p_freight_id, 'old_status', v_freight.status),
    json_build_object('freight_id', p_freight_id, 'new_status', p_new_status)
  );

  RETURN json_build_object(
    'ok', true, 
    'new_status', p_new_status,
    'message', 'Status atualizado com sucesso'
  );
END;
$$;