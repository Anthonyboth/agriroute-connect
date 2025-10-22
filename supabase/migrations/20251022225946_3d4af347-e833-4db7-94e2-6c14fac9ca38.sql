-- Enable RLS on freights table (if not already enabled)
ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting INSERT policies
DROP POLICY IF EXISTS "Users can create freights including guests" ON public.freights;
DROP POLICY IF EXISTS "producers_can_insert_freights" ON public.freights;
DROP POLICY IF EXISTS "admins_can_insert_freights" ON public.freights;
DROP POLICY IF EXISTS "guests_can_insert_freights" ON public.freights;

-- Allow authenticated PRODUTOR to create freights
CREATE POLICY "producers_can_insert_freights"
ON public.freights
FOR INSERT
TO authenticated
WITH CHECK (
  producer_id IN (
    SELECT id FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'PRODUTOR'
  )
);

-- Allow ADMIN to create freights
CREATE POLICY "admins_can_insert_freights"
ON public.freights
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  )
);

-- Allow guest freight creation (no authentication required)
CREATE POLICY "guests_can_insert_freights"
ON public.freights
FOR INSERT
TO anon
WITH CHECK (
  is_guest_freight = TRUE
  AND producer_id IS NULL
);