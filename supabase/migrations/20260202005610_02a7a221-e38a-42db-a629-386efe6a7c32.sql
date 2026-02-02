-- =====================================================
-- FIX: Permitir motoristas (MOTORISTA e MOTORISTA_AFILIADO) atualizar external_payments
-- E implementar auto-confirmação de pagamentos após 72h
-- =====================================================

-- 1. Remover política antiga de UPDATE para motorista
DROP POLICY IF EXISTS "Drivers can update external payments" ON external_payments;

-- 2. Criar nova política que verifica o role na tabela profiles diretamente
-- Isso cobre tanto MOTORISTA quanto MOTORISTA_AFILIADO
CREATE POLICY "Drivers can update external payments"
ON external_payments
FOR UPDATE
USING (
  driver_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )
)
WITH CHECK (
  driver_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )
);

-- 3. Criar função para auto-confirmar pagamentos após 72h
CREATE OR REPLACE FUNCTION public.auto_confirm_payments_after_72h()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_record RECORD;
  confirmed_count INT := 0;
BEGIN
  -- Encontrar pagamentos marcados como pagos há mais de 72h que ainda não foram confirmados
  FOR payment_record IN
    SELECT ep.id, ep.freight_id, ep.driver_id, ep.producer_id, ep.amount
    FROM external_payments ep
    WHERE ep.status = 'paid_by_producer'
      AND ep.updated_at < NOW() - INTERVAL '72 hours'
  LOOP
    BEGIN
      -- Auto-confirmar o pagamento
      UPDATE external_payments
      SET 
        status = 'confirmed',
        accepted_by_driver = true,
        accepted_at = NOW(),
        confirmed_at = NOW(),
        updated_at = NOW(),
        notes = COALESCE(notes, '') || ' | Auto-confirmado pelo sistema após 72h'
      WHERE id = payment_record.id;
      
      confirmed_count := confirmed_count + 1;
      
      RAISE NOTICE '[auto_confirm_payments] Pagamento % auto-confirmado', payment_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_confirm_payments] Erro ao confirmar pagamento %: %', payment_record.id, SQLERRM;
    END;
  END LOOP;
  
  IF confirmed_count > 0 THEN
    RAISE NOTICE '[auto_confirm_payments] Total de pagamentos auto-confirmados: %', confirmed_count;
  END IF;
END;
$$;

-- 4. Criar job pg_cron para rodar a cada hora (se pg_cron estiver disponível)
-- Nota: Este comando pode falhar se pg_cron não estiver habilitado
DO $$
BEGIN
  -- Remover job existente se houver
  PERFORM cron.unschedule('auto-confirm-payments-72h');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron job não existe ou pg_cron não está habilitado';
END $$;

DO $$
BEGIN
  -- Agendar para rodar a cada hora
  PERFORM cron.schedule(
    'auto-confirm-payments-72h',
    '0 * * * *', -- A cada hora
    'SELECT public.auto_confirm_payments_after_72h()'
  );
  RAISE NOTICE 'Job pg_cron criado: auto-confirm-payments-72h';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Não foi possível criar job pg_cron. A função pode ser chamada manualmente.';
END $$;

-- 5. Garantir que a função de auto-confirmação de delivery (já existente) 
-- também confirma pagamentos pendentes há 72h do lado do produtor
-- (quando o produtor não marca como pago mas o motorista já entregou)
CREATE OR REPLACE FUNCTION public.auto_confirm_delivery_and_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freight_record RECORD;
  payment_record RECORD;
BEGIN
  -- Auto-confirmar entregas pendentes há mais de 72h
  FOR freight_record IN
    SELECT f.id, f.requester_id
    FROM freights f
    WHERE f.status = 'DELIVERED_PENDING_CONFIRMATION'
      AND f.updated_at < NOW() - INTERVAL '72 hours'
  LOOP
    BEGIN
      UPDATE freights
      SET 
        status = 'COMPLETED',
        updated_at = NOW()
      WHERE id = freight_record.id;
      
      -- Registrar log
      INSERT INTO auto_confirm_logs (freight_id, hours_elapsed, confirmed_at, metadata)
      VALUES (
        freight_record.id,
        72,
        NOW(),
        jsonb_build_object('type', 'delivery_auto_confirm', 'reason', '72h timeout')
      );
      
      RAISE NOTICE '[auto_confirm] Frete % auto-confirmado', freight_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[auto_confirm] Erro ao confirmar frete %: %', freight_record.id, SQLERRM;
    END;
  END LOOP;

  -- Auto-confirmar pagamentos pendentes (motorista confirma) após 72h
  PERFORM public.auto_confirm_payments_after_72h();
END;
$$;

-- 6. Comentário explicativo
COMMENT ON FUNCTION public.auto_confirm_payments_after_72h() IS 
'Auto-confirma pagamentos marcados como paid_by_producer há mais de 72 horas. 
O motorista tem 72h para confirmar o recebimento ou contestar. 
Após esse prazo, o sistema confirma automaticamente.';