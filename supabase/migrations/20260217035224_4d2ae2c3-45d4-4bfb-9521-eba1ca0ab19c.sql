
-- Allow producers to update freight_proposals status (for counter-proposals)
CREATE POLICY "Producers can update proposal status for counter-proposals"
ON public.freight_proposals
FOR UPDATE
TO authenticated
USING (
  freight_id IN (
    SELECT f.id FROM public.freights f
    WHERE f.producer_id = get_current_profile_id()
  )
)
WITH CHECK (
  freight_id IN (
    SELECT f.id FROM public.freights f
    WHERE f.producer_id = get_current_profile_id()
  )
);
