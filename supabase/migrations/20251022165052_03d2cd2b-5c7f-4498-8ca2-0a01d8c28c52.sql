-- =========================================
-- Configurar Processamento Automático da Fila do Telegram
-- =========================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função que processa a fila diretamente via pg_net
CREATE OR REPLACE FUNCTION process_telegram_queue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  msg record;
  telegram_response record;
  success_count int := 0;
  fail_count int := 0;
  bot_token text;
  chat_id text := '-4964515694';
BEGIN
  -- Obter token do Vault (secrets do Supabase)
  SELECT decrypted_secret INTO bot_token
  FROM vault.decrypted_secrets
  WHERE name = 'TELEGRAM_BOT_TOKEN';
  
  IF bot_token IS NULL THEN
    RAISE EXCEPTION 'TELEGRAM_BOT_TOKEN não configurado no Vault';
  END IF;
  
  -- Processar até 10 mensagens pendentes
  FOR msg IN 
    SELECT * FROM telegram_message_queue
    WHERE status = 'PENDING' 
      AND retry_count < 5
    ORDER BY created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Enviar via pg_net
      SELECT * INTO telegram_response
      FROM net.http_post(
        url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'chat_id', chat_id,
          'text', msg.message,
          'parse_mode', 'HTML',
          'disable_web_page_preview', true
        )
      );
      
      -- Verificar resposta
      IF telegram_response.status_code = 200 THEN
        -- Marcar como enviada
        UPDATE telegram_message_queue
        SET status = 'SENT',
            sent_at = NOW()
        WHERE id = msg.id;
        
        -- Atualizar error_log
        IF msg.error_log_id IS NOT NULL THEN
          UPDATE error_logs
          SET telegram_notified = true,
              telegram_sent_at = NOW(),
              status = 'NOTIFIED'
          WHERE id = msg.error_log_id;
        END IF;
        
        success_count := success_count + 1;
      ELSE
        RAISE EXCEPTION 'Telegram retornou status %', telegram_response.status_code;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Incrementar retry
      UPDATE telegram_message_queue
      SET retry_count = retry_count + 1,
          last_retry_at = NOW(),
          status = CASE WHEN retry_count >= 4 THEN 'FAILED' ELSE 'PENDING' END
      WHERE id = msg.id;
      
      fail_count := fail_count + 1;
    END;
    
    -- Delay 1s entre mensagens para evitar rate limiting
    PERFORM pg_sleep(1);
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'processed', success_count + fail_count,
    'success_count', success_count,
    'fail_count', fail_count
  );
END;
$$;

-- Remover cron job existente se houver
SELECT cron.unschedule('telegram-queue-processor') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'telegram-queue-processor'
);

-- Agendar execução a cada 5 minutos
SELECT cron.schedule(
  'telegram-queue-processor',
  '*/5 * * * *',
  'SELECT process_telegram_queue();'
);