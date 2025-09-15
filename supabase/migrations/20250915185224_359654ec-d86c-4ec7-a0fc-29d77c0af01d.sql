-- Adicionar política de DELETE para permitir motoristas removerem seus próprios veículos
CREATE POLICY "Drivers can delete their own vehicles"
ON public.vehicles
FOR DELETE
USING (
  driver_id IN (
    SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()
  )
);