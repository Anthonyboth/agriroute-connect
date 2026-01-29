-- Fix: auto-created external payments for multi-truck freights were using the full freight price.
-- This updates the trigger function to generate per-driver share amounts and allows one external_payment per driver.

CREATE OR REPLACE FUNCTION public.auto_create_external_payment_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_payment_id UUID;
  v_driver_id UUID;
  v_share_divisor integer;
  v_amount numeric;
BEGIN
  -- Only run when status changes to a delivered state
  IF NEW.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')) THEN

    -- Prefer an assignment that is already delivered/completed (multi-truck), otherwise fallback to NEW.driver_id
    v_driver_id := NULL;

    SELECT fa.driver_id
      INTO v_driver_id
    FROM public.freight_assignments fa
    WHERE fa.freight_id = NEW.id
      AND fa.status IN ('DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION')
    ORDER BY fa.delivered_at DESC NULLS LAST, fa.updated_at DESC NULLS LAST, fa.created_at DESC
    LIMIT 1;

    IF v_driver_id IS NULL THEN
      v_driver_id := NEW.driver_id;
    END IF;

    IF v_driver_id IS NULL THEN
      SELECT fa.driver_id
        INTO v_driver_id
      FROM public.freight_assignments fa
      WHERE fa.freight_id = NEW.id
        AND fa.status IN ('ACCEPTED', 'IN_TRANSIT')
      ORDER BY fa.updated_at DESC NULLS LAST, fa.created_at DESC
      LIMIT 1;
    END IF;

    -- If still no driver, do nothing
    IF v_driver_id IS NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] Freight % has no assigned driver, skipping', NEW.id;
      RETURN NEW;
    END IF;

    -- Allow one payment per (freight, driver). If it already exists, do nothing.
    SELECT ep.id
      INTO v_existing_payment_id
    FROM public.external_payments ep
    WHERE ep.freight_id = NEW.id
      AND ep.driver_id = v_driver_id
    ORDER BY ep.created_at DESC
    LIMIT 1;

    IF v_existing_payment_id IS NOT NULL THEN
      RAISE NOTICE '[AUTO_PAYMENT] External payment already exists for freight % and driver %', NEW.id, v_driver_id;
      RETURN NEW;
    END IF;

    v_share_divisor := GREATEST(COALESCE(NEW.required_trucks, 1), 1);
    v_amount := ROUND(COALESCE(NEW.price, 0) / v_share_divisor::numeric, 2);

    -- Guard: don't insert invalid amounts (would violate constraints)
    IF v_amount <= 0 THEN
      RAISE NOTICE '[AUTO_PAYMENT] Computed amount <= 0 for freight %, skipping', NEW.id;
      RETURN NEW;
    END IF;

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
      CASE WHEN v_share_divisor > 1
        THEN 'Pagamento automático (multi-carreta): parcela por motorista gerada após entrega'
        ELSE 'Pagamento automático gerado após entrega do frete'
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
        'share_divisor', v_share_divisor
      )
    );

    RAISE NOTICE '[AUTO_PAYMENT] External payment created for freight % driver % amount % (divisor=%)', NEW.id, v_driver_id, v_amount, v_share_divisor;
  END IF;

  RETURN NEW;
END;
$$;

-- Data fix: any previously auto-created external payment for multi-truck freights that used the full freight price
-- is converted to the per-driver share. (Keeps reporting consistent.)
UPDATE public.external_payments ep
SET amount = ROUND(f.price / GREATEST(COALESCE(f.required_trucks, 1), 1)::numeric, 2),
    notes = COALESCE(ep.notes, '') || ' | corrigido: valor ajustado para parcela por motorista'
FROM public.freights f
WHERE f.id = ep.freight_id
  AND COALESCE(f.required_trucks, 1) > 1
  AND ep.amount = f.price;
