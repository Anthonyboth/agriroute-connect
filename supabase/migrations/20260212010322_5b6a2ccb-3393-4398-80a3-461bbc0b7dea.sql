
-- RPC para transportadora atribuir frete rural ao motorista afiliado
CREATE OR REPLACE FUNCTION public.assign_freight_to_affiliated_driver(
  p_freight_id UUID,
  p_driver_profile_id UUID,
  p_proposed_price NUMERIC,
  p_message TEXT DEFAULT 'Proposta enviada pela transportadora'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carrier_profile_id UUID;
  v_company_id UUID;
  v_driver_status TEXT;
  v_freight_status TEXT;
  v_accepted_trucks INT;
  v_required_trucks INT;
  v_result JSON;
BEGIN
  -- 1) Obter profile_id do usuário logado
  SELECT id INTO v_carrier_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_carrier_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil da transportadora não encontrado');
  END IF;

  -- 2) Verificar se o usuário logado é dono de uma transportadora
  SELECT id INTO v_company_id
  FROM transport_companies
  WHERE profile_id = v_carrier_profile_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Você não possui uma transportadora cadastrada');
  END IF;

  -- 3) Verificar se o motorista é afiliado ATIVO à transportadora
  SELECT status INTO v_driver_status
  FROM company_drivers
  WHERE company_id = v_company_id
    AND driver_profile_id = p_driver_profile_id
  LIMIT 1;

  IF v_driver_status IS NULL OR v_driver_status != 'ACTIVE' THEN
    RETURN json_build_object('success', false, 'error', 'Motorista não está ativo na sua transportadora');
  END IF;

  -- 4) Verificar se o frete está aberto e tem vagas
  SELECT status::text, accepted_trucks, required_trucks
  INTO v_freight_status, v_accepted_trucks, v_required_trucks
  FROM freights
  WHERE id = p_freight_id;

  IF v_freight_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Frete não encontrado');
  END IF;

  IF v_freight_status NOT IN ('OPEN', 'IN_NEGOTIATION') THEN
    RETURN json_build_object('success', false, 'error', 'Frete não está disponível (status: ' || v_freight_status || ')');
  END IF;

  IF v_accepted_trucks >= v_required_trucks THEN
    RETURN json_build_object('success', false, 'error', 'Todas as vagas deste frete já foram preenchidas');
  END IF;

  -- 5) Verificar se já existe proposta deste motorista para este frete
  IF EXISTS (
    SELECT 1 FROM freight_proposals
    WHERE freight_id = p_freight_id AND driver_id = p_driver_profile_id
      AND status NOT IN ('REJECTED', 'CANCELLED')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Este motorista já possui uma proposta ativa para este frete');
  END IF;

  -- 6) Inserir a proposta
  INSERT INTO freight_proposals (freight_id, driver_id, proposed_price, status, message)
  VALUES (p_freight_id, p_driver_profile_id, p_proposed_price, 'PENDING', p_message);

  RETURN json_build_object('success', true, 'message', 'Proposta enviada com sucesso');
END;
$$;

-- RPC para transportadora atribuir serviço urbano ao motorista afiliado
CREATE OR REPLACE FUNCTION public.assign_service_to_affiliated_driver(
  p_service_id UUID,
  p_driver_profile_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carrier_profile_id UUID;
  v_company_id UUID;
  v_driver_status TEXT;
  v_service_status TEXT;
  v_service_provider UUID;
BEGIN
  -- 1) Obter profile_id do usuário logado
  SELECT id INTO v_carrier_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_carrier_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Perfil da transportadora não encontrado');
  END IF;

  -- 2) Verificar se é dono de uma transportadora
  SELECT id INTO v_company_id
  FROM transport_companies
  WHERE profile_id = v_carrier_profile_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Você não possui uma transportadora cadastrada');
  END IF;

  -- 3) Verificar se o motorista é afiliado ATIVO
  SELECT status INTO v_driver_status
  FROM company_drivers
  WHERE company_id = v_company_id
    AND driver_profile_id = p_driver_profile_id
  LIMIT 1;

  IF v_driver_status IS NULL OR v_driver_status != 'ACTIVE' THEN
    RETURN json_build_object('success', false, 'error', 'Motorista não está ativo na sua transportadora');
  END IF;

  -- 4) Verificar se o serviço está aberto e sem provider
  SELECT status, provider_id INTO v_service_status, v_service_provider
  FROM service_requests
  WHERE id = p_service_id;

  IF v_service_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Serviço não encontrado');
  END IF;

  IF v_service_status != 'OPEN' THEN
    RETURN json_build_object('success', false, 'error', 'Serviço não está disponível (status: ' || v_service_status || ')');
  END IF;

  IF v_service_provider IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Este serviço já foi atribuído a outro motorista');
  END IF;

  -- 5) Atribuir o serviço
  UPDATE service_requests
  SET provider_id = p_driver_profile_id,
      status = 'ACCEPTED',
      updated_at = now()
  WHERE id = p_service_id;

  RETURN json_build_object('success', true, 'message', 'Serviço atribuído com sucesso');
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION public.assign_freight_to_affiliated_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_service_to_affiliated_driver TO authenticated;
