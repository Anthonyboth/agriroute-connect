
-- Update the existing driver UPDATE policy to include TRANSPORTE_PET and ENTREGA_PACOTES
DROP POLICY IF EXISTS "Drivers can accept open transport requests" ON public.service_requests;

CREATE POLICY "Drivers can accept open transport requests"
ON public.service_requests
FOR UPDATE
USING (
  service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO', 'TRANSPORTE_PET', 'ENTREGA_PACOTES'])
  AND status = 'OPEN'
  AND provider_id IS NULL
)
WITH CHECK (
  service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO', 'TRANSPORTE_PET', 'ENTREGA_PACOTES'])
  AND provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
);
