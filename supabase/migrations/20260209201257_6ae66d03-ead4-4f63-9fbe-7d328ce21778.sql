-- Remove old constraint and add new one allowing total cargo weight up to 10,000 tons
-- The weight field represents the TOTAL cargo weight the user wants to transport,
-- which will be distributed across multiple trucks (required_trucks field)
ALTER TABLE public.freights DROP CONSTRAINT IF EXISTS check_weight_realistic;
ALTER TABLE public.freights ADD CONSTRAINT check_weight_realistic 
  CHECK (weight >= 100 AND weight <= 10000000);