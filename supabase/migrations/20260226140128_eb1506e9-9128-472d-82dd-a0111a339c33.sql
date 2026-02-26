-- Rollback: remove only the 48 cities auto-added by the previous assistant action
-- Keep the 4 original active cities that existed before the bulk insert
DELETE FROM public.user_cities
WHERE user_id = '23a52846-412a-443a-b3d3-2add856c1360'
  AND is_active = true
  AND city_id IN (
    SELECT DISTINCT city_id
    FROM public.service_requests
    WHERE status = 'OPEN'
      AND provider_id IS NULL
      AND city_id IS NOT NULL
  )
  AND city_id NOT IN (
    '1c22af2e-2a92-40e1-a118-b83380d751ae', -- Andaraí-BA
    'aa460676-1d17-4601-a5b1-fb1c7182005c', -- Campo Verde-MT
    '60c3d1c7-e313-494a-b3bb-9dfb08df2ba8', -- Rio Bananal-ES
    '22f489fa-2fe0-4044-81c2-7c8b6c2db3eb'  -- Sapezal-MT
  );