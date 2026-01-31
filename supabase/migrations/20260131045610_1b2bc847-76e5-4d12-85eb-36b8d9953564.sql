-- Fix: Adicionar políticas RLS para INSERT/UPDATE na tabela driver_current_locations
-- Permitir que motoristas insiram/atualizem sua própria localização

-- Política para motoristas inserirem/atualizarem sua própria localização
CREATE POLICY "driver_current_locations_insert_own"
ON public.driver_current_locations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = driver_profile_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "driver_current_locations_update_own"
ON public.driver_current_locations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = driver_current_locations.driver_profile_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = driver_profile_id
    AND p.user_id = auth.uid()
  )
);

-- Política para produtores visualizarem localização de motoristas em fretes ativos
CREATE POLICY "driver_current_locations_freight_participant"
ON public.driver_current_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM freights f
    JOIN profiles producer ON producer.id = f.producer_id
    WHERE producer.user_id = auth.uid()
    AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
    AND (
      f.driver_id = driver_current_locations.driver_profile_id
      OR driver_current_locations.driver_profile_id = ANY(f.drivers_assigned)
    )
  )
);