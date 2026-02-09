
-- Add destination columns to service_requests table
ALTER TABLE public.service_requests 
ADD COLUMN IF NOT EXISTS destination_address text,
ADD COLUMN IF NOT EXISTS destination_city text,
ADD COLUMN IF NOT EXISTS destination_state text,
ADD COLUMN IF NOT EXISTS destination_lat double precision,
ADD COLUMN IF NOT EXISTS destination_lng double precision;

-- Create index for destination city lookups
CREATE INDEX IF NOT EXISTS idx_service_requests_destination_city ON public.service_requests(destination_city);
