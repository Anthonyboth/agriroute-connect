import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749'; // Supergroup (migrado)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[PROCESS-TELEGRAM-QUEUE] Iniciando processamento da fila');

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não configurado');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar mensagens pendentes
    const { data: pendingMessages, error: fetchError } = await supabaseAdmin
      .from('telegram_message_queue')
      .select('*')
      .eq('status', 'PENDING')
      .lt('retry_count', 5) // Máximo 5 tentativas
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[PROCESS-TELEGRAM-QUEUE] Nenhuma mensagem pendente');
      return new Response(JSON.stringify({ 
        success: true,
        processed: 0,
        message: 'Nenhuma mensagem pendente' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log(`[PROCESS-TELEGRAM-QUEUE] ${pendingMessages.length} mensagens para processar`);

    let successCount = 0;
    let failCount = 0;

    for (const msg of pendingMessages) {
      try {
        // Tentar enviar com parse_mode HTML primeiro
        let response = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: msg.message,
              parse_mode: 'HTML',
              disable_web_page_preview: true
            })
          }
        );

        // Se falhou com HTML (400), logar erro e tentar sem parse_mode
        if (!response.ok && response.status === 400) {
          const errorBody = await response.text();
          console.log(`[PROCESS-TELEGRAM-QUEUE] Falha com HTML para ${msg.id}. Resposta Telegram:`, errorBody);
          
          // Remover tags HTML para enviar como texto puro
          const plainText = msg.message
            .replace(/<b>/g, '*')
            .replace(/<\/b>/g, '*')
            .replace(/<pre>/g, '```')
            .replace(/<\/pre>/g, '```')
            .replace(/<[^>]+>/g, ''); // Remove outras tags HTML
          
          response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: plainText,
                disable_web_page_preview: true
              })
            }
          );

          if (!response.ok) {
            const plainErrorBody = await response.text();
            console.log(`[PROCESS-TELEGRAM-QUEUE] Falha com texto puro para ${msg.id}. Resposta Telegram:`, plainErrorBody);
          }
        }

        if (response.ok) {
          // Marcar como enviada
          await supabaseAdmin
            .from('telegram_message_queue')
            .update({ status: 'SENT' })
            .eq('id', msg.id);

          // Atualizar error_log se aplicável
          if (msg.error_log_id) {
            await supabaseAdmin
              .from('error_logs')
              .update({
                telegram_notified: true,
                telegram_sent_at: new Date().toISOString(),
                status: 'NOTIFIED'
              })
              .eq('id', msg.error_log_id);
          }

          successCount++;
          console.log(`[PROCESS-TELEGRAM-QUEUE] Mensagem ${msg.id} enviada com sucesso`);
        } else {
          throw new Error(`Telegram API retornou ${response.status}`);
        }
      } catch (error) {
        // Incrementar retry_count
        await supabaseAdmin
          .from('telegram_message_queue')
          .update({ 
            retry_count: msg.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            status: msg.retry_count >= 4 ? 'FAILED' : 'PENDING'
          })
          .eq('id', msg.id);

        failCount++;
        console.log(`[PROCESS-TELEGRAM-QUEUE] Erro ao enviar mensagem ${msg.id}:`, error);
      }

      // Delay entre mensagens para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[PROCESS-TELEGRAM-QUEUE] Processamento concluído: ${successCount} sucesso, ${failCount} falhas`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: successCount + failCount,
      successCount,
      failCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[PROCESS-TELEGRAM-QUEUE] ERRO:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
