-- Garantir que usuários anônimos podem criar solicitações guest
DROP POLICY IF EXISTS "Anyone can create guest service requests" ON public.service_requests;

CREATE POLICY "Anyone can create guest service requests"
ON public.service_requests
FOR INSERT
TO anon
WITH CHECK (client_id IS NULL);