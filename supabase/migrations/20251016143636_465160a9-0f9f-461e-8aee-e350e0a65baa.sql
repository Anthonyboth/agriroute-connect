-- Criar função segura para atualização de status de frete pelo motorista
CREATE OR REPLACE FUNCTION public.driver_update_freight_status(
  p_freight_id uuid,
  p_new_status freight_status,
  p_notes text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_has_permission boolean := false;
  v_freight_record RECORD;
BEGIN
  -- Obter profile_id do usuário autenticado
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Perfil não encontrado');
  END IF;
  
  -- Buscar informações do frete
  SELECT * INTO v_freight_record
  FROM freights
  WHERE id = p_freight_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Frete não encontrado');
  END IF;
  
  -- Verificar permissão: é dono do frete OU tem assignment ativo
  IF v_freight_record.driver_id = v_profile_id THEN
    v_has_permission := true;
  ELSIF EXISTS (
    SELECT 1 FROM freight_assignments
    WHERE freight_id = p_freight_id
    AND driver_id = v_profile_id
    AND status IN ('ACCEPTED', 'IN_PROGRESS', 'LOADING', 'LOADED', 'IN_TRANSIT')
  ) THEN
    v_has_permission := true;
  END IF;
  
  IF NOT v_has_permission THEN
    RETURN json_build_object('ok', false, 'error', 'Você não tem permissão para atualizar este frete');
  END IF;
  
  -- Atualizar status do frete
  UPDATE freights
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_freight_id;
  
  -- Inserir histórico de status
  INSERT INTO freight_status_history (
    freight_id,
    status,
    changed_by,
    notes,
    location_lat,
    location_lng
  ) VALUES (
    p_freight_id,
    p_new_status,
    v_profile_id,
    p_notes,
    p_lat,
    p_lng
  );
  
  RETURN json_build_object('ok', true, 'status', p_new_status);
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;