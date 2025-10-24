-- Hard delete the two freights requested by the current driver
BEGIN;

-- Explicitly remove the two freights by ID
DELETE FROM public.freights 
WHERE id IN (
  'c9398688-39ca-43b4-b878-ad3543ec42ce',
  'f7b6ead6-7958-4c65-a874-d7ea56063ee9'
);

COMMIT;