-- Drop e recriar função auto_cancel_overdue_freights para retornar IDs dos fretes cancelados
DROP FUNCTION IF EXISTS auto_cancel_overdue_freights();

CREATE FUNCTION auto_cancel_overdue_freights()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_cancelled_count int;
  v_scheduled_count int;
  v_cancelled_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Cancelar fretes vencidos e armazenar IDs
  WITH cancelled AS (
    UPDATE freights
    SET 
      status = 'CANCELLED',
      cancellation_reason = 'Cancelamento automático: frete não coletado em 48h após a data agendada',
      cancelled_at = now()
    WHERE status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION')
      AND pickup_date IS NOT NULL
      AND pickup_date + INTERVAL '48 hours' < now()
    RETURNING id
  )
  SELECT array_agg(id), count(*) 
  INTO v_cancelled_ids, v_cancelled_count
  FROM cancelled;
  
  -- Inserir histórico para fretes cancelados
  IF v_cancelled_ids IS NOT NULL AND array_length(v_cancelled_ids, 1) > 0 THEN
    INSERT INTO freight_status_history (freight_id, status, changed_by, notes)
    SELECT 
      id,
      'CANCELLED',
      NULL,
      'Cancelamento automático: frete não coletado em 48h após a data agendada'
    FROM unnest(v_cancelled_ids) AS id;
  END IF;
  
  -- Mover fretes agendados para em andamento
  UPDATE freights
  SET status = 'IN_PROGRESS'
  WHERE status = 'ACCEPTED'
    AND pickup_date IS NOT NULL
    AND DATE(pickup_date) = CURRENT_DATE;
  
  GET DIAGNOSTICS v_scheduled_count = ROW_COUNT;
  
  -- Retornar resultado com IDs dos fretes cancelados
  RETURN jsonb_build_object(
    'cancelled_count', COALESCE(v_cancelled_count, 0),
    'scheduled_to_progress_count', v_scheduled_count,
    'cancelled_freights', COALESCE(v_cancelled_ids, ARRAY[]::uuid[]),
    'executed_at', now()
  );
END;
$$;