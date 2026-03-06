ALTER TABLE public.external_payments 
ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_reason TEXT;

NOTIFY pgrst, 'reload schema';