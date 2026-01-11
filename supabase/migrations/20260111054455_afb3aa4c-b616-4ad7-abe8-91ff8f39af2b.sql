-- Corrigir policies permissivas em freight_stops
-- Estas policies eram muito abertas (USING true / WITH CHECK true)

-- Primeiro, remover policies existentes
DROP POLICY IF EXISTS "System inserts stops" ON freight_stops;
DROP POLICY IF EXISTS "System updates stops" ON freight_stops;

-- Criar policy de INSERT mais restritiva
-- Permite inserção apenas pelo motorista do frete ou admins
CREATE POLICY "freight_stops_insert_by_driver_or_system" ON freight_stops
FOR INSERT WITH CHECK (
  -- Motorista pode inserir paradas no seu próprio frete
  EXISTS (
    SELECT 1 FROM freights f 
    WHERE f.id = freight_id 
    AND f.driver_id = auth.uid()
  )
  -- Ou é um admin
  OR public.has_role(auth.uid(), 'admin')
  -- Ou inserção via service role (edge functions)
  OR auth.uid() IS NULL
);

-- Criar policy de UPDATE mais restritiva
-- Permite atualização pelo produtor, motorista ou admin
CREATE POLICY "freight_stops_update_by_participant" ON freight_stops
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM freights f 
    WHERE f.id = freight_id 
    AND (
      f.producer_id = auth.uid() 
      OR f.driver_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);