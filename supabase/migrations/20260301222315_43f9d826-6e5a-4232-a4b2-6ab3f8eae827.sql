-- Add location columns to company_driver_chats for location sharing
ALTER TABLE public.company_driver_chats
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_address text,
  ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'TEXT';

-- Update existing rows to have message_type = 'TEXT' where NULL
UPDATE public.company_driver_chats
SET message_type = 'TEXT'
WHERE message_type IS NULL;