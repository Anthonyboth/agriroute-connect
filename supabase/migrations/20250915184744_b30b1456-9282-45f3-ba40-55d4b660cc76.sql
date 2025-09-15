-- Permitir que motoristas deletem seus próprios veículos (RLS)
CREATE POLICY IF NOT EXISTS "Drivers can delete their own vehicles"
ON public.vehicles
FOR DELETE
USING (
  driver_id IN (
    SELECT profiles.id FROM public.profiles WHERE profiles.user_id = auth.uid()
  )
);
