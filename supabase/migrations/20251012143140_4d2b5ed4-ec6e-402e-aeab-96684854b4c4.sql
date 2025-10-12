-- Backfill existing service request city/state data to ensure CITY_MATCH works
UPDATE public.service_requests 
SET 
  city_name = COALESCE(city_name, location_city),
  state = COALESCE(state, location_state)
WHERE (city_name IS NULL OR state IS NULL);