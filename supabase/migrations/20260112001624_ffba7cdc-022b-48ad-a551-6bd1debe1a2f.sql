-- Transfer the LOADED freight to the correct producer (Anthony Both Produtor)
UPDATE public.freights 
SET producer_id = '5298f6b3-4ccc-4215-bbea-389ac002e76c',
    updated_at = now()
WHERE id = '9cc36b8c-0ca4-4ac1-a990-24bd00c4a7a2';