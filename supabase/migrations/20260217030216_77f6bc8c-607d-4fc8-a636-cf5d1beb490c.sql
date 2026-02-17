-- Add pricing metadata to freight_proposals so we can display the unit value
ALTER TABLE public.freight_proposals 
ADD COLUMN IF NOT EXISTS proposal_pricing_type TEXT DEFAULT 'FIXED',
ADD COLUMN IF NOT EXISTS proposal_unit_price NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN public.freight_proposals.proposal_pricing_type IS 'FIXED, PER_KM, or PER_TON - the pricing type the driver chose';
COMMENT ON COLUMN public.freight_proposals.proposal_unit_price IS 'The unit value entered by driver (e.g. R$/km or R$/ton). For FIXED, same as proposed_price.';