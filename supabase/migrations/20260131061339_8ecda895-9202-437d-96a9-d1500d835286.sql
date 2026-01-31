-- ============================================================================
-- ATUALIZAR CRON JOB PARA EXECUTAR A CADA 30 MINUTOS
-- ============================================================================
-- Necessário para capturar expirações curtas (GUINCHO: 2h, FRETE_MOTO: 4h)
-- ============================================================================

-- Remover cron job antigo (se existir)
SELECT cron.unschedule('auto-cancel-freights-hourly');

-- Criar novo cron job com frequência de 30 minutos
SELECT cron.schedule(
  'auto-cancel-freights-half-hourly',
  '*/30 * * * *',  -- A cada 30 minutos
  'SELECT * FROM auto_cancel_overdue_freights();'
);

-- Verificar que o novo cron job foi criado
DO $$
BEGIN
  RAISE NOTICE 'Cron job atualizado para executar a cada 30 minutos';
END
$$;