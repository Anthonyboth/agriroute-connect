-- =============================================================================
-- Função SQL: auto_cancel_expired_service_requests()
-- Cancela automaticamente service_requests com status='OPEN' que ultrapassaram
-- o TTL conforme o service_type.
-- REGRA: SOMENTE status OPEN pode ser auto-cancelado.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_service_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cancelled_count INTEGER := 0;
BEGIN
  -- Cancelar GUINCHO: 4 horas
  UPDATE service_requests
  SET 
    status = 'CANCELLED',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelamento automático: solicitação expirada sem aceite (prazo de 4 horas excedido)',
    updated_at = NOW()
  WHERE status = 'OPEN'
    AND service_type = 'GUINCHO'
    AND created_at < NOW() - INTERVAL '4 hours';
  
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  IF cancelled_count > 0 THEN
    RAISE LOG '[auto_cancel_expired_service_requests] % solicitações GUINCHO canceladas por expiração', cancelled_count;
  END IF;

  -- Cancelar FRETE_MOTO: 24 horas
  UPDATE service_requests
  SET 
    status = 'CANCELLED',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelamento automático: solicitação expirada sem aceite (prazo de 24 horas excedido)',
    updated_at = NOW()
  WHERE status = 'OPEN'
    AND service_type = 'FRETE_MOTO'
    AND created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  IF cancelled_count > 0 THEN
    RAISE LOG '[auto_cancel_expired_service_requests] % solicitações FRETE_MOTO canceladas por expiração', cancelled_count;
  END IF;

  -- Cancelar FRETE_URBANO: 72 horas
  UPDATE service_requests
  SET 
    status = 'CANCELLED',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelamento automático: solicitação expirada sem aceite (prazo de 72 horas excedido)',
    updated_at = NOW()
  WHERE status = 'OPEN'
    AND service_type = 'FRETE_URBANO'
    AND created_at < NOW() - INTERVAL '72 hours';

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  IF cancelled_count > 0 THEN
    RAISE LOG '[auto_cancel_expired_service_requests] % solicitações FRETE_URBANO canceladas por expiração', cancelled_count;
  END IF;

  -- Cancelar MUDANCA_RESIDENCIAL / MUDANCA_COMERCIAL: 72 horas
  UPDATE service_requests
  SET 
    status = 'CANCELLED',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelamento automático: solicitação expirada sem aceite (prazo de 72 horas excedido)',
    updated_at = NOW()
  WHERE status = 'OPEN'
    AND service_type IN ('MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL')
    AND created_at < NOW() - INTERVAL '72 hours';

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  IF cancelled_count > 0 THEN
    RAISE LOG '[auto_cancel_expired_service_requests] % solicitações MUDANCA canceladas por expiração', cancelled_count;
  END IF;

  -- Cancelar outros tipos genéricos: 72 horas (fallback)
  UPDATE service_requests
  SET 
    status = 'CANCELLED',
    cancelled_at = NOW(),
    cancellation_reason = 'Cancelamento automático: solicitação expirada sem aceite (prazo de 72 horas excedido)',
    updated_at = NOW()
  WHERE status = 'OPEN'
    AND service_type NOT IN ('GUINCHO', 'FRETE_MOTO', 'FRETE_URBANO', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL')
    AND created_at < NOW() - INTERVAL '72 hours';

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  IF cancelled_count > 0 THEN
    RAISE LOG '[auto_cancel_expired_service_requests] % solicitações genéricas canceladas por expiração', cancelled_count;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.auto_cancel_expired_service_requests() IS 
'Cancela automaticamente service_requests OPEN que ultrapassaram o prazo por tipo:
GUINCHO=4h, FRETE_MOTO=24h, FRETE_URBANO=72h, MUDANCA=72h, outros=72h.
REGRA ABSOLUTA: somente status OPEN é auto-cancelado. Qualquer outro status é protegido.';

-- =============================================================================
-- Cron Job: auto-cancel-service-requests-hourly (roda a cada 1 hora)
-- =============================================================================
SELECT cron.schedule(
  'auto-cancel-service-requests-hourly',
  '0 * * * *',
  $$SELECT public.auto_cancel_expired_service_requests();$$
);