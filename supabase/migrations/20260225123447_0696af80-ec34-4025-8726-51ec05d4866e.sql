
-- Fix: Remove manual accepted_trucks increment from assign_freight_to_affiliated_driver
-- The trigger recalc_accepted_trucks on freight_assignments already handles this.
-- Having both causes a DOUBLE increment violating freights_accepted_trucks_within_required constraint.

CREATE OR REPLACE FUNCTION public.assign_freight_to_affiliated_driver(
  p_freight_id UUID,
  p_driver_profile_id UUID,
  p_proposed_price NUMERIC,
  p_message TEXT DEFAULT ''
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
  v_freight_price NUMERIC;
  v_distance_km NUMERIC;
  v_min_antt NUMERIC;
  v_assignment_id UUID;
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

  -- 4) Verificar se o frete está disponível e tem vagas (with row lock to prevent race conditions)
  SELECT status::text, accepted_trucks, required_trucks, price, distance_km, minimum_antt_price
  INTO v_freight_status, v_accepted_trucks, v_required_trucks, v_freight_price, v_distance_km, v_min_antt
  FROM freights
  WHERE id = p_freight_id
  FOR UPDATE;

  IF v_freight_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Frete não encontrado');
  END IF;

  -- Permitir OPEN, IN_NEGOTIATION e ACCEPTED (multi-truck com vagas)
  IF v_freight_status NOT IN ('OPEN', 'IN_NEGOTIATION', 'ACCEPTED') THEN
    RETURN json_build_object('success', false, 'error', 'Frete não está disponível (status: ' || v_freight_status || ')');
  END IF;

  IF COALESCE(v_accepted_trucks, 0) >= COALESCE(v_required_trucks, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Todas as vagas deste frete já foram preenchidas');
  END IF;

  -- 5) Verificar se já existe assignment ativo deste motorista para este frete
  IF EXISTS (
    SELECT 1 FROM freight_assignments
    WHERE freight_id = p_freight_id AND driver_id = p_driver_profile_id
      AND status NOT IN ('CANCELLED', 'REJECTED')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Este motorista já está atribuído a este frete');
  END IF;

  -- 6) Criar freight_assignment diretamente (atribuição imediata pela transportadora)
  --    O trigger recalc_accepted_trucks será disparado automaticamente pelo INSERT
  --    e cuidará de: accepted_trucks, drivers_assigned, is_full_booking e status
  INSERT INTO freight_assignments (
    freight_id, driver_id, agreed_price, pricing_type, 
    minimum_antt_price, status, accepted_at, company_id
  )
  VALUES (
    p_freight_id, p_driver_profile_id, p_proposed_price, 'FIXED',
    COALESCE(v_min_antt, 0), 'ACCEPTED', now(), v_company_id
  )
  RETURNING id INTO v_assignment_id;

  -- 7) NÃO incrementar accepted_trucks manualmente!
  --    O trigger recalc_accepted_trucks já fez isso no INSERT acima.
  --    O incremento manual duplicado causava violação da constraint
  --    freights_accepted_trucks_within_required.

  -- 8) Se o trigger não mudou o status (ex: frete ACCEPTED multi-truck),
  --    garantir que o status esteja correto
  IF (COALESCE(v_accepted_trucks, 0) + 1) >= COALESCE(v_required_trucks, 1) THEN
    UPDATE freights
    SET status = 'ACCEPTED',
        driver_id = p_driver_profile_id,
        updated_at = now()
    WHERE id = p_freight_id
      AND status IN ('OPEN', 'IN_NEGOTIATION');
  END IF;

  -- 9) Criar proposta para registro/histórico
  INSERT INTO freight_proposals (freight_id, driver_id, proposed_price, status, message)
  VALUES (p_freight_id, p_driver_profile_id, p_proposed_price, 'ACCEPTED', p_message)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'success', true, 
    'message', 'Motorista atribuído ao frete com sucesso',
    'assignment_id', v_assignment_id
  );
END;
$$;

-- Also fix any freights with incorrect accepted_trucks counts (data repair)
UPDATE freights f
SET 
  accepted_trucks = sub.actual_count,
  updated_at = now()
FROM (
  SELECT fa.freight_id, COUNT(*) as actual_count
  FROM freight_assignments fa
  WHERE fa.status NOT IN ('CANCELLED', 'REJECTED')
  GROUP BY fa.freight_id
) sub
WHERE f.id = sub.freight_id
  AND f.accepted_trucks != sub.actual_count;

-- Reset freights with no assignments but accepted_trucks > 0
UPDATE freights
SET accepted_trucks = 0, updated_at = now()
WHERE accepted_trucks > 0
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments fa
    WHERE fa.freight_id = freights.id
      AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  );
