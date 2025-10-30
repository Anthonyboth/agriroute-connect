-- Migration: RLS Policy for Freights UPDATE
-- Creates/refreshes UPDATE policy that allows updates when auth.uid() equals driver_id OR producer_id
-- No dependency on profiles.company_id

-- Ensure RLS is enabled on freights table
ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;

-- Drop existing UPDATE policy if it exists (to replace with our new one)
DROP POLICY IF EXISTS freights_update_status_parties ON public.freights;

-- Create UPDATE policy allowing driver and producer to update their freights
-- This policy specifically targets status updates by the involved parties
CREATE POLICY freights_update_status_parties
ON public.freights
FOR UPDATE
USING (
  -- User must be either the driver or the producer
  auth.uid() = driver_id OR auth.uid() = producer_id
)
WITH CHECK (
  -- Same check for the new values
  auth.uid() = driver_id OR auth.uid() = producer_id
);

COMMENT ON POLICY freights_update_status_parties ON public.freights IS
'Allows freight updates when the authenticated user is either the driver (driver_id) or producer (producer_id). No dependency on profiles.company_id.';

-- Note: Other existing policies (SELECT, INSERT, etc.) remain unchanged
-- This policy works alongside existing policies to control UPDATE operations

-- Notify PostgREST to reload schema and recognize policy changes
SELECT pg_notify('pgrst', 'reload schema');
