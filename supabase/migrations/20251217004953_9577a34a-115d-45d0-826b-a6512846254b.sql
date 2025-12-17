-- Add address detail fields for origin and destination
ALTER TABLE freights ADD COLUMN IF NOT EXISTS origin_neighborhood text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS origin_street text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS origin_number text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS origin_complement text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS destination_neighborhood text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS destination_street text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS destination_number text;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS destination_complement text;

-- Add visibility fields
ALTER TABLE freights ADD COLUMN IF NOT EXISTS visibility_type text DEFAULT 'ALL';
ALTER TABLE freights ADD COLUMN IF NOT EXISTS min_driver_rating numeric;

-- Add comment for visibility_type values
COMMENT ON COLUMN freights.visibility_type IS 'ALL, TRANSPORTADORAS_ONLY, RATING_MINIMUM';