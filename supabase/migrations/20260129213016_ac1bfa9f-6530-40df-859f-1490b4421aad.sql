-- ============================================
-- MIGRATION: Limpar pagamentos órfãos e atualizar políticas RLS
-- ============================================

-- 1. Remover pagamentos que referenciam fretes inexistentes
DELETE FROM public.external_payments ep
WHERE NOT EXISTS (
  SELECT 1 FROM public.freights f WHERE f.id = ep.freight_id
);

-- 2. Agora podemos adicionar a FK com segurança
ALTER TABLE public.external_payments
ADD CONSTRAINT external_payments_freight_id_fkey
FOREIGN KEY (freight_id) REFERENCES public.freights(id) ON DELETE CASCADE;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_external_payments_producer_id ON public.external_payments(producer_id);
CREATE INDEX IF NOT EXISTS idx_external_payments_driver_id ON public.external_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_external_payments_freight_id ON public.external_payments(freight_id);
CREATE INDEX IF NOT EXISTS idx_external_payments_status ON public.external_payments(status);

-- 4. Garantir que as políticas RLS estão corretas
DROP POLICY IF EXISTS "Users can view their external payments" ON public.external_payments;

CREATE POLICY "Users can view their external payments"
ON public.external_payments FOR SELECT
TO authenticated
USING (
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  is_admin()
);

-- 5. Política para transportadora ver pagamentos de motoristas afiliados
DROP POLICY IF EXISTS "Companies can view affiliated drivers payments" ON public.external_payments;

CREATE POLICY "Companies can view affiliated drivers payments"
ON public.external_payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_drivers cd
    JOIN transport_companies tc ON tc.id = cd.company_id
    WHERE cd.driver_profile_id = external_payments.driver_id
    AND tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND cd.status = 'active'
  )
);