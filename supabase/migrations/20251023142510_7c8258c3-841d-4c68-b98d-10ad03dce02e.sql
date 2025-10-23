-- ============================================
-- SISTEMA DE AUTO-CONFIRMAÇÃO DE ENTREGAS
-- ============================================

-- 1. Remover função existente
DROP FUNCTION IF EXISTS auto_confirm_deliveries();

-- 2. Habilitar extensão pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Criar tabela de logs
CREATE TABLE IF NOT EXISTS auto_confirm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID REFERENCES freights(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMP DEFAULT NOW(),
  hours_elapsed NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_confirm_logs_freight_id ON auto_confirm_logs(freight_id);
CREATE INDEX IF NOT EXISTS idx_auto_confirm_logs_confirmed_at ON auto_confirm_logs(confirmed_at DESC);

ALTER TABLE auto_confirm_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant auto-confirm logs" ON auto_confirm_logs;
CREATE POLICY "Users can view relevant auto-confirm logs"
ON auto_confirm_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND (
      p.role = 'ADMIN'
      OR EXISTS (
        SELECT 1 FROM freights f
        WHERE f.id = auto_confirm_logs.freight_id
        AND (f.producer_id = p.id OR f.driver_id = p.id)
      )
    )
  )
);

-- 4. Criar função de auto-confirmação
CREATE FUNCTION auto_confirm_deliveries()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_count INTEGER := 0;
  v_freight RECORD;
  v_hours_elapsed NUMERIC;
BEGIN
  FOR v_freight IN
    SELECT 
      f.id,
      f.metadata,
      f.producer_id,
      f.driver_id,
      (f.metadata->>'delivery_reported_at')::timestamp as delivery_time
    FROM freights f
    WHERE f.status = 'DELIVERED_PENDING_CONFIRMATION'
      AND f.metadata->>'delivery_reported_at' IS NOT NULL
      AND (NOW() - (f.metadata->>'delivery_reported_at')::timestamp) > INTERVAL '72 hours'
  LOOP
    v_hours_elapsed := EXTRACT(EPOCH FROM (NOW() - v_freight.delivery_time)) / 3600;
    
    UPDATE freights
    SET 
      status = 'DELIVERED',
      updated_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || 
                 jsonb_build_object(
                   'auto_confirmed_at', NOW()::text,
                   'auto_confirmed_reason', 'Confirmação automática após ' || ROUND(v_hours_elapsed, 2) || ' horas'
                 )
    WHERE id = v_freight.id;
    
    INSERT INTO auto_confirm_logs (freight_id, hours_elapsed, metadata)
    VALUES (
      v_freight.id,
      v_hours_elapsed,
      jsonb_build_object(
        'delivery_reported_at', v_freight.delivery_time,
        'confirmed_at', NOW(),
        'producer_id', v_freight.producer_id,
        'driver_id', v_freight.driver_id
      )
    );
    
    IF v_freight.driver_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        v_freight.driver_id,
        'Entrega Confirmada Automaticamente',
        'A entrega foi confirmada automaticamente após 72 horas sem resposta do produtor.',
        'freight_auto_confirmed',
        jsonb_build_object('freight_id', v_freight.id, 'hours_elapsed', ROUND(v_hours_elapsed, 2))
      );
    END IF;
    
    IF v_freight.producer_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        v_freight.producer_id,
        'Entrega Confirmada Automaticamente',
        'A entrega foi confirmada automaticamente após 72 horas. O prazo para contestação expirou.',
        'freight_auto_confirmed',
        jsonb_build_object('freight_id', v_freight.id, 'hours_elapsed', ROUND(v_hours_elapsed, 2))
      );
    END IF;
    
    v_confirmed_count := v_confirmed_count + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'confirmed_count', v_confirmed_count, 'timestamp', NOW());
END;
$$;

-- 5. Agendar execução (tentar desagendar primeiro, ignorar erro)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-confirm-deliveries');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'auto-confirm-deliveries',
  '0 * * * *',
  $$SELECT auto_confirm_deliveries()$$
);