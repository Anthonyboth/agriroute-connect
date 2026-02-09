
CREATE OR REPLACE FUNCTION public.update_producer_service_request(
  p_request_id UUID,
  p_problem_description TEXT DEFAULT NULL,
  p_urgency TEXT DEFAULT NULL,
  p_location_address TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_additional_info TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_current_profile_id UUID;
  v_status TEXT;
  v_rows_affected INTEGER;
BEGIN
  v_current_profile_id := current_profile_id();
  
  IF v_current_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado ou perfil não encontrado');
  END IF;

  SELECT client_id, status INTO v_client_id, v_status
  FROM service_requests
  WHERE id = p_request_id;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de serviço não encontrada');
  END IF;

  IF v_client_id != v_current_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você não é o dono desta solicitação',
      'debug_info', jsonb_build_object('client_id', v_client_id, 'current_profile_id', v_current_profile_id));
  END IF;

  IF v_status NOT IN ('OPEN', 'ABERTO') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas solicitações em aberto podem ser editadas');
  END IF;

  UPDATE service_requests
  SET
    problem_description = COALESCE(p_problem_description, problem_description),
    urgency = COALESCE(p_urgency, urgency),
    location_address = COALESCE(p_location_address, location_address),
    contact_name = COALESCE(p_contact_name, contact_name),
    contact_phone = COALESCE(p_contact_phone, contact_phone),
    contact_email = COALESCE(p_contact_email, contact_email),
    additional_info = COALESCE(p_additional_info, additional_info),
    updated_at = now()
  WHERE id = p_request_id;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma alteração foi realizada');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Solicitação atualizada com sucesso', 'rows_affected', v_rows_affected);
END;
$$;
