-- FASE 2: Sistema de Avisos - Adicionar campos de data, categoria e arquivamento
ALTER TABLE system_announcements
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'informativo',
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Criar índice para melhorar performance de queries por data
CREATE INDEX IF NOT EXISTS idx_system_announcements_dates 
ON system_announcements(starts_at, ends_at, is_active, archived);

-- FASE 4: Recriar função auto_cancel_overdue_freights com isolamento de erros
DROP FUNCTION IF EXISTS auto_cancel_overdue_freights();

CREATE OR REPLACE FUNCTION auto_cancel_overdue_freights()
RETURNS TABLE (
  freight_id UUID,
  cargo_type TEXT,
  origin_city TEXT,
  destination_city TEXT,
  pickup_date DATE,
  producer_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_freight RECORD;
  v_cancelled_count INTEGER := 0;
BEGIN
  FOR v_cancelled_freight IN 
    SELECT f.id, f.cargo_type, f.origin_city, f.destination_city, 
           f.pickup_date, f.status, f.producer_id
    FROM freights f
    WHERE f.status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'LOADED', 'IN_TRANSIT')
      AND f.pickup_date + INTERVAL '48 hours' < NOW()
  LOOP
    BEGIN
      UPDATE freights
      SET 
        status = 'CANCELLED',
        cancellation_reason = 'Cancelamento automático: frete não coletado em 48h após a data agendada',
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE freights.id = v_cancelled_freight.id;
      
      v_cancelled_count := v_cancelled_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao cancelar frete %: %', v_cancelled_freight.id, SQLERRM;
      CONTINUE;
    END;
    
    BEGIN
      INSERT INTO freight_status_history (
        freight_id, status, changed_by, notes, created_at
      ) VALUES (
        v_cancelled_freight.id,
        'CANCELLED',
        NULL,
        'Cancelamento automático: frete não coletado em 48h após a data agendada',
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar histórico frete %: %', v_cancelled_freight.id, SQLERRM;
    END;
    
    RETURN QUERY 
    SELECT 
      v_cancelled_freight.id,
      v_cancelled_freight.cargo_type,
      v_cancelled_freight.origin_city,
      v_cancelled_freight.destination_city,
      v_cancelled_freight.pickup_date::DATE,
      v_cancelled_freight.producer_id;
  END LOOP;
  
  RAISE NOTICE 'Cancelados % fretes vencidos', v_cancelled_count;
  RETURN;
END;
$$;