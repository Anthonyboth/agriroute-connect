-- CORREÇÃO CRÍTICA: O trigger deve usar freight_assignments.agreed_price
-- como fonte da verdade para o valor do pagamento, NÃO freights.price / required_trucks

CREATE OR REPLACE FUNCTION public.auto_create_external_payment_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_payment_id UUID;
  v_driver_id UUID;
  v_amount numeric;
  v_agreed_price numeric;
  v_fallback_amount numeric;
BEGIN
  -- Only run when status changes to a delivered state
  IF NEW.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')) THEN

    -- Find the driver who delivered (priority: DELIVERED status)
    v_driver_id := NULL;
    v_agreed_price := NULL;

    SELECT fa.driver_id, fa.agreed_price
      INTO v_driver_id, v_agreed_price
    FROM public.freight_assignments fa
    WHERE fa.freight_id = NEW.id
      AND fa.status IN ('DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION')
    ORDER BY fa.delivered_at DESC NULLS LAST, fa.updated_at DESC NULLS LAST
    LIMIT 1;

    -- Fallback to driver_id from freight
    IF v_driver_id IS NULL THEN
      v_driver_id := NEW.driver_id;
      
      -- Try to get agreed_price from any assignment for this driver
      SELECT fa.agreed_price INTO v_agreed_price
      FROM public.freight_assignments fa
      WHERE fa.freight_id = NEW.id
        AND fa.driver_id = v_driver_id
      LIMIT 1;
    END IF;

    -- Last fallback: any active assignment
    IF v_driver_id IS NULL THEN
      SELECT fa.driver_id, fa.agreed_price
        INTO v_driver_id, v_agreed_price
      FROM public.freight_assignments fa
      WHERE fa.freight_id = NEW.id
        AND fa.status IN ('ACCEPTED', 'IN_TRANSIT')
      ORDER BY fa.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    -- If still no driver, skip
    IF v_driver_id IS NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Freight % has no assigned driver, skipping', NEW.id;
      RETURN NEW;
    END IF;

    -- Check for existing payment
    SELECT ep.id INTO v_existing_payment_id
    FROM public.external_payments ep
    WHERE ep.freight_id = NEW.id
      AND ep.driver_id = v_driver_id
    LIMIT 1;

    IF v_existing_payment_id IS NOT NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Payment already exists for freight % driver %', NEW.id, v_driver_id;
      RETURN NEW;
    END IF;

    -- REGRA CRÍTICA: Usar agreed_price do assignment como fonte da verdade
    -- Fallback: divide o preço base pelo número de carretas
    v_fallback_amount := ROUND(COALESCE(NEW.price, 0) / GREATEST(COALESCE(NEW.required_trucks, 1), 1)::numeric, 2);
    
    -- Prioridade: agreed_price > fallback
    IF v_agreed_price IS NOT NULL AND v_agreed_price > 0 THEN
      v_amount := v_agreed_price;
      RAISE NOTICE '[AUTO_PAYMENT] Using agreed_price % for freight % driver %', v_amount, NEW.id, v_driver_id;
    ELSE
      v_amount := v_fallback_amount;
      RAISE NOTICE '[AUTO_PAYMENT] Using fallback price % for freight % driver %', v_amount, NEW.id, v_driver_id;
    END IF;

    -- Guard: don't insert invalid amounts
    IF v_amount <= 0 THEN
      RAISE NOTICE '[AUTO_PAYMENT] Amount <= 0 for freight %, skipping', NEW.id;
      RETURN NEW;
    END IF;

    -- Create the external payment with the correct agreed amount
    INSERT INTO public.external_payments (
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
      v_amount,
      'proposed',
      CASE 
        WHEN v_agreed_price IS NOT NULL AND v_agreed_price > 0
        THEN 'Pagamento automático: valor acordado com o motorista'
        ELSE 'Pagamento automático: valor calculado (sem acordo prévio)'
      END,
      NOW()
    );

    -- Notification for producer
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      data
    ) VALUES (
      NEW.producer_id,
      'Pagamento Pendente',
      'O frete foi entregue. Confirme o pagamento ao motorista no valor de R$ ' || v_amount::text,
      'payment_pending',
      jsonb_build_object(
        'freight_id', NEW.id,
        'amount', v_amount,
        'driver_id', v_driver_id,
        'source', CASE WHEN v_agreed_price IS NOT NULL THEN 'agreed_price' ELSE 'calculated' END
      )
    );

    RAISE NOTICE '[AUTO_PAYMENT] Created payment for freight % driver % amount %', NEW.id, v_driver_id, v_amount;
  END IF;

  RETURN NEW;
END;
$$;

-- CORREÇÃO DOS DADOS: Atualizar o pagamento existente com o valor correto (agreed_price do assignment)
UPDATE public.external_payments ep
SET 
  amount = fa.agreed_price,
  notes = COALESCE(ep.notes, '') || ' | CORRIGIDO: valor atualizado para agreed_price do assignment'
FROM public.freight_assignments fa
WHERE fa.freight_id = ep.freight_id
  AND fa.driver_id = ep.driver_id
  AND fa.agreed_price IS NOT NULL
  AND fa.agreed_price > 0
  AND ep.amount != fa.agreed_price
  AND ep.status = 'proposed';  -- Só corrige pagamentos ainda não confirmados