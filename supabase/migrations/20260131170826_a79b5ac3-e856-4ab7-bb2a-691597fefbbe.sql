-- ============================================================================
-- CORREÇÃO: RLS de driver_current_locations para fretes OPEN com assignments ativos
-- ============================================================================
-- O problema: produtores não conseguem ver localização em fretes multi-carreta
-- porque o status do frete é 'OPEN', mas há motoristas atribuídos com status
-- 'ACCEPTED', 'LOADING', 'LOADED', ou 'IN_TRANSIT' em freight_assignments.
-- ============================================================================

-- Dropar a política existente para recriar com lógica corrigida
DROP POLICY IF EXISTS "driver_current_locations_freight_participant" ON driver_current_locations;

-- ✅ Nova política que inclui fretes OPEN com assignments ativos
CREATE POLICY "driver_current_locations_freight_participant"
ON driver_current_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM freights f
    JOIN profiles producer ON producer.id = f.producer_id
    WHERE producer.user_id = auth.uid()
    AND (
      -- Caso 1: Frete com status ativo E motorista é o driver_id ou está em drivers_assigned
      (
        f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
        AND (
          f.driver_id = driver_current_locations.driver_profile_id
          OR driver_current_locations.driver_profile_id = ANY(f.drivers_assigned)
        )
      )
      -- Caso 2: Frete OPEN mas com assignment ativo para este motorista
      OR (
        f.status = 'OPEN'
        AND EXISTS (
          SELECT 1 FROM freight_assignments fa
          WHERE fa.freight_id = f.id
          AND fa.driver_id = driver_current_locations.driver_profile_id
          AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
        )
      )
      -- Caso 3: Qualquer frete com assignment ativo para este motorista
      OR EXISTS (
        SELECT 1 FROM freight_assignments fa
        WHERE fa.freight_id = f.id
        AND fa.driver_id = driver_current_locations.driver_profile_id
        AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      )
    )
  )
);