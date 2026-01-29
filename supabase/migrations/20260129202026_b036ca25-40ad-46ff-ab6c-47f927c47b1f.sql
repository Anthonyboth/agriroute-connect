-- ============================================================
-- FIX: Auto-criar external_payment quando frete é entregue
-- O produtor vê imediatamente o pagamento pendente no dashboard
-- ============================================================

-- Função para criar pagamento externo automaticamente
CREATE OR REPLACE FUNCTION public.auto_create_external_payment_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_payment_id UUID;
  v_driver_id UUID;
BEGIN
  -- Só executa quando o status muda para DELIVERED ou DELIVERED_PENDING_CONFIRMATION
  IF NEW.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')) THEN
    
    -- Buscar driver_id do frete (pode ser do próprio frete ou de assignments)
    v_driver_id := NEW.driver_id;
    
    -- Se não tem driver_id direto, buscar do primeiro assignment ativo
    IF v_driver_id IS NULL THEN
      SELECT driver_id INTO v_driver_id
      FROM freight_assignments
      WHERE freight_id = NEW.id
        AND status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED')
      ORDER BY created_at
      LIMIT 1;
    END IF;
    
    -- Se ainda não tem motorista, não criar pagamento
    IF v_driver_id IS NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Frete % sem motorista atribuído, ignorando', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Verificar se já existe external_payment para este frete
    SELECT id INTO v_existing_payment_id
    FROM external_payments
    WHERE freight_id = NEW.id
    LIMIT 1;
    
    IF v_existing_payment_id IS NOT NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Pagamento externo já existe para frete %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Criar o external_payment automaticamente com status 'proposed'
    INSERT INTO external_payments (
      freight_id,
      producer_id,
      driver_id,
      amount,
      status,
      notes,
      proposed_at
    ) VALUES (
      NEW.id,
      NEW.producer_id,
      v_driver_id,
      COALESCE(NEW.price, 0),
      'proposed',
      'Pagamento automático gerado após entrega do frete',
      NOW()
    );
    
    RAISE NOTICE '[AUTO_PAYMENT] Pagamento externo criado para frete % - valor: %', NEW.id, NEW.price;
    
    -- Criar notificação para o produtor
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      NEW.producer_id,
      'Pagamento Pendente',
      'O frete foi entregue. Confirme o pagamento ao motorista no valor de R$ ' || COALESCE(NEW.price, 0)::TEXT,
      'payment_pending',
      jsonb_build_object(
        'freight_id', NEW.id,
        'amount', COALESCE(NEW.price, 0),
        'driver_id', v_driver_id
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger no freights
DROP TRIGGER IF EXISTS trigger_auto_create_payment_on_delivery ON freights;
CREATE TRIGGER trigger_auto_create_payment_on_delivery
  AFTER UPDATE ON freights
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_external_payment_on_delivery();

-- Também criar para INSERT (caso o frete seja criado diretamente como DELIVERED - edge case)
DROP TRIGGER IF EXISTS trigger_auto_create_payment_on_delivery_insert ON freights;
CREATE TRIGGER trigger_auto_create_payment_on_delivery_insert
  AFTER INSERT ON freights
  FOR EACH ROW
  WHEN (NEW.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION'))
  EXECUTE FUNCTION public.auto_create_external_payment_on_delivery();

-- ============================================================
-- RETROATIVO: Criar pagamentos para fretes já entregues que não tem
-- ============================================================
INSERT INTO external_payments (
  freight_id,
  producer_id,
  driver_id,
  amount,
  status,
  notes,
  proposed_at
)
SELECT 
  f.id,
  f.producer_id,
  COALESCE(f.driver_id, (
    SELECT fa.driver_id 
    FROM freight_assignments fa 
    WHERE fa.freight_id = f.id 
      AND fa.status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED')
    ORDER BY fa.created_at 
    LIMIT 1
  )),
  COALESCE(f.price, 0),
  'proposed',
  'Pagamento retroativo - frete entregue anteriormente',
  NOW()
FROM freights f
WHERE f.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED')
  AND NOT EXISTS (
    SELECT 1 FROM external_payments ep WHERE ep.freight_id = f.id
  )
  AND f.producer_id IS NOT NULL
  AND (
    f.driver_id IS NOT NULL 
    OR EXISTS (
      SELECT 1 FROM freight_assignments fa 
      WHERE fa.freight_id = f.id 
        AND fa.status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED')
    )
  );

COMMENT ON FUNCTION public.auto_create_external_payment_on_delivery() IS 
  'Cria automaticamente um external_payment quando o frete é marcado como entregue. Alimenta o painel de pagamentos do produtor e relatórios.';