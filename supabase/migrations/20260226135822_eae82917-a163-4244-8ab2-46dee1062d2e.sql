
-- Add all 48 missing cities to the provider's user_cities
INSERT INTO public.user_cities (user_id, city_id, type, is_active, radius_km)
SELECT 
  '23a52846-412a-443a-b3d3-2add856c1360',
  sr.city_id,
  'PRESTADOR_SERVICO',
  true,
  50
FROM (
  SELECT DISTINCT city_id
  FROM service_requests
  WHERE status = 'OPEN' AND provider_id IS NULL AND city_id IS NOT NULL
) sr
WHERE NOT EXISTS (
  SELECT 1 FROM user_cities uc
  WHERE uc.user_id = '23a52846-412a-443a-b3d3-2add856c1360'
    AND uc.city_id = sr.city_id
    AND uc.is_active = true
);
