-- Fix dirty freight data left by buggy withdrawal (FRT-015 recurrence)
UPDATE public.freights 
SET accepted_trucks = 0, 
    drivers_assigned = '{}', 
    is_full_booking = false, 
    updated_at = now() 
WHERE id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06' 
  AND status = 'OPEN' 
  AND driver_id IS NULL;