-- =============================================================================
-- CORREÇÃO: Política RLS para atualização de localização em freights
-- Problema: driver_id é profile_id, mas auth.uid() retorna user_id
-- =============================================================================

-- Remover política antiga com comparação incorreta
DROP POLICY IF EXISTS "freights_update_status_parties" ON freights;

-- Criar política corrigida usando profile_id corretamente
CREATE POLICY "freights_update_status_parties" ON freights
FOR UPDATE USING (
  -- Motorista pode atualizar (comparando driver_id com profile_id do usuário logado)
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  -- Produtor pode atualizar (comparando producer_id com profile_id do usuário logado)
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Política para motoristas afiliados (via freight_assignments) atualizarem localização
CREATE POLICY "affiliated_driver_update_freight_location" ON freights
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM freight_assignments fa
    JOIN profiles p ON p.id = fa.driver_id
    WHERE fa.freight_id = freights.id
    AND p.user_id = auth.uid()
    AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM freight_assignments fa
    JOIN profiles p ON p.id = fa.driver_id
    WHERE fa.freight_id = freights.id
    AND p.user_id = auth.uid()
  )
);