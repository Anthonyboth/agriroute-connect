-- CORREÇÃO CRÍTICA: O trigger deve aplicar a mesma heurística do frontend (resolveDriverUnitPrice)
-- Se agreed_price ≈ freight.price em frete multi-carreta, dividir por required_trucks

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
  v_required_trucks integer;
BEGIN
  -- Only run when status changes to a delivered state
  IF NEW.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')) THEN

    v_required_trucks := GREATEST(COALESCE(NEW.required_trucks, 1), 1);

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
      SELECT fa.agreed_price INTO v_agreed_price
      FROM public.freight_assignments fa
      WHERE fa.freight_id = NEW.id AND fa.driver_id = v_driver_id
      LIMIT 1;
    END IF;

    -- Last fallback: any active assignment
    IF v_driver_id IS NULL THEN
      SELECT fa.driver_id, fa.agreed_price
        INTO v_driver_id, v_agreed_price
      FROM public.freight_assignments fa
      WHERE fa.freight_id = NEW.id AND fa.status IN ('ACCEPTED', 'IN_TRANSIT')
      ORDER BY fa.updated_at DESC NULLS LAST
      LIMIT 1;
    END IF;

    IF v_driver_id IS NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Freight % has no assigned driver, skipping', NEW.id;
      RETURN NEW;
    END IF;

    -- Check for existing payment
    SELECT ep.id INTO v_existing_payment_id
    FROM public.external_payments ep
    WHERE ep.freight_id = NEW.id AND ep.driver_id = v_driver_id
    LIMIT 1;

    IF v_existing_payment_id IS NOT NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Payment already exists for freight % driver %', NEW.id, v_driver_id;
      RETURN NEW;
    END IF;

    -- Fallback: divide price by trucks
    v_fallback_amount := ROUND(COALESCE(NEW.price, 0) / v_required_trucks::numeric, 2);

    -- CORREÇÃO CRÍTICA: Heurística igual a resolveDriverUnitPrice do frontend
    -- Se agreed_price ≈ freight.price E multi-carreta → dividir (foi salvo como total)
    IF v_agreed_price IS NOT NULL AND v_agreed_price > 0 THEN
      IF v_required_trucks > 1 
         AND COALESCE(NEW.price, 0) > 0 
         AND ABS(v_agreed_price - COALESCE(NEW.price, 0)) <= 0.01 THEN
        -- agreed_price é o total, dividir por required_trucks
        v_amount := ROUND(COALESCE(NEW.price, 0) / v_required_trucks::numeric, 2);
        RAISE NOTICE '[AUTO_PAYMENT] Heuristic: agreed_price ≈ freight.price in multi-truck, dividing: % → %', v_agreed_price, v_amount;
      ELSE
        v_amount := v_agreed_price;
      END IF;
    ELSE
      v_amount := v_fallback_amount;
    END IF;

    IF v_amount <= 0 THEN
      RAISE NOTICE '[AUTO_PAYMENT] Amount <= 0 for freight %, skipping', NEW.id;
      RETURN NEW;
    END IF;

    INSERT INTO public.external_payments (
      freight_id, producer_id, driver_id, amount, status, notes, proposed_at
    ) VALUES (
      NEW.id, NEW.producer_id, v_driver_id, v_amount, 'proposed',
      CASE 
        WHEN v_agreed_price IS NOT NULL AND v_agreed_price > 0
        THEN 'Pagamento automático: valor por carreta (acordado)'
        ELSE 'Pagamento automático: valor calculado (sem acordo prévio)'
      END,
      NOW()
    );

    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      NEW.producer_id,
      'Pagamento Pendente',
      'O frete foi entregue. Confirme o pagamento ao motorista no valor de R$ ' || v_amount::text,
      'payment_pending',
      jsonb_build_object(
        'freight_id', NEW.id,
        'amount', v_amount,
        'driver_id', v_driver_id,
        'source', CASE WHEN v_agreed_price IS NOT NULL THEN 'agreed_price_per_truck' ELSE 'calculated' END
      )
    );

    RAISE NOTICE '[AUTO_PAYMENT] Created payment for freight % driver % amount %', NEW.id, v_driver_id, v_amount;
  END IF;

  RETURN NEW;
END;
$$;

-- CORREÇÃO DE DADOS: Corrigir pagamentos existentes onde amount = freight.price em fretes multi-carreta
-- (deveria ser freight.price / required_trucks)
UPDATE public.external_payments ep
SET 
  amount = ROUND(f.price / GREATEST(f.required_trucks, 1)::numeric, 2),
  notes = COALESCE(ep.notes, '') || ' | CORRIGIDO: valor dividido por required_trucks'
FROM public.freights f
WHERE f.id = ep.freight_id
  AND f.required_trucks > 1
  AND ABS(ep.amount - f.price) <= 0.01
  AND ep.status IN ('proposed', 'paid_by_producer');