UPDATE public.service_requests
SET client_id = 'a885f432-99a5-41e9-8b07-f0794ba55af4',
    contact_name = 'Teste Produtor',
    contact_phone = '66996115888'
WHERE status = 'OPEN' AND client_id IS NULL;