
-- Fix accept_service_proposal: when CLIENT accepts PROVIDER proposal, 
-- also set provider_id and transition service to ACCEPTED
CREATE OR REPLACE FUNCTION public.accept_service_proposal(
  p_proposal_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_my_profile_id UUID;
BEGIN
  v_my_profile_id := get_my_profile_id();
  IF v_my_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT srp.*, sr.client_id, sr.provider_id, sr.status AS sr_status
  INTO v_proposal
  FROM service_request_proposals srp
  JOIN service_requests sr ON sr.id = srp.service_request_id
  WHERE srp.id = p_proposal_id;

  IF v_proposal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Proposta não encontrada');
  END IF;

  IF v_proposal.status != 'PENDING' THEN
    RETURN json_build_object('success', false, 'error', 'Proposta já foi respondida');
  END IF;

  -- Cannot accept own proposal
  IF v_my_profile_id = v_proposal.proposer_id THEN
    RETURN json_build_object('success', false, 'error', 'Você não pode aceitar sua própria proposta');
  END IF;

  -- Authorization
  IF v_my_profile_id = v_proposal.client_id THEN
    NULL;
  ELSIF v_my_profile_id = v_proposal.provider_id THEN
    NULL;
  ELSIF v_proposal.sr_status = 'OPEN' AND v_proposal.proposer_role = 'CLIENT' THEN
    NULL;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  -- Accept proposal
  UPDATE service_request_proposals
  SET status = 'ACCEPTED',
      responded_at = now(),
      updated_at = now()
  WHERE id = p_proposal_id;

  -- Cancel other pending proposals for same service request
  UPDATE service_request_proposals
  SET status = 'CANCELLED',
      updated_at = now()
  WHERE service_request_id = v_proposal.service_request_id
    AND id != p_proposal_id
    AND status = 'PENDING';

  -- Update the service request's estimated_price
  UPDATE service_requests
  SET estimated_price = v_proposal.proposed_price,
      updated_at = now()
  WHERE id = v_proposal.service_request_id;

  -- ✅ NEW: When CLIENT accepts a PROVIDER's proposal, also assign provider and transition to ACCEPTED
  IF v_my_profile_id = v_proposal.client_id AND v_proposal.proposer_role = 'PROVIDER' THEN
    UPDATE service_requests
    SET provider_id = v_proposal.proposer_id,
        status = 'ACCEPTED',
        accepted_at = now(),
        updated_at = now()
    WHERE id = v_proposal.service_request_id
      AND status = 'OPEN';
  END IF;

  -- ✅ NEW: When PROVIDER accepts a CLIENT's counter-proposal on an already assigned service
  IF v_my_profile_id = v_proposal.provider_id AND v_proposal.proposer_role = 'CLIENT' THEN
    -- Provider is already assigned, just make sure status is correct
    UPDATE service_requests
    SET status = 'ACCEPTED',
        accepted_at = COALESCE(accepted_at, now()),
        updated_at = now()
    WHERE id = v_proposal.service_request_id
      AND status = 'OPEN';
  END IF;

  RETURN json_build_object('success', true, 'message', 'Proposta aceita! Serviço atualizado.');
END;
$$;
