-- ✅ P0 FIX: RPC para confirmação INDIVIDUAL de entrega (por assignment)
-- Permite que o produtor confirme a entrega de UM motorista específico
-- em fretes multi-carreta

CREATE OR REPLACE FUNCTION confirm_delivery_individual(
  p_assignment_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment RECORD;
  v_freight RECORD;
  v_profile_id uuid;
  v_required_trucks integer;
  v_delivered_count integer;
  v_all_delivered boolean;
BEGIN
  -- Get profile_id for current user
  SELECT id INTO v_profile_id 
  FROM profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;

  -- Fetch assignment
  SELECT fa.*, f.producer_id, f.required_trucks, f.cargo_type
  INTO v_assignment
  FROM freight_assignments fa
  JOIN freights f ON f.id = fa.freight_id
  WHERE fa.id = p_assignment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Atribuição não encontrada');
  END IF;
  
  -- Verify producer owns this freight
  IF v_assignment.producer_id != v_profile_id THEN
    RETURN json_build_object('success', false, 'message', 'Sem permissão para confirmar esta entrega');
  END IF;
  
  -- Verify assignment is pending confirmation
  IF v_assignment.status != 'DELIVERED_PENDING_CONFIRMATION' THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Esta entrega não está aguardando confirmação. Status atual: ' || COALESCE(v_assignment.status, 'desconhecido')
    );
  END IF;
  
  v_required_trucks := COALESCE(v_assignment.required_trucks, 1);
  
  -- Update THIS specific assignment to DELIVERED
  UPDATE freight_assignments
  SET 
    status = 'DELIVERED',
    delivered_at = COALESCE(delivered_at, now()),
    updated_at = now(),
    notes = COALESCE(p_notes, notes),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'confirmed_by_producer_at', now(),
      'confirmed_by_producer_id', v_profile_id
    )
  WHERE id = p_assignment_id;
  
  -- Update driver_trip_progress if exists
  UPDATE driver_trip_progress
  SET 
    current_status = 'DELIVERED',
    updated_at = now()
  WHERE assignment_id = p_assignment_id
    OR (freight_id = v_assignment.freight_id AND driver_id = v_assignment.driver_id);
  
  -- Count total delivered assignments for this freight
  SELECT COUNT(*) INTO v_delivered_count
  FROM freight_assignments
  WHERE freight_id = v_assignment.freight_id
    AND status = 'DELIVERED';
  
  v_all_delivered := (v_delivered_count >= v_required_trucks);
  
  -- Update freight status based on delivery completion
  IF v_all_delivered THEN
    -- All trucks delivered
    UPDATE freights
    SET 
      status = 'DELIVERED',
      updated_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'all_trucks_delivered_at', now(),
        'confirmed_by_producer_id', v_profile_id
      )
    WHERE id = v_assignment.freight_id;
  ELSE
    -- Partial delivery - update metadata but keep status for remaining trucks
    UPDATE freights
    SET 
      updated_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'last_partial_confirmation_at', now(),
        'delivered_trucks', v_delivered_count,
        'remaining_trucks', v_required_trucks - v_delivered_count
      )
    WHERE id = v_assignment.freight_id;
  END IF;
  
  -- Send notification to driver
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    data
  ) VALUES (
    v_assignment.driver_id,
    'Entrega confirmada pelo produtor',
    format('O produtor confirmou a entrega do frete %s.', v_assignment.cargo_type),
    'delivery_confirmed_by_producer',
    jsonb_build_object(
      'freight_id', v_assignment.freight_id,
      'assignment_id', p_assignment_id,
      'confirmed_at', now()
    )
  );
  
  RETURN json_build_object(
    'success', true,
    'message', CASE 
      WHEN v_all_delivered THEN 'Todas as entregas confirmadas!'
      ELSE format('Entrega confirmada! (%s de %s carretas)', v_delivered_count, v_required_trucks)
    END,
    'all_delivered', v_all_delivered,
    'delivered_count', v_delivered_count,
    'required_trucks', v_required_trucks,
    'driver_id', v_assignment.driver_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', 'Erro interno: ' || SQLERRM);
END;
$$;