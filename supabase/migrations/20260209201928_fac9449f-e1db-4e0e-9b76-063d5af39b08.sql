-- Remove ALL max weight limit - producers can have any amount of cargo
ALTER TABLE public.freights DROP CONSTRAINT IF EXISTS check_weight_realistic;
ALTER TABLE public.freights ADD CONSTRAINT check_weight_realistic 
  CHECK (weight >= 100);