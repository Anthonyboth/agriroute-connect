-- Add metadata column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;

-- Add index for better performance on metadata queries
CREATE INDEX idx_profiles_metadata ON public.profiles USING gin (metadata);

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.metadata IS 'Additional structured data including plate photos, vehicle registration status, and terms acceptance';