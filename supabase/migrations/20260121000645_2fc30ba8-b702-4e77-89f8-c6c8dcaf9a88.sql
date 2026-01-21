-- Corrigir policy que exclui FRETE_MOTO do aceite por motoristas
-- Drop a policy antiga
DROP POLICY IF EXISTS "Drivers can accept open transport requests" ON service_requests;

-- Criar nova policy incluindo FRETE_MOTO e FRETE_URBANO
CREATE POLICY "Drivers can accept open transport requests" 
ON service_requests 
FOR UPDATE
USING (
  service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO']::text[])
  AND status = 'OPEN'
  AND provider_id IS NULL
)
WITH CHECK (
  service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO']::text[])
  AND provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Também atualizar a policy de SELECT para visualizar FRETE_MOTO aceitos
DROP POLICY IF EXISTS "Drivers can view their accepted transport requests" ON service_requests;

CREATE POLICY "Drivers can view their accepted transport requests"
ON service_requests
FOR SELECT
USING (
  service_type = ANY (ARRAY['GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO']::text[])
  AND provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
);