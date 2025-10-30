-- Migration: Update freight_status RPC Functions
-- Creates type-safe RPC functions that check permissions using driver_id/producer_id only
-- No dependency on profiles.company_id

-- ============================================================================
-- Function 1: update_freight_status (typed, enum parameter)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_freight_status(
  p_id UUID,
  p_status public.freight_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status public.freight_status;
  v_producer_id UUID;
  v_driver_id UUID;
  v_user_id UUID;
  v_valid_transition BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- Get current freight data
  SELECT status, producer_id, driver_id
  INTO v_current_status, v_producer_id, v_driver_id
  FROM public.freights
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Frete não encontrado'
    );
  END IF;

  -- Check permissions: user must be driver or producer
  IF v_user_id != v_driver_id AND v_user_id != v_producer_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você não tem permissão para atualizar este frete'
    );
  END IF;

  -- Prevent status changes on final statuses
  IF v_current_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Não é possível alterar status de frete finalizado',
      'current_status', v_current_status::text,
      'attempted_status', p_status::text
    );
  END IF;

  -- Validate transition based on current status
  v_valid_transition := CASE v_current_status
    WHEN 'OPEN' THEN p_status IN ('IN_NEGOTIATION', 'ACCEPTED', 'REJECTED', 'CANCELLED')
    WHEN 'IN_NEGOTIATION' THEN p_status IN ('ACCEPTED', 'REJECTED', 'CANCELLED')
    WHEN 'ACCEPTED' THEN p_status IN ('LOADING', 'CANCELLED')
    WHEN 'LOADING' THEN p_status IN ('LOADED', 'CANCELLED')
    WHEN 'LOADED' THEN p_status IN ('IN_TRANSIT', 'CANCELLED')
    WHEN 'IN_TRANSIT' THEN p_status IN ('DELIVERED_PENDING_CONFIRMATION', 'CANCELLED')
    WHEN 'DELIVERED_PENDING_CONFIRMATION' THEN p_status IN ('DELIVERED', 'COMPLETED')
    WHEN 'DELIVERED' THEN p_status = 'COMPLETED'
    WHEN 'PENDING' THEN p_status IN ('OPEN', 'IN_NEGOTIATION', 'CANCELLED')
    ELSE false
  END;

  IF NOT v_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TRANSITION_NOT_ALLOWED',
      'message', format('Transição de %s para %s não permitida', v_current_status::text, p_status::text),
      'current_status', v_current_status::text,
      'attempted_status', p_status::text
    );
  END IF;

  -- Update freight status
  UPDATE public.freights
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE id = p_id;

  -- Log status change to history
  INSERT INTO public.freight_status_history (
    freight_id,
    status,
    changed_by,
    created_at
  ) VALUES (
    p_id,
    p_status::text,
    v_user_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'freight_id', p_id,
    'new_status', p_status::text,
    'previous_status', v_current_status::text
  );
END;
$$;

COMMENT ON FUNCTION public.update_freight_status(UUID, public.freight_status) IS
'Update freight status with enum type. Checks permissions using driver_id/producer_id only. Validates transitions and prevents changes to final statuses.';

-- ============================================================================
-- Function 2: update_freight_status_text (text parameter, tolerant wrapper)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_freight_status_text(
  p_id UUID,
  p_status_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.freight_status;
BEGIN
  -- Convert text to enum using our conversion function
  -- This handles PT-BR labels and synonyms
  BEGIN
    v_status := public.text_to_freight_status(p_status_text);
  EXCEPTION WHEN OTHERS THEN
    -- Return error if conversion fails
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Status inválido: "%s"', p_status_text),
      'message', 'Use um valor de enum válido ou uma label PT-BR como "Em Trânsito", "Cancelado", etc.'
    );
  END;

  -- Call the typed function
  RETURN public.update_freight_status(p_id, v_status);
END;
$$;

COMMENT ON FUNCTION public.update_freight_status_text(UUID, TEXT) IS
'Tolerant wrapper for update_freight_status that accepts text input. Converts PT-BR labels and synonyms to enum before calling the typed function.';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_freight_status(UUID, public.freight_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_freight_status_text(UUID, TEXT) TO authenticated;

-- Notify PostgREST to reload schema and recognize new RPCs
SELECT pg_notify('pgrst', 'reload schema');
