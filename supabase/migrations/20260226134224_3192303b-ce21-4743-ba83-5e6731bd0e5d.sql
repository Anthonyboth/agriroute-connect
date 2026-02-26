
-- Fix: Drivers can view their accepted transport requests was missing TRANSPORTE_PET and ENTREGA_PACOTES
DROP POLICY IF EXISTS "Drivers can view their accepted transport requests" ON public.service_requests;

CREATE POLICY "Drivers can view their accepted transport requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  service_type = ANY (ARRAY[
    'GUINCHO'::text, 'MUDANCA'::text, 'FRETE_MOTO'::text, 
    'FRETE_URBANO'::text, 'TRANSPORTE_PET'::text, 'ENTREGA_PACOTES'::text
  ])
  AND provider_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
);
