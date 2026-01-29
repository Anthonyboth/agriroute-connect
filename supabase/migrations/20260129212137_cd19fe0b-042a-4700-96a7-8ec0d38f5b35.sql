-- ============================================================
-- FIX: Multi-truck freight delivery confirmation logic
-- Problem: When 1 of N trucks is delivered, the entire freight 
-- was being marked as DELIVERED. Should only mark the assignment.
-- ============================================================

-- 1. FIRST: Update the prevent_regressive_freight_status_changes trigger
-- to allow DELIVERED -> OPEN for multi-truck freights with remaining capacity
CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Special case: Allow driver confirmation (producer_id null means driver action)
  IF NEW.producer_id IS NULL AND OLD.status = 'DELIVERED_PENDING_CONFIRMATION' AND NEW.status = 'DELIVERED' THEN
    RETURN NEW;
  END IF;

  -- ✅ ALWAYS ALLOW CANCELLATION (producers can cancel their freights anytime)
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  -- ✅ ALLOW DELIVERED -> OPEN for multi-truck freights with remaining capacity
  -- This happens when some trucks are delivered but not all
  IF OLD.status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION')
     AND NEW.status = 'OPEN'
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1) THEN
    RAISE LOG 'Allowing DELIVERED->OPEN for multi-truck freight % (% of % trucks)', 
      NEW.id, NEW.accepted_trucks, NEW.required_trucks;
    RETURN NEW;
  END IF;

  -- ❌ RESTRICT DELIVERED status (ensure all trucks are accepted before delivery)
  IF NEW.status = 'DELIVERED'
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT') THEN
    RAISE EXCEPTION 'Não é possível marcar como DELIVERED pois ainda faltam % carretas (% de % aceitas)',
      (NEW.required_trucks - NEW.accepted_trucks), NEW.accepted_trucks, NEW.required_trucks;
  END IF;

  -- ❌ PREVENT invalid regression after delivery reported (for SINGLE truck freights only)
  IF OLD.status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED')
     AND NEW.status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'CANCELLED', 'OPEN')
     AND COALESCE(NEW.required_trucks, 1) = 1 THEN
    RAISE EXCEPTION 'Transição de status inválida após entrega reportada';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix the confirm_delivery function to handle multi-truck correctly
CREATE OR REPLACE FUNCTION public.confirm_delivery(freight_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freight_record RECORD;
  v_profile_id uuid;
  v_required_trucks integer;
  v_delivered_assignments integer;
  v_all_delivered boolean;
  result json;
BEGIN
  -- Get profile_id for current user
  SELECT id INTO v_profile_id 
  FROM profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  -- Fetch freight record
  SELECT * INTO freight_record 
  FROM freights f
  WHERE f.id = freight_id_param
    AND f.producer_id = v_profile_id;
    
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Frete não encontrado ou sem permissão');
  END IF;
  
  v_required_trucks := COALESCE(freight_record.required_trucks, 1);
  
  -- For multi-truck freights, confirm only assignments that are pending
  IF v_required_trucks > 1 THEN
    -- Update all pending confirmation assignments to DELIVERED
    UPDATE freight_assignments
    SET status = 'DELIVERED', updated_at = now()
    WHERE freight_id = freight_id_param
      AND status = 'DELIVERED_PENDING_CONFIRMATION';
    
    -- Count how many assignments are now delivered
    SELECT COUNT(*) INTO v_delivered_assignments
    FROM freight_assignments
    WHERE freight_id = freight_id_param
      AND status = 'DELIVERED';
    
    -- Check if ALL required trucks are now delivered
    v_all_delivered := (v_delivered_assignments >= v_required_trucks);
    
    IF v_all_delivered THEN
      -- All trucks delivered: mark freight as DELIVERED
      UPDATE freights 
      SET 
        status = 'DELIVERED',
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'confirmed_by_producer_at', now(),
          'confirmed_by_producer_id', v_profile_id,
          'all_trucks_delivered_at', now()
        )
      WHERE id = freight_id_param;
      
      RETURN json_build_object(
        'success', true, 
        'message', 'Todas as carretas entregues e confirmadas!',
        'all_delivered', true,
        'delivered_count', v_delivered_assignments,
        'required_count', v_required_trucks
      );
    ELSE
      -- Not all trucks delivered: keep freight OPEN for remaining trucks
      UPDATE freights 
      SET 
        status = 'OPEN',
        updated_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'partial_delivery_confirmed_at', now(),
          'delivered_trucks', v_delivered_assignments,
          'remaining_trucks', v_required_trucks - v_delivered_assignments
        )
      WHERE id = freight_id_param;
      
      RETURN json_build_object(
        'success', true, 
        'message', format('%s de %s carretas entregues. Frete reaberto para as restantes.', 
                         v_delivered_assignments, v_required_trucks),
        'all_delivered', false,
        'delivered_count', v_delivered_assignments,
        'required_count', v_required_trucks
      );
    END IF;
    
  ELSE
    -- Single-truck freight: legacy behavior
    IF freight_record.status != 'DELIVERED_PENDING_CONFIRMATION' THEN
      RETURN json_build_object('success', false, 'message', 'Frete não está aguardando confirmação');
    END IF;
    
    UPDATE freights 
    SET 
      status = 'DELIVERED',
      updated_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'confirmed_by_producer_at', now(),
        'confirmed_by_producer_id', v_profile_id
      )
    WHERE id = freight_id_param;
    
    -- Update assignment too
    UPDATE freight_assignments
    SET status = 'DELIVERED', updated_at = now()
    WHERE freight_id = freight_id_param
      AND status = 'DELIVERED_PENDING_CONFIRMATION';
    
    -- Notify driver
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type,
      data
    ) VALUES (
      freight_record.driver_id,
      'Entrega Confirmada pelo Produtor',
      'O produtor confirmou o recebimento da carga. Seu pagamento foi processado!',
      'delivery_confirmed_by_producer',
      jsonb_build_object('freight_id', freight_id_param, 'confirmed_at', now())
    );
    
    RETURN json_build_object('success', true, 'message', 'Entrega confirmada com sucesso');
  END IF;
