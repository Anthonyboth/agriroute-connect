
-- Fix: Allow authenticated users to VIEW open transport-type service requests
-- This is the root cause of TRANSPORTE_PET and ENTREGA_PACOTES not showing for transportadoras
CREATE POLICY "authenticated_view_open_transport_requests"
ON public.service_requests
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND status = 'OPEN'
  AND provider_id IS NULL
  AND service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO', 'TRANSPORTE_PET', 'ENTREGA_PACOTES'])
);
