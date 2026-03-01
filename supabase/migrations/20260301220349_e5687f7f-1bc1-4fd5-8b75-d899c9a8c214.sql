-- Fix: Remove open-access clause that exposes proposals to all authenticated users
-- Providers should only see their OWN proposals, not competitors' proposals

DROP POLICY IF EXISTS srp_select_participants ON service_request_proposals;

CREATE POLICY srp_select_participants ON service_request_proposals
  FOR SELECT
  USING (
    proposer_id = (SELECT get_my_profile_id())
    OR
    EXISTS (
      SELECT 1 FROM service_requests sr
      WHERE sr.id = service_request_proposals.service_request_id
      AND (
        sr.client_id = (SELECT get_my_profile_id())
        OR sr.provider_id = (SELECT get_my_profile_id())
      )
    )
  );