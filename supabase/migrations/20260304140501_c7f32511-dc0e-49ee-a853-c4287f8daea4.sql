
-- =====================================================
-- ATUALIZAR prazos de vencimento:
-- GUINCHO: 2h → 8h (created_at)
-- FRETE_MOTO: 4h → 8h (created_at)
-- Urbanos: 24h → 48h (created_at)
-- MUDANÇA: 48h created_at → 72h após pickup_date
-- CARGA: mantém 72h após pickup_date
-- =====================================================

DROP FUNCTION IF EXISTS public.auto_cancel_overdue_freights();

CREATE OR REPLACE FUNCTION public.auto_cancel_overdue_freights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_count INTEGER := 0;
  v_closed_slots_count INTEGER := 0;
  v_freight_record RECORD;
  v_real_accepted_count INTEGER;
  v_result jsonb := '{"cancelled": [], "closed_slots": [], "skipped": []}'::jsonb;
BEGIN
  -- =========================================================
  -- FASE 0: SINCRONIZAR accepted_trucks COM ATRIBUIÇÕES REAIS
  -- =========================================================
  FOR v_freight_record IN
    SELECT 
      f.id,
      f.accepted_trucks as current_accepted,
      f.required_trucks,
      (SELECT COUNT(*) FROM freight_assignments fa 
       WHERE fa.freight_id = f.id 
       AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
      ) as real_accepted
    FROM freights f
    WHERE f.status IN ('OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      AND f.service_type = 'CARGA'
  LOOP
    IF v_freight_record.real_accepted != v_freight_record.current_accepted THEN
      UPDATE freights
      SET 
        accepted_trucks = v_freight_record.real_accepted,
        status = CASE 
          WHEN v_freight_record.real_accepted > 0 AND status = 'OPEN' THEN 'ACCEPTED'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = v_freight_record.id;
    END IF;
  END LOOP;

  -- =========================================================
  -- FASE 1: FRETES RURAIS (CARGA) COM ACEITES PARCIAIS
  -- Fechar apenas vagas remanescentes, NUNCA cancelar
  -- 72h após pickup_date
  -- =========================================================
  FOR v_freight_record IN
    SELECT 
      f.id,
      f.required_trucks,
      f.accepted_trucks,
      f.pickup_date,
      f.created_at
    FROM freights f
    WHERE f.status = 'OPEN'
      AND f.service_type = 'CARGA'
      AND f.accepted_trucks > 0
      AND f.required_trucks > f.accepted_trucks
      AND (
        (f.pickup_date IS NOT NULL AND f.pickup_date + INTERVAL '72 hours' < NOW())
        OR
        (f.pickup_date IS NULL AND f.created_at + INTERVAL '72 hours' < NOW())
      )
  LOOP
    SELECT COUNT(*) INTO v_real_accepted_count
    FROM freight_assignments fa
    WHERE fa.freight_id = v_freight_record.id
      AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION');
    
    IF v_real_accepted_count > 0 AND v_real_accepted_count < v_freight_record.required_trucks THEN
      UPDATE freights
      SET 
        required_trucks = v_real_accepted_count,
        accepted_trucks = v_real_accepted_count,
        status = 'ACCEPTED',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{remaining_slots_expired_at}',
          to_jsonb(NOW())
        ),
        updated_at = NOW()
      WHERE id = v_freight_record.id;
      
      v_closed_slots_count := v_closed_slots_count + 1;
      v_result := jsonb_set(
        v_result,
        '{closed_slots}',
        COALESCE(v_result->'closed_slots', '[]'::jsonb) || 
        jsonb_build_object('freight_id', v_freight_record.id, 'original_trucks', v_freight_record.required_trucks, 'kept_trucks', v_real_accepted_count)
      );
    END IF;
  END LOOP;

  -- =========================================================
  -- FASE 2: CANCELAR FRETES SEM NENHUM ACEITE
  -- Prazos atualizados:
  --   GUINCHO: 8h após created_at
  --   FRETE_MOTO: 8h após created_at
  --   MUDANÇA: 72h após pickup_date (ou 72h após created_at se sem pickup)
  --   CARGA: 72h após pickup_date (ou 72h após created_at se sem pickup)
  --   Urbanos/outros: 48h após created_at
  -- =========================================================
  FOR v_freight_record IN
    SELECT f.id, f.service_type, f.created_at, f.pickup_date
    FROM freights f
    WHERE f.status IN ('OPEN', 'IN_NEGOTIATION')
      AND f.accepted_trucks = 0
      AND (
        -- GUINCHO: 8h após criação
        (f.service_type = 'GUINCHO' AND f.created_at + INTERVAL '8 hours' < NOW())
        OR
        -- FRETE_MOTO: 8h após criação
        (f.service_type = 'FRETE_MOTO' AND f.created_at + INTERVAL '8 hours' < NOW())
        OR
        -- MUDANÇA: 72h após pickup_date (ou 72h após criação se sem pickup)
        (f.service_type = 'MUDANCA' AND (
          (f.pickup_date IS NOT NULL AND f.pickup_date + INTERVAL '72 hours' < NOW())
          OR
          (f.pickup_date IS NULL AND f.created_at + INTERVAL '72 hours' < NOW())
        ))
        OR
        -- CARGA: 72h após pickup_date (ou 72h após criação se sem pickup)
        (f.service_type = 'CARGA' AND (
          (f.pickup_date IS NOT NULL AND f.pickup_date + INTERVAL '72 hours' < NOW())
          OR
          (f.pickup_date IS NULL AND f.created_at + INTERVAL '72 hours' < NOW())
        ))
        OR
        -- Urbanos/outros: 48h após criação
        (f.service_type NOT IN ('GUINCHO', 'FRETE_MOTO', 'MUDANCA', 'CARGA') 
         AND f.created_at + INTERVAL '48 hours' < NOW())
      )
  LOOP
    SELECT COUNT(*) INTO v_real_accepted_count
    FROM freight_assignments fa
    WHERE fa.freight_id = v_freight_record.id
      AND fa.status NOT IN ('CANCELLED', 'REJECTED', 'EXPIRED');
    
    IF v_real_accepted_count = 0 THEN
      UPDATE freights
      SET 
        status = 'CANCELLED',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{auto_cancelled_at}', to_jsonb(NOW())),
        updated_at = NOW()
      WHERE id = v_freight_record.id;
      
      v_cancelled_count := v_cancelled_count + 1;
      v_result := jsonb_set(v_result, '{cancelled}', COALESCE(v_result->'cancelled', '[]'::jsonb) || to_jsonb(v_freight_record.id));
    ELSE
      UPDATE freights
      SET accepted_trucks = v_real_accepted_count, status = 'ACCEPTED', updated_at = NOW()
      WHERE id = v_freight_record.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_count', v_cancelled_count,
    'closed_slots_count', v_closed_slots_count,
    'details', v_result,
    'executed_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.auto_cancel_overdue_freights() IS 
'Cancela fretes vencidos SEM aceites. Para fretes rurais com aceites parciais, fecha vagas remanescentes.
GUINCHO: 8h criação | FRETE_MOTO: 8h criação | URBANOS: 48h criação | MUDANÇA: 72h pickup_date | CARGA: 72h pickup_date.';
