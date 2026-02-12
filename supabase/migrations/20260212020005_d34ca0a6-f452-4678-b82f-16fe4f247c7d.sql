
-- Fix service_matches check constraint to accept CITY_MATCH and SPATIAL_RADIUS
ALTER TABLE public.service_matches DROP CONSTRAINT IF EXISTS service_matches_match_type_check;

ALTER TABLE public.service_matches ADD CONSTRAINT service_matches_match_type_check 
CHECK (match_type IN ('LOCATION', 'SERVICE_TYPE', 'BOTH', 'CITY_MATCH', 'SPATIAL_RADIUS'));
