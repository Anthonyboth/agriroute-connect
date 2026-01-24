-- ============================================================
-- MIGRATION: Padronizar status de pagamentos e melhorar fluxo
-- Adiciona suporte para status intermediário (produtor pagou, aguardando motorista)
-- ============================================================

-- 1. Adicionar comentário para documentar os status válidos
COMMENT ON COLUMN public.external_payments.status IS 'Status do pagamento: proposed (motorista solicitou), paid_by_producer (produtor pagou, aguardando confirmação), confirmed (motorista confirmou recebimento), rejected (produtor rejeitou), cancelled (cancelado)';

-- 2. Verificar e atualizar registros com status 'completed' para 'confirmed' (caso existam)
UPDATE public.external_payments 
SET status = 'confirmed' 
WHERE status = 'completed';

-- 3. Criar índice para performance nas buscas por status e producer_id
CREATE INDEX IF NOT EXISTS idx_external_payments_producer_status 
ON public.external_payments(producer_id, status);

CREATE INDEX IF NOT EXISTS idx_external_payments_driver_status 
ON public.external_payments(driver_id, status);

-- 4. Criar função para atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION public.update_external_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Criar trigger se não existir
DROP TRIGGER IF EXISTS update_external_payments_timestamp ON public.external_payments;
CREATE TRIGGER update_external_payments_timestamp
  BEFORE UPDATE ON public.external_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_external_payments_updated_at();

-- 6. Adicionar política RLS para UPDATE do produtor (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'external_payments' 
    AND policyname = 'Producers can update their external payments'
  ) THEN
    CREATE POLICY "Producers can update their external payments"
      ON public.external_payments
      FOR UPDATE
      USING (
        producer_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        AND has_role(auth.uid(), 'producer'::app_role)
      );
  END IF;
END $$;