-- Corrigir a policy de visualização de requests OPEN que está bloqueando FRETE_MOTO
DROP POLICY IF EXISTS "Drivers can view open transport requests" ON service_requests;

CREATE POLICY "Drivers can view open transport requests" 
ON service_requests 
FOR SELECT
USING (
  service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO']::text[])
  AND status = 'OPEN'
  AND provider_id IS NULL
);