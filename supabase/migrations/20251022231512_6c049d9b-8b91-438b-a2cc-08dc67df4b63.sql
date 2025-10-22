-- Permitir produtores cancelarem seus próprios fretes (antes de IN_TRANSIT)
CREATE POLICY "producers_can_cancel_own_freights"
ON public.freights
FOR UPDATE
TO authenticated
USING (
  -- Produtor é dono do frete
  producer_id IN (
    SELECT id FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'PRODUTOR'
  )
  -- Apenas antes de IN_TRANSIT
  AND status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED')
)
WITH CHECK (
  -- Permite mudança para CANCELLED ou manter outros campos
  status IN ('CANCELLED', 'OPEN', 'ACCEPTED', 'LOADING', 'LOADED')
);

-- Permitir ADMINs cancelarem qualquer frete
CREATE POLICY "admins_can_cancel_freights"
ON public.freights
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'ADMIN'
  )
)
WITH CHECK (true);