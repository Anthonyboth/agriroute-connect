-- Restore the marketplace policy with security fix for guest contact data
CREATE POLICY "marketplace_view_safe"
ON public.freights
FOR SELECT
TO authenticated
USING (
  company_id IS NULL 
  AND status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION')
  AND (
    -- Non-guest freights can be browsed in marketplace
    is_guest_freight = FALSE
    OR
    -- Guest freights: only assigned driver can see (prevents exposing contact data)
    driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);