
-- ============================================================================
-- BUG #013 FIX: Withdrawal not cancelling assignments + duplicate notifications
-- ROOT CAUSE 1: process_freight_withdrawal checks freights.driver_id to determine
-- multi_truck mode. After a previous withdrawal sets driver_id=NULL, re-accept
-- via accept-freight-multiple may not always re-set driver_id before the next
-- withdrawal, causing the RPC to take the wrong code path.
-- ROOT CAUSE 2: notify_freight_status_change creates duplicate "Frete aceito!"
-- notifications on each accept/withdraw/re-accept cycle since the 5-min dedup
-- window doesn't account for re-acceptance of the same freight.
-- ROOT CAUSE 3: Stale OPEN assignments left behind after failed withdrawals
-- ============================================================================

-- FIX 1: Recreate withdrawal RPC — always find assignment directly, don't rely on freights.driver_id
CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(freight_id_param UUID, p_driver_profile_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  freight_record RECORD;
  assignment_record RECORD;
  has_checkins BOOLEAN;
  safe_pickup_date TIMESTAMP WITH TIME ZONE;
  v_caller_id UUID;
  v_caller_profile_id UUID;
  remaining_active INTEGER;
  v_driver_user_id UUID;
  is_company_freight BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT p.id INTO v_caller_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_caller_id AND p.id = p_driver_profile_id;
  
  IF v_caller_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ACCESS_DENIED');
  END IF;

  -- ✅ FIX: Always look for the driver's assignment FIRST (not freights.driver_id)
  SELECT fa.id, fa.status INTO assignment_record
  FROM public.freight_assignments fa
  WHERE fa.freight_id = freight_id_param AND fa.driver_id = p_driver_profile_id
    AND fa.status IN ('OPEN', 'ACCEPTED', 'LOADING')
  ORDER BY fa.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  -- Get freight info
  SELECT f.id, f.status, f.driver_id, f.pickup_date, f.required_trucks, 
         f.accepted_trucks, f.company_id
  INTO freight_record
  FROM public.freights f
  WHERE f.id = freight_id_param
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'NOT_OWNER_OR_NOT_FOUND');
  END IF;

  -- Block withdrawal for loaded+ statuses
  IF assignment_record.status IN ('LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN
    RETURN json_build_object('success', false, 'error', 'STATUS_REQUIRES_SUPPORT',
      'message', 'Após o carregamento, o cancelamento só pode ser feito pelo suporte/admin.');
  END IF;

  -- Check for check-ins
  SELECT EXISTS(
    SELECT 1 FROM public.driver_checkins dc
    WHERE dc.freight_id = freight_id_param AND dc.driver_profile_id = p_driver_profile_id
  ) INTO has_checkins;
  
  IF has_checkins THEN
    RETURN json_build_object('success', false, 'error', 'HAS_CHECKINS');
  END IF;

  is_company_freight := freight_record.company_id IS NOT NULL;

  -- ✅ CRITICAL: Set skip flag to prevent recalc cascade loop
  PERFORM set_config('app.skip_recalc', 'true', true);

  -- ✅ STEP 1: Cancel ALL driver's active assignments for this freight
  UPDATE public.freight_assignments fa2
  SET status = 'CANCELLED', updated_at = now()
  WHERE fa2.freight_id = freight_id_param 
    AND fa2.driver_id = p_driver_profile_id
    AND fa2.status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED', 'WITHDRAWN');

  -- ✅ STEP 2: Cancel proposals
  UPDATE public.freight_proposals fp
  SET status = 'CANCELLED', updated_at = now()
  WHERE fp.freight_id = freight_id_param AND fp.driver_id = p_driver_profile_id;

  -- ✅ STEP 3: Delete trip progress
  DELETE FROM public.driver_trip_progress dtp
  WHERE dtp.freight_id = freight_id_param AND dtp.driver_id = p_driver_profile_id;

  -- ✅ STEP 4: Count remaining active assignments
  SELECT COUNT(*) INTO remaining_active
  FROM public.freight_assignments fa3
  WHERE fa3.freight_id = freight_id_param 
    AND fa3.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');

  -- ✅ STEP 5: Update freight
  IF remaining_active = 0 THEN
    -- No more active drivers → revert to OPEN
    IF freight_record.pickup_date IS NULL OR freight_record.pickup_date < CURRENT_DATE THEN
      safe_pickup_date := now() + interval '48 hours';
    ELSE
      safe_pickup_date := freight_record.pickup_date;
    END IF;

    UPDATE public.freights f2
    SET status = 'OPEN',
        driver_id = NULL,
        accepted_trucks = 0,
        drivers_assigned = '{}',
        is_full_booking = false,
        pickup_date = CASE WHEN is_company_freight THEN f2.pickup_date ELSE safe_pickup_date END,
        updated_at = now()
    WHERE f2.id = freight_id_param;
  ELSE
    -- Still has other drivers → just remove this driver from the list
    UPDATE public.freights f2
    SET drivers_assigned = array_remove(f2.drivers_assigned, p_driver_profile_id),
        accepted_trucks = GREATEST(remaining_active, 0),
        driver_id = CASE WHEN f2.driver_id = p_driver_profile_id THEN NULL ELSE f2.driver_id END,
        is_full_booking = (remaining_active >= COALESCE(f2.required_trucks, 1)),
        updated_at = now()
    WHERE f2.id = freight_id_param;
  END IF;

  -- ✅ STEP 6: Notification
  SELECT pr.user_id INTO v_driver_user_id
  FROM public.profiles pr
  WHERE pr.id = p_driver_profile_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_driver_user_id,
    'FREIGHT_WITHDRAWN',
    'Desistência confirmada',
    'Você desistiu do frete com sucesso.',
    json_build_object('freight_id', freight_id_param)::jsonb
  );

  PERFORM set_config('app.skip_recalc', 'false', true);

  RETURN json_build_object('success', true, 'message', 'Desistência processada com sucesso');

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.skip_recalc', 'false', true);
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO service_role;


-- FIX 2: Improve notification dedup — use per-freight dedup for accept notifications
CREATE OR REPLACE FUNCTION public.notify_freight_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  -- Frete aceito pelo motorista (with per-freight dedup to handle re-accept after withdrawal)
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE data->>'freight_id' = NEW.id::text 
        AND type = 'freight_accepted'
        AND created_at > now() - interval '30 seconds'
      LIMIT 1
    ) THEN
      IF NEW.producer_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.producer_id,
          'Motorista aceitou o frete',
          'Um motorista aceitou seu frete!',
          'freight_accepted',
          jsonb_build_object('freight_id', NEW.id)
        );
      END IF;
      IF NEW.driver_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM freight_proposals 
          WHERE freight_id = NEW.id 
            AND driver_id = NEW.driver_id 
            AND status = 'ACCEPTED'
          LIMIT 1
        ) THEN
          INSERT INTO notifications (user_id, title, message, type, data)
          VALUES (
            NEW.driver_id,
            'Frete aceito!',
            'Sua proposta foi aceita pelo produtor',
            'freight_accepted',
            jsonb_build_object('freight_id', NEW.id)
          );
        ELSE
          INSERT INTO notifications (user_id, title, message, type, data)
          VALUES (
            NEW.driver_id,
            'Frete aceito!',
            'Você aceitou o frete com sucesso',
            'freight_accepted',
            jsonb_build_object('freight_id', NEW.id)
          );
        END IF;
      END IF;
    END IF;
  END IF;

  -- Frete cancelado pelo produtor — notificar TODOS os motoristas atribuídos
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE data->>'freight_id' = NEW.id::text 
        AND type = 'freight_cancelled'
        AND created_at > now() - interval '5 minutes'
      LIMIT 1
    ) THEN
      FOR v_driver_id IN
        SELECT DISTINCT driver_id FROM freight_assignments
        WHERE freight_id = NEW.id
          AND driver_id IS NOT NULL
      LOOP
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          v_driver_id,
          'Frete cancelado pelo produtor',
          'O produtor cancelou o frete que você havia aceitado. Verifique seus fretes disponíveis.',
          'freight_cancelled',
          jsonb_build_object('freight_id', NEW.id)
        );
      END LOOP;
    END IF;
  END IF;
  
  -- Avaliação SOMENTE após COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE data->>'freight_id' = NEW.id::text 
        AND type = 'rating_pending'
        AND created_at > now() - interval '5 minutes'
      LIMIT 1
    ) THEN
      IF NEW.driver_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.producer_id,
          'Avalie o motorista',
          'O frete foi concluído. Que tal avaliar o motorista?',
          'rating_pending',
          jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.driver_id)
        );
        
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.driver_id,
          'Avalie o produtor',
          'O frete foi concluído. Que tal avaliar o produtor?',
          'rating_pending',
          jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.producer_id)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- FIX 3: Clean up stale assignments for freight b925ce19
UPDATE public.freight_assignments
SET status = 'CANCELLED', updated_at = now()
WHERE freight_id = 'b925ce19-855f-4db6-b3ea-49cef83a335a'
  AND driver_id = 'a22b811e-9ff1-435e-97bf-8d35c079d7ab'
  AND status = 'OPEN';

-- Reset freight to proper OPEN state
UPDATE public.freights
SET status = 'OPEN', driver_id = NULL, accepted_trucks = 0,
    drivers_assigned = '{}', is_full_booking = false, updated_at = now()
WHERE id = 'b925ce19-855f-4db6-b3ea-49cef83a335a'
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments 
    WHERE freight_id = 'b925ce19-855f-4db6-b3ea-49cef83a335a' 
    AND status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  );

-- FIX 4: Clean up any other orphaned OPEN assignments globally
UPDATE public.freight_assignments fa
SET status = 'CANCELLED', updated_at = now()
FROM public.freights f
WHERE fa.freight_id = f.id
  AND fa.status = 'OPEN'
  AND f.status = 'OPEN'
  AND f.driver_id IS NULL
  AND fa.updated_at < now() - interval '30 minutes';
