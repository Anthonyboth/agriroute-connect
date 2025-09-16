-- Create table for guest/public service requests (no login required)
CREATE TABLE IF NOT EXISTS public.guest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('GUINCHO','SERVICE')),
  service_type TEXT,
  provider_id UUID NULL,
  contact_name TEXT,
  contact_phone TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon or authenticated) to create guest requests
CREATE POLICY "Public can create guest requests"
ON public.guest_requests
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Optional: Allow authenticated admins or assigned providers to view guest requests
-- (kept minimal and safe; current UI doesn't read this table yet)
CREATE POLICY "Admins or assigned provider can read guest requests"
ON public.guest_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.role = 'ADMIN' OR p.id = guest_requests.provider_id)
  )
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_guest_requests_created_at ON public.guest_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_requests_provider ON public.guest_requests (provider_id);
