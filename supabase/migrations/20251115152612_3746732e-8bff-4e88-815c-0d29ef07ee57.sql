-- Permitir que motoristas saiam de transportadoras por conta própria
-- Motorista pode apenas marcar status como INACTIVE e definir left_at

CREATE POLICY "Motoristas podem sair da transportadora"
ON public.company_drivers
FOR UPDATE
TO authenticated
USING (
  -- Motorista pode atualizar seu próprio registro
  driver_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND status = 'ACTIVE'
)
WITH CHECK (
  -- Motorista pode atualizar seu próprio registro
  driver_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
  -- Apenas pode mudar para INACTIVE
  AND status = 'INACTIVE'
);