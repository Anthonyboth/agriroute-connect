DROP POLICY IF EXISTS "Authenticated users can insert proposals for open freights" ON freight_proposals;

CREATE POLICY "Authenticated users can insert proposals for open freights"
ON freight_proposals
FOR INSERT
TO authenticated
WITH CHECK (
  driver_id = get_my_profile_id()
  AND (
    has_role(auth.uid(), 'driver'::app_role)
    OR has_role(auth.uid(), 'affiliated_driver'::app_role)
    OR has_role(auth.uid(), 'carrier'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM freights f
    WHERE f.id = freight_proposals.freight_id
      AND f.producer_id IS NOT NULL
      AND COALESCE(f.is_guest_freight, false) = false
      AND f.status IN ('OPEN'::freight_status, 'IN_NEGOTIATION'::freight_status)
      AND f.accepted_trucks < f.required_trucks
  )
);