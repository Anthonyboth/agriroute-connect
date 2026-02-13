
-- Fix RLS SELECT policy: allow providers to see proposals on OPEN services
-- (needed so providers can see client price offers on available services)
DROP POLICY IF EXISTS "srp_select_participants" ON public.service_request_proposals;

CREATE POLICY "srp_select_participants" ON public.service_request_proposals
  FOR SELECT USING (
    -- Proposer can always see their own proposals
    proposer_id = (SELECT get_my_profile_id())
    OR EXISTS (
      SELECT 1 FROM service_requests sr
      WHERE sr.id = service_request_id
      AND (
        -- Client or assigned provider can see
        sr.client_id = (SELECT get_my_profile_id())
        OR sr.provider_id = (SELECT get_my_profile_id())
        -- Any authenticated user can see proposals on OPEN services
        -- (providers need to see client price offers before accepting)
        OR (sr.status = 'OPEN' AND auth.uid() IS NOT NULL)
      )
    )
  );

-- Fix RPC: reject_service_proposal - handle OPEN services where provider_id is NULL
-- A provider who proposed on an OPEN service should allow the client to reject.
-- A client who proposed should allow any potential provider to reject (but only if they have a proposal too).
CREATE OR REPLACE FUNCTION public.reject_service_proposal(
  p_proposal_id UUID,
  p_rejection_reason TEXT DEFAULT NULL,
  p_return_to_open BOOLEAN DEFAULT FALSE
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

  -- Get proposal + service request details
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

  -- Cannot reject own proposal
  IF v_my_profile_id = v_proposal.proposer_id THEN
    RETURN json_build_object('success', false, 'error', 'Você não pode rejeitar sua própria proposta');
  END IF;

  -- Authorization: must be either client, assigned provider, or (for OPEN services) have own proposals
  IF v_my_profile_id = v_proposal.client_id THEN
    -- Client can always reject
    NULL;
  ELSIF v_my_profile_id = v_proposal.provider_id THEN
    -- Assigned provider can reject
    NULL;
  ELSIF v_proposal.sr_status = 'OPEN' AND v_proposal.proposer_role = 'CLIENT' THEN
    -- For OPEN services, any provider with their own proposal can reject a client's proposal
    -- This handles the case where provider_id is NULL
    IF NOT EXISTS (
      SELECT 1 FROM service_request_proposals
      WHERE service_request_id = v_proposal.service_request_id
        AND proposer_id = v_my_profile_id
        AND proposer_role = 'PROVIDER'
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Você não tem permissão para rejeitar esta proposta');
    END IF;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Você não tem permissão para rejeitar esta proposta');
  END IF;

  -- Update proposal status
  UPDATE service_request_proposals
  SET status = 'REJECTED',
      rejection_reason = p_rejection_reason,
      responded_at = now(),
      updated_at = now()
  WHERE id = p_proposal_id;

  -- If requested, return the service to OPEN (provider's proposal was rejected by client)
  IF p_return_to_open AND v_proposal.proposer_role = 'PROVIDER' AND v_proposal.sr_status IN ('ACCEPTED', 'ON_THE_WAY') THEN
    UPDATE service_requests
    SET status = 'OPEN',
        provider_id = NULL,
        accepted_at = NULL,
        cancellation_reason = 'Proposta de valor rejeitada pelo cliente',
        cancelled_at = now(),
        updated_at = now()
    WHERE id = v_proposal.service_request_id;
    
    RETURN json_build_object('success', true, 'message', 'Proposta rejeitada. Serviço voltou a ficar disponível.', 'returned_to_open', true);
  END IF;

  RETURN json_build_object('success', true, 'message', 'Proposta rejeitada.', 'returned_to_open', false);
END;
$$;

-- Fix RPC: accept_service_proposal - handle OPEN services where provider_id is NULL
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
    -- Client can accept provider proposals
    NULL;
  ELSIF v_my_profile_id = v_proposal.provider_id THEN
    -- Assigned provider can accept client proposals
    NULL;
  ELSIF v_proposal.sr_status = 'OPEN' AND v_proposal.proposer_role = 'CLIENT' THEN
    -- For OPEN services, any authenticated user can accept a client's price offer
    -- (they would still need to "Accept Service" separately to become the provider)
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

  RETURN json_build_object('success', true, 'message', 'Proposta aceita! Valor atualizado.');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reject_service_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_service_proposal TO authenticated;
