-- ============================================================
-- CORREÇÃO: Expandir RLS de driver_current_locations para que 
-- QUALQUER participante de um frete possa ver a localização
-- do motorista atribuído a esse frete
-- ============================================================

-- Primeiro, dropar a policy existente que é muito restritiva
DROP POLICY IF EXISTS "driver_current_locations_freight_participant" ON driver_current_locations;

-- Recriar com lógica mais abrangente:
-- - Produtores podem ver motoristas dos seus fretes
-- - Transportadoras podem ver motoristas de fretes onde company_id = sua empresa
-- - Motoristas podem ver outros motoristas do mesmo frete (multi-carreta)
CREATE POLICY "driver_current_locations_freight_participant" 
ON driver_current_locations
FOR SELECT
TO authenticated
USING (
  -- Caso 1: Produtor vendo motorista do seu frete
  EXISTS (
    SELECT 1 FROM freights f
    JOIN profiles producer ON producer.id = f.producer_id
    WHERE producer.user_id = auth.uid()
    AND (
      -- Frete com status ativo e motorista atribuído
      (f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
       AND (f.driver_id = driver_current_locations.driver_profile_id 
            OR driver_current_locations.driver_profile_id = ANY(f.drivers_assigned)))
      OR
      -- Frete OPEN com assignment ativo
      (EXISTS (
        SELECT 1 FROM freight_assignments fa
        WHERE fa.freight_id = f.id
        AND fa.driver_id = driver_current_locations.driver_profile_id
        AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      ))
    )
  )
  OR
  -- Caso 2: Transportadora vendo motorista de frete da empresa
  EXISTS (
    SELECT 1 FROM freights f
    JOIN transport_companies tc ON tc.id = f.company_id
    JOIN profiles company_owner ON company_owner.id = tc.profile_id
    WHERE company_owner.user_id = auth.uid()
    AND (
      f.driver_id = driver_current_locations.driver_profile_id 
      OR driver_current_locations.driver_profile_id = ANY(f.drivers_assigned)
      OR EXISTS (
        SELECT 1 FROM freight_assignments fa
        WHERE fa.freight_id = f.id
        AND fa.driver_id = driver_current_locations.driver_profile_id
        AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      )
    )
    AND f.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
  )
  OR
  -- Caso 3: Motorista vendo outro motorista do mesmo frete (multi-carreta)
  EXISTS (
    SELECT 1 FROM freight_assignments fa
    JOIN profiles driver ON driver.user_id = auth.uid()
    WHERE fa.driver_id = driver.id
    AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
    AND EXISTS (
      SELECT 1 FROM freight_assignments fa2
      WHERE fa2.freight_id = fa.freight_id
      AND fa2.driver_id = driver_current_locations.driver_profile_id
      AND fa2.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
    )
  )
);