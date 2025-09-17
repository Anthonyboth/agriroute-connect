-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.freight_proposals ENABLE ROW LEVEL SECURITY;

-- Allow drivers to update their own proposals (needed for UPSERT conflict path)
CREATE POLICY IF NOT EXISTS "Drivers can update their own proposals"
ON public.freight_proposals
FOR UPDATE
USING (
  driver_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'MOTORISTA'
  )
)
WITH CHECK (
  driver_id IN (
    SELECT p.id FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'MOTORISTA'
  )
);
