-- Force cleanup: cancel the orphaned assignment, recalc trigger will handle the rest
UPDATE public.freight_assignments 
SET status = 'CANCELLED', updated_at = now() 
WHERE freight_id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06' 
AND driver_id = 'a22b811e-9ff1-435e-97bf-8d35c079d7ab'
AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'DELIVERED');

-- Also clean up trip progress
DELETE FROM public.driver_trip_progress
WHERE freight_id = '697ac9a7-14d1-437f-9fb8-73fbe2744c06'
AND driver_id = 'a22b811e-9ff1-435e-97bf-8d35c079d7ab';