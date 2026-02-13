
-- Create service_request_proposals table for price negotiation on services
CREATE TABLE public.service_request_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES public.profiles(id),
  proposer_role TEXT NOT NULL CHECK (proposer_role IN ('CLIENT', 'PROVIDER')),
  proposed_price NUMERIC NOT NULL CHECK (proposed_price > 0),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  responded_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_srp_service_request_id ON public.service_request_proposals(service_request_id);
CREATE INDEX idx_srp_proposer_id ON public.service_request_proposals(proposer_id);
CREATE INDEX idx_srp_status ON public.service_request_proposals(status);

-- Enable RLS
ALTER TABLE public.service_request_proposals ENABLE ROW LEVEL SECURITY;

-- Policy: Participants can view proposals for their service requests
CREATE POLICY "srp_select_participants" ON public.service_request_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_requests sr
      WHERE sr.id = service_request_id
      AND (
        sr.client_id = (SELECT get_my_profile_id())
        OR sr.provider_id = (SELECT get_my_profile_id())
        OR proposer_id = (SELECT get_my_profile_id())
      )
    )
  );

-- Policy: Authenticated users can insert proposals (for services they participate in)
CREATE POLICY "srp_insert_own" ON public.service_request_proposals
  FOR INSERT WITH CHECK (
    proposer_id = (SELECT get_my_profile_id())
    AND EXISTS (
      SELECT 1 FROM service_requests sr
      WHERE sr.id = service_request_id
      AND sr.status IN ('OPEN', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
    )
  );

-- Policy: Proposer can update own proposals (cancel)
CREATE POLICY "srp_update_own" ON public.service_request_proposals
  FOR UPDATE USING (
    proposer_id = (SELECT get_my_profile_id())
    OR EXISTS (
      SELECT 1 FROM service_requests sr
      WHERE sr.id = service_request_id
      AND (
        sr.client_id = (SELECT get_my_profile_id())
        OR sr.provider_id = (SELECT get_my_profile_id())
      )
    )
  );

-- RPC: Reject a service proposal and optionally return service to OPEN
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
  v_service_request RECORD;
BEGIN
  -- Get current user's profile id
  v_my_profile_id := get_my_profile_id();
  IF v_my_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Get proposal details
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

  -- Verify user is a participant (not the proposer)
  IF v_my_profile_id = v_proposal.proposer_id THEN
    RETURN json_build_object('success', false, 'error', 'Você não pode rejeitar sua própria proposta');
  END IF;

  IF v_my_profile_id != v_proposal.client_id AND v_my_profile_id != v_proposal.provider_id THEN
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

-- RPC: Accept a service proposal (updates estimated_price)
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

  SELECT srp.*, sr.client_id, sr.provider_id
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

  -- Verify user is the other party (not the proposer)
  IF v_my_profile_id = v_proposal.proposer_id THEN
    RETURN json_build_object('success', false, 'error', 'Você não pode aceitar sua própria proposta');
  END IF;

  IF v_my_profile_id != v_proposal.client_id AND v_my_profile_id != v_proposal.provider_id THEN
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

-- Trigger for updated_at
CREATE TRIGGER update_service_request_proposals_updated_at
  BEFORE UPDATE ON public.service_request_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
