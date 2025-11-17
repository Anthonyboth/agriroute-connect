
-- ========================================
-- CORREÇÃO: Função com tipos corretos
-- ========================================

DROP FUNCTION IF EXISTS auto_cancel_overdue_freights();

CREATE OR REPLACE FUNCTION auto_cancel_overdue_freights()
RETURNS TABLE (
  freight_id uuid,
  cargo_type text,
  origin_city text,
  destination_city text,
  pickup_date timestamp with time zone,
  producer_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_count integer := 0;
  v_cancelled_ids uuid[];
BEGIN
  SELECT array_agg(f.id)
  INTO v_cancelled_ids
  FROM freights f
  WHERE f.status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'LOADED', 'IN_TRANSIT')
    AND f.pickup_date + interval '48 hours' < now();

  IF v_cancelled_ids IS NULL OR array_length(v_cancelled_ids, 1) = 0 THEN
    RAISE NOTICE 'Nenhum frete vencido encontrado';
    RETURN;
  END IF;

  UPDATE freights
  SET 
    status = 'CANCELLED',
    cancelled_at = now(),
    cancellation_reason = 'Cancelamento automático: frete não coletado em 48h após a data agendada',
    updated_at = now()
  WHERE id = ANY(v_cancelled_ids);

  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;
  RAISE NOTICE 'Cancelados % fretes', v_cancelled_count;

  RETURN QUERY
  SELECT 
    f.id::uuid,
    f.cargo_type::text,
    f.origin_city::text,
    f.destination_city::text,
    f.pickup_date,
    f.producer_id::uuid
  FROM freights f
  WHERE f.id = ANY(v_cancelled_ids);
END;
$$;

-- Executar cancelamento imediato dos 9 fretes vencidos
SELECT * FROM auto_cancel_overdue_freights();

-- Corrigir cron job para chamar SQL direto
SELECT cron.unschedule('auto-cancel-freights-hourly');

SELECT cron.schedule(
  'auto-cancel-freights-hourly',
  '0 * * * *',
  'SELECT auto_cancel_overdue_freights();'
);
