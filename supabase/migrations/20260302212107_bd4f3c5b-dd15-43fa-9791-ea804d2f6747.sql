
-- Fix 1: Add GPS coordinates to cities missing them
UPDATE public.cities SET lat = -15.5453, lng = -55.1626 WHERE id = 'aa460676-1d17-4601-a5b1-fb1c7182005c' AND name = 'Campo Verde' AND state = 'MT';
UPDATE public.cities SET lat = -16.4708, lng = -54.6356 WHERE id = 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d' AND name = 'Rondonópolis' AND state = 'MT';
UPDATE public.cities SET lat = -13.5434, lng = -58.8136 WHERE id = '22f489fa-2fe0-4044-81c2-7c8b6c2db3eb' AND name = 'Sapezal' AND state = 'MT';

-- Fix 2: Correct origin_city_id for freights that say "Campo Verde" but point to wrong city IDs
UPDATE public.freights 
SET origin_city_id = 'aa460676-1d17-4601-a5b1-fb1c7182005c'
WHERE origin_city = 'Campo Verde' 
  AND origin_city_id != 'aa460676-1d17-4601-a5b1-fb1c7182005c'
  AND status = 'OPEN';
