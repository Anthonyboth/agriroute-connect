-- ============================================================================
-- REGRAS DE CANCELAMENTO AUTOMÁTICO POR TIPO DE SERVIÇO/FRETE
-- ============================================================================
-- REGRA CRÍTICA: Apenas itens NÃO ACEITOS podem ser cancelados automaticamente!
-- Após aceito, apenas o usuário pode cancelar manualmente.
-- 
-- TEMPOS DE EXPIRAÇÃO (após criação do anúncio):
-- - Serviços (service_requests): 7 dias
-- - FRETE_MOTO: 4 horas
-- - MUDANCA: 48 horas
-- - GUINCHO: 2 horas
-- - Fretes urbanos (outros): 24 horas
-- - CARGA (rural/rodoviário): 72 horas
-- ============================================================================

-- Recriar função de cancelamento com novas regras
DROP FUNCTION IF EXISTS auto_cancel_overdue_freights();

CREATE OR REPLACE FUNCTION auto_cancel_overdue_freights()
RETURNS TABLE (
  item_id UUID,
  item_type TEXT,
  service_type TEXT,
  origin_city TEXT,
  destination_city TEXT,
  created_date TIMESTAMPTZ,
  expiration_reason TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_freight RECORD;
  v_cancelled_service RECORD;
  v_cancelled_count INTEGER := 0;
  v_expiration_interval INTERVAL;
  v_reason TEXT;
BEGIN
  -- =============================================
  -- FASE 1: CANCELAR FRETES NÃO ACEITOS VENCIDOS
  -- =============================================
  -- REGRA: Apenas status OPEN ou IN_NEGOTIATION (não aceitos)
  -- Fretes aceitos NUNCA são cancelados automaticamente!
  
  FOR v_cancelled_freight IN 
    SELECT f.id, f.cargo_type, f.service_type AS stype, f.origin_city, f.destination_city, 
           f.created_at, f.status, f.producer_id
    FROM freights f
    WHERE f.status IN ('OPEN', 'IN_NEGOTIATION')  -- APENAS não aceitos!
      AND (
        -- GUINCHO: 2 horas
        (UPPER(COALESCE(f.service_type, f.cargo_type)) = 'GUINCHO' 
         AND f.created_at + INTERVAL '2 hours' < NOW())
        OR
        -- FRETE_MOTO: 4 horas
        (UPPER(COALESCE(f.service_type, f.cargo_type)) = 'FRETE_MOTO' 
         AND f.created_at + INTERVAL '4 hours' < NOW())
        OR
        -- MUDANCA: 48 horas
        (UPPER(COALESCE(f.service_type, f.cargo_type)) IN ('MUDANCA', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL') 
         AND f.created_at + INTERVAL '48 hours' < NOW())
        OR
        -- CARGA (rural/rodoviário): 72 horas
        (UPPER(COALESCE(f.service_type, f.cargo_type)) = 'CARGA' 
         AND f.created_at + INTERVAL '72 hours' < NOW())
        OR
        -- Fretes urbanos (FRETE_URBANO e outros não mapeados): 24 horas
        (UPPER(COALESCE(f.service_type, f.cargo_type)) NOT IN ('GUINCHO', 'FRETE_MOTO', 'MUDANCA', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL', 'CARGA')
         AND f.created_at + INTERVAL '24 hours' < NOW())
      )
  LOOP
    -- Determinar motivo de cancelamento baseado no tipo
    CASE UPPER(COALESCE(v_cancelled_freight.stype, v_cancelled_freight.cargo_type))
      WHEN 'GUINCHO' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 2h sem aceite';
      WHEN 'FRETE_MOTO' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 4h sem aceite';
      WHEN 'MUDANCA' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 48h sem aceite';
      WHEN 'MUDANCA_RESIDENCIAL' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 48h sem aceite';
      WHEN 'MUDANCA_COMERCIAL' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 48h sem aceite';
      WHEN 'CARGA' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 72h sem aceite';
      ELSE v_reason := 'Cancelado automaticamente: anúncio expirou após 24h sem aceite';
    END CASE;
    
    BEGIN
      UPDATE freights
      SET 
        status = 'CANCELLED',
        cancellation_reason = v_reason,
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE freights.id = v_cancelled_freight.id;
      
      v_cancelled_count := v_cancelled_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao cancelar frete %: %', v_cancelled_freight.id, SQLERRM;
      CONTINUE;
    END;
    
    -- Registrar no histórico
    BEGIN
      INSERT INTO freight_status_history (
        freight_id, status, changed_by, notes, created_at
      ) VALUES (
        v_cancelled_freight.id,
        'CANCELLED',
        NULL,
        v_reason,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar histórico frete %: %', v_cancelled_freight.id, SQLERRM;
    END;
    
    RETURN QUERY 
    SELECT 
      v_cancelled_freight.id,
      'freight'::TEXT,
      COALESCE(v_cancelled_freight.stype, v_cancelled_freight.cargo_type)::TEXT,
      v_cancelled_freight.origin_city::TEXT,
      v_cancelled_freight.destination_city::TEXT,
      v_cancelled_freight.created_at,
      v_reason;
  END LOOP;
  
  -- =============================================
  -- FASE 2: CANCELAR SERVIÇOS NÃO ACEITOS VENCIDOS
  -- =============================================
  -- REGRA: Apenas status OPEN (não aceitos)
  -- Serviços: 7 dias após postados
  
  FOR v_cancelled_service IN 
    SELECT s.id, s.service_type, s.location_city, s.created_at
    FROM service_requests s
    WHERE s.status = 'OPEN'  -- APENAS não aceitos!
      AND s.created_at + INTERVAL '7 days' < NOW()
  LOOP
    v_reason := 'Cancelado automaticamente: anúncio expirou após 7 dias sem aceite';
    
    BEGIN
      UPDATE service_requests
      SET 
        status = 'CANCELLED',
        cancellation_reason = v_reason,
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE service_requests.id = v_cancelled_service.id;
      
      v_cancelled_count := v_cancelled_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao cancelar serviço %: %', v_cancelled_service.id, SQLERRM;
      CONTINUE;
    END;
    
    RETURN QUERY 
    SELECT 
      v_cancelled_service.id,
      'service'::TEXT,
      v_cancelled_service.service_type::TEXT,
      v_cancelled_service.location_city::TEXT,
      NULL::TEXT,
      v_cancelled_service.created_at,
      v_reason;
  END LOOP;
  
  RAISE NOTICE 'Cancelados % itens vencidos (fretes + serviços)', v_cancelled_count;
  RETURN;
END;
$$;

COMMENT ON FUNCTION auto_cancel_overdue_freights IS 
'Cancela automaticamente fretes e serviços NÃO ACEITOS após prazo de expiração.
GUINCHO: 2h | FRETE_MOTO: 4h | URBANOS: 24h | MUDANÇA: 48h | CARGA: 72h | SERVIÇOS: 7 dias.
REGRA CRÍTICA: Apenas itens com status OPEN/IN_NEGOTIATION são cancelados.
Após aceito, NUNCA cancela automaticamente - apenas o usuário pode cancelar.';

-- ============================================================================
-- FUNÇÃO PARA VERIFICAR TEMPO RESTANTE ATÉ EXPIRAÇÃO
-- ============================================================================
CREATE OR REPLACE FUNCTION get_item_expiration_info(
  p_item_id UUID,
  p_item_type TEXT DEFAULT 'freight'
)
RETURNS TABLE (
  item_id UUID,
  item_type TEXT,
  service_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expiration_hours NUMERIC,
  expires_at TIMESTAMPTZ,
  time_remaining INTERVAL,
  is_expired BOOLEAN,
  can_auto_cancel BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_type TEXT;
  v_status TEXT;
  v_created_at TIMESTAMPTZ;
  v_expiration_hours NUMERIC;
BEGIN
  IF p_item_type = 'freight' THEN
    SELECT 
      UPPER(COALESCE(f.service_type, f.cargo_type)),
      f.status,
      f.created_at
    INTO v_service_type, v_status, v_created_at
    FROM freights f
    WHERE f.id = p_item_id;
    
    -- Determinar horas de expiração baseado no tipo
    v_expiration_hours := CASE v_service_type
      WHEN 'GUINCHO' THEN 2
      WHEN 'FRETE_MOTO' THEN 4
      WHEN 'MUDANCA' THEN 48
      WHEN 'MUDANCA_RESIDENCIAL' THEN 48
      WHEN 'MUDANCA_COMERCIAL' THEN 48
      WHEN 'CARGA' THEN 72
      ELSE 24  -- Urbanos e outros
    END;
    
  ELSIF p_item_type = 'service' THEN
    SELECT 
      s.service_type,
      s.status,
      s.created_at
    INTO v_service_type, v_status, v_created_at
    FROM service_requests s
    WHERE s.id = p_item_id;
    
    v_expiration_hours := 168; -- 7 dias = 168 horas
  END IF;
  
  IF v_created_at IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    p_item_id,
    p_item_type,
    v_service_type,
    v_status,
    v_created_at,
    v_expiration_hours,
    v_created_at + (v_expiration_hours || ' hours')::INTERVAL,
    (v_created_at + (v_expiration_hours || ' hours')::INTERVAL) - NOW(),
    NOW() > (v_created_at + (v_expiration_hours || ' hours')::INTERVAL),
    v_status IN ('OPEN', 'IN_NEGOTIATION');  -- Só pode cancelar automaticamente se não aceito
END;
$$;

COMMENT ON FUNCTION get_item_expiration_info IS 
'Retorna informações de expiração de um frete ou serviço, incluindo tempo restante e se pode ser cancelado automaticamente.';