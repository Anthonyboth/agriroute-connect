-- =====================================================
-- FIX: Permitir que produtores vejam fotos de veículos 
-- dos motoristas que estão transportando seus fretes
-- =====================================================

-- Adicionar política de SELECT para participantes de frete na vehicle_photo_history
CREATE POLICY "vehicle_photos_select_freight_participants"
ON public.vehicle_photo_history
FOR SELECT
USING (
  vehicle_id IN (
    SELECT v.id 
    FROM vehicles v
    WHERE can_view_vehicle_via_freight(v.driver_id)
  )
);

-- Comentário explicativo
COMMENT ON POLICY "vehicle_photos_select_freight_participants" ON public.vehicle_photo_history IS
'Permite que produtores e motoristas participantes de um frete visualizem as fotos dos veículos envolvidos no transporte.';