-- Migration: Sync profiles.service_cities to user_cities for providers
-- Purpose: Unify city management system for service providers

-- Step 1: Insert/update user_cities records from existing profiles.service_cities
INSERT INTO public.user_cities (user_id, city_id, type, radius_km, is_active)
SELECT 
  p.user_id,
  c.id as city_id,
  'PRESTADOR_SERVICO'::user_city_type as type,
  50 as radius_km,
  true as is_active
FROM public.profiles p
CROSS JOIN LATERAL unnest(
  CASE 
    WHEN p.service_cities IS NOT NULL THEN p.service_cities 
    ELSE ARRAY[]::text[]
  END
) AS city_string
JOIN public.cities c ON (
  -- Match by city name and state from service_cities format "City, State"
  LOWER(TRIM(c.name)) = LOWER(TRIM(split_part(city_string, ',', 1)))
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(split_part(city_string, ',', 2)))
)
WHERE 
  p.role = 'PRESTADOR_SERVICOS'
  AND p.service_cities IS NOT NULL
  AND array_length(p.service_cities, 1) > 0
ON CONFLICT (user_id, city_id, type) 
DO UPDATE SET 
  is_active = true,
  radius_km = COALESCE(EXCLUDED.radius_km, user_cities.radius_km),
  updated_at = now();

-- Step 2: Log migration results
DO $$
DECLARE
  synced_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT uc.user_id) INTO synced_count
  FROM public.user_cities uc
  WHERE uc.type = 'PRESTADOR_SERVICO';
  
  RAISE NOTICE 'Migration completed: % service providers synced to user_cities', synced_count;
END $$;