END;
$$;

-- 3. Fix auto_confirm_pending_deliveries to handle multi-truck
CREATE OR REPLACE FUNCTION public.auto_confirm_pending_deliveries()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed integer := 0;
  v_record RECORD;
  v_required integer;
  v_delivered integer;
BEGIN
  -- Process each assignment that's been pending for 72+ hours
  FOR v_record IN 
    SELECT DISTINCT fa.freight_id, fa.id as assignment_id, fa.driver_id, f.required_trucks
    FROM freight_assignments fa
    JOIN freights f ON f.id = fa.freight_id
    WHERE fa.status = 'DELIVERED_PENDING_CONFIRMATION'
      AND fa.updated_at < (now() - interval '72 hours')
  LOOP
    -- Confirm this specific assignment
    UPDATE freight_assignments
    SET status = 'DELIVERED', updated_at = now()
    WHERE id = v_record.assignment_id;
    
    v_required := COALESCE(v_record.required_trucks, 1);
    
    -- Count delivered assignments for this freight
    SELECT COUNT(*) INTO v_delivered
    FROM freight_assignments
    WHERE freight_id = v_record.freight_id
      AND status = 'DELIVERED';
    
    -- If all trucks delivered, mark freight as DELIVERED
    IF v_delivered >= v_required THEN
      UPDATE freights 
      SET status = 'DELIVERED', 
          updated_at = now(),
          metadata = COALESCE(metadata, '{}'::jsonb) || 
            jsonb_build_object('auto_confirmed_at', now())
      WHERE id = v_record.freight_id
        AND status != 'DELIVERED';
    ELSE
      -- Otherwise keep/set freight as OPEN for remaining trucks
      UPDATE freights 
      SET status = 'OPEN', 
          updated_at = now()
      WHERE id = v_record.freight_id
        AND status IN ('DELIVERED_PENDING_CONFIRMATION', 'ACCEPTED', 'DELIVERED')
        AND required_trucks > 1;
    END IF;
    
    -- Log the auto-confirmation
    INSERT INTO auto_confirm_logs (freight_id, confirmed_at, hours_elapsed, metadata)
    VALUES (
      v_record.freight_id, 
      now(), 
      72, 
      jsonb_build_object(
        'assignment_id', v_record.assignment_id,
        'driver_id', v_record.driver_id,
        'auto_type', 'assignment_level'
      )
    );
    
    -- Notify driver
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      v_record.driver_id,
      'Entrega confirmada automaticamente',
      'Sua entrega foi confirmada automaticamente após 72h sem resposta do produtor.',
      'auto_delivery_confirmed',
      jsonb_build_object('freight_id', v_record.freight_id)
    );
    
    v_confirmed := v_confirmed + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'confirmed_count', v_confirmed);
END;
$$;

-- 4. Create trigger to prevent freight.status from being set to DELIVERED_PENDING_CONFIRMATION
-- for multi-truck freights (should only be on assignment level)
CREATE OR REPLACE FUNCTION public.protect_multi_truck_freight_status()
RETURNS TRIGGER AS $$
BEGIN
  -- For multi-truck freights, prevent setting freight status to DELIVERED_PENDING_CONFIRMATION
  -- This status should only exist at the assignment level for multi-truck
  IF COALESCE(NEW.required_trucks, 1) > 1 
     AND NEW.status = 'DELIVERED_PENDING_CONFIRMATION'
     AND OLD.status != 'DELIVERED_PENDING_CONFIRMATION' THEN
    
    RAISE LOG 'protect_multi_truck_freight_status: Blocking DELIVERED_PENDING_CONFIRMATION on multi-truck freight %, reverting to OPEN', NEW.id;
    NEW.status := 'OPEN';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_multi_truck_freight_status ON freights;
CREATE TRIGGER trg_protect_multi_truck_freight_status
BEFORE UPDATE ON freights
FOR EACH ROW
EXECUTE FUNCTION protect_multi_truck_freight_status();

-- 5. RESTORE the incorrectly marked freight back to OPEN
-- Freight cdc92bc9-8d81-4960-b27f-2b14c178ce0a has 6 required trucks but only 1 delivered
UPDATE freights
SET 
  status = 'OPEN',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'corrected_at', now(),
    'correction_reason', 'Frete multi-carreta marcado incorretamente como DELIVERED com apenas 1 de 6 carretas entregues'
  )
WHERE id = 'cdc92bc9-8d81-4960-b27f-2b14c178ce0a'
  AND required_trucks > accepted_trucks