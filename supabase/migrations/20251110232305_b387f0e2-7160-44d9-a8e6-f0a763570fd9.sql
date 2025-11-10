-- ============================================================================
-- SISTEMA DE CANCELAMENTO AUTOMÁTICO DE FRETES
-- ============================================================================
-- Cancela fretes não coletados após 48h da data de coleta
-- Move fretes agendados para em andamento no dia da coleta
-- ============================================================================

-- Passo 1: Adicionar colunas para controle de cancelamento
ALTER TABLE freights 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN freights.cancellation_reason IS 'Motivo do cancelamento do frete';
COMMENT ON COLUMN freights.cancelled_at IS 'Data e hora do cancelamento';

-- Passo 2: Criar índice para performance nas consultas de data
CREATE INDEX IF NOT EXISTS idx_freights_pickup_date_status 
ON freights(pickup_date, status) 
WHERE pickup_date IS NOT NULL;

-- Passo 3: Criar função principal de cancelamento automático
CREATE OR REPLACE FUNCTION auto_cancel_overdue_freights()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_cancelled_count INTEGER := 0;
  v_moved_count INTEGER := 0;
  v_cutoff_date DATE;
  v_today DATE;
BEGIN
  -- Datas de referência
  v_cutoff_date := CURRENT_DATE - INTERVAL '2 days';
  v_today := CURRENT_DATE;
  
  RAISE NOTICE '[AUTO-CANCEL] Iniciando verificação. Cutoff: %, Hoje: %', v_cutoff_date, v_today;
  
  -- AÇÃO 1: CANCELAR fretes vencidos (pickup_date + 48h já passou)
  WITH cancelled AS (
    UPDATE freights
    SET 
      status = 'CANCELLED'::freight_status,
      cancellation_reason = 'Cancelamento automático: frete não coletado em 48h após a data agendada',
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE 
      pickup_date IS NOT NULL
      AND pickup_date::date <= v_cutoff_date
      AND status IN ('OPEN'::freight_status, 'ACCEPTED'::freight_status, 'IN_NEGOTIATION'::freight_status)
    RETURNING id, producer_id, driver_id, pickup_date
  ),
  history_insert AS (
    INSERT INTO freight_status_history (freight_id, status, changed_by, notes, created_at)
    SELECT 
      id, 
      'CANCELLED'::freight_status, 
      COALESCE(driver_id, producer_id),
      'Cancelamento automático por atraso na coleta (48h). Data de coleta: ' || pickup_date::text,
      NOW()
    FROM cancelled
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_cancelled_count FROM cancelled;
  
  RAISE NOTICE '[AUTO-CANCEL] Fretes cancelados: %', v_cancelled_count;
  
  -- AÇÃO 2: MOVER para em andamento (pickup_date = hoje e status = ACCEPTED)
  WITH moved AS (
    UPDATE freights
    SET 
      status = 'IN_TRANSIT'::freight_status,
      updated_at = NOW()
    WHERE 
      pickup_date IS NOT NULL
      AND pickup_date::date = v_today
      AND status = 'ACCEPTED'::freight_status
    RETURNING id, producer_id, driver_id, pickup_date
  ),
  history_insert AS (
    INSERT INTO freight_status_history (freight_id, status, changed_by, notes, created_at)
    SELECT 
      id, 
      'IN_TRANSIT'::freight_status, 
      COALESCE(driver_id, producer_id),
      'Movido automaticamente para em trânsito - data de coleta chegou: ' || pickup_date::text,
      NOW()
    FROM moved
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_count FROM moved;
  
  RAISE NOTICE '[AUTO-CANCEL] Fretes movidos para em andamento: %', v_moved_count;
  
  -- Retornar resultado
  RETURN json_build_object(
    'success', true,
    'cancelled_count', v_cancelled_count,
    'moved_count', v_moved_count,
    'cutoff_date', v_cutoff_date,
    'today', v_today,
    'executed_at', NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[AUTO-CANCEL] Erro na execução: %', SQLERRM;
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'cancelled_count', v_cancelled_count,
    'moved_count', v_moved_count
  );
END;
$$;

COMMENT ON FUNCTION auto_cancel_overdue_freights IS 
'Cancela automaticamente fretes não coletados após 48h da data agendada e move fretes aceitos para em trânsito no dia da coleta';

-- Passo 4: Executar varredura imediata para cancelar fretes vencidos
SELECT auto_cancel_overdue_freights();