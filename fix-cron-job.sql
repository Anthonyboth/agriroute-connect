-- ========================================
-- CORREÇÃO DO CRON JOB DE CANCELAMENTO AUTOMÁTICO
-- ========================================
-- Este script deve ser executado no SQL Editor do Supabase
-- para corrigir o cron job que não está funcionando

-- Passo 1: Remover o cron job antigo (com token anon que não funciona)
SELECT cron.unschedule('auto-cancel-freights-hourly');

-- Passo 2: Criar novo cron job chamando a função SQL diretamente
-- (mesmo padrão usado por auto-confirm-deliveries que funciona corretamente)
SELECT cron.schedule(
  'auto-cancel-freights-hourly',
  '0 * * * *',  -- A cada hora
  'SELECT auto_cancel_overdue_freights();'
);

-- Passo 3: Executar o cancelamento manual imediatamente
-- para cancelar os 9 fretes vencidos que estão aguardando
SELECT auto_cancel_overdue_freights();

-- Passo 4: Verificar que o novo cron job foi criado corretamente
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'auto-cancel-freights-hourly';

-- Passo 5: Verificar quantos fretes foram cancelados
SELECT 
  id,
  cargo_type,
  origin_city,
  destination_city,
  pickup_date,
  status,
  cancellation_reason,
  cancelled_at
FROM freights
WHERE cancelled_at > now() - interval '5 minutes'
ORDER BY cancelled_at DESC;

-- Passo 6: Verificar que não há mais fretes vencidos
SELECT COUNT(*) as fretes_vencidos_restantes
FROM freights
WHERE status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'LOADED', 'IN_TRANSIT')
  AND pickup_date + interval '48 hours' < now();
