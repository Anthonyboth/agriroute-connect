import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-TELEGRAM-ALERT] ${step}${detailsStr}`);
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749'; // Supergroup (migrado)

async function saveToOfflineQueue(message: string, errorLogId?: string) {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  await supabaseAdmin
    .from('telegram_message_queue')
    .insert({
      message,
      error_log_id: errorLogId,
      status: 'PENDING'
    });
}

async function sendTelegramMessage(message: string, retries = 0): Promise<boolean> {
  const maxRetries = 3;
  const backoffDelay = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
  
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }
    
    logStep('Mensagem enviada com sucesso ao Telegram');
    return true;
  } catch (error) {
    logStep(`Tentativa ${retries + 1}/${maxRetries} falhou`, error);
    
    if (retries < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return sendTelegramMessage(message, retries + 1);
    }
    
    return false;
  }
}

function formatTelegramMessage(errorData: any): string {
  const isUserPanelError = errorData?.metadata?.user_panel === true || errorData?.metadata?.userFacing === true;
  
  if (isUserPanelError) {
    // Formato especial para erros de painéis do usuário
    const panel = errorData.metadata?.panel || 'Desconhecido';
    const ip = errorData.metadata?.ip || 'N/A';
    const userAgent = errorData.metadata?.userAgent || 'N/A';
    const shortUA = userAgent.split(' ').slice(0, 3).join(' ');
    const maskedIP = ip !== 'N/A' ? ip.split('.').slice(0, 2).join('.') + '.***' : 'N/A';
    
    let message = `🚨 <b>ERRO NO PAINEL DO USUÁRIO</b>\n\n`;
    message += `<b>📍 Localização:</b>\n`;
    message += `  Rota: ${errorData.route || 'N/A'}\n`;
    message += `  Painel: ${panel}\n`;
    message += `  Componente: ${errorData.module || 'N/A'}\n\n`;
    
    message += `<b>❌ Erro:</b>\n`;
    message += `  Mensagem: ${errorData.errorMessage}\n`;
    if (errorData.errorCode) message += `  Código: ${errorData.errorCode}\n`;
    message += `  Categoria: ${errorData.errorCategory} / ${errorData.errorType}\n\n`;
    
    if (errorData.userId || errorData.userEmail) {
      message += `<b>👤 Usuário:</b>\n`;
      if (errorData.userEmail) message += `  Email: ${errorData.userEmail}\n`;
      if (errorData.userId) message += `  ID: ${errorData.userId.substring(0, 8)}...\n`;
      message += `\n`;
    }
    
    message += `<b>🌐 Contexto:</b>\n`;
    message += `  Navegador: ${shortUA}\n`;
    message += `  IP: ${maskedIP}\n`;
    message += `  Timestamp: ${errorData.metadata?.timestamp || new Date().toISOString()}\n\n`;
    
    if (errorData.errorStack) {
      const stackLines = errorData.errorStack.split('\n').slice(0, 10);
      message += `<b>📋 Stack (primeiras 10 linhas):</b>\n<pre>${stackLines.join('\n').substring(0, 500)}</pre>\n\n`;
    }
    
    if (errorData.autoCorrectionAttempted !== undefined) {
      message += `<b>🔧 Auto-correção:</b>\n`;
      message += `  Tentada: ${errorData.autoCorrectionAttempted ? 'Sim' : 'Não'}\n`;
      if (errorData.autoCorrectionAttempted) {
        message += `  Sucesso: ${errorData.autoCorrectionSuccess ? 'Sim' : 'Não'}\n`;
      }
      message += `\n`;
    }
    
    return message;
  }
  
  // Formato padrão para outros erros
  const categoryIcon = errorData.errorCategory === 'CRITICAL' ? '🔴' : '🟡';
  
  return `
🚨 <b>ERRO DETECTADO NO AGRIROUTE CONNECT</b>

📱 <b>Módulo:</b> ${errorData.module || 'N/A'}
⚙️ <b>Função:</b> ${errorData.functionName || 'N/A'}
${categoryIcon} <b>Categoria:</b> ${errorData.errorCategory}
💥 <b>Erro:</b> ${errorData.errorMessage.substring(0, 200)}${errorData.errorMessage.length > 200 ? '...' : ''}

${errorData.autoCorrectionAttempted ? `🔁 <b>Tentativa de correção:</b> SIM
   └─ Ação: ${errorData.autoCorrectionAction || 'N/A'}
   └─ Status: ${errorData.autoCorrectionSuccess ? 'SUCESSO' : 'FALHOU'}` : '🔁 <b>Tentativa de correção:</b> NÃO'}

🕒 <b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}
👤 <b>Usuário:</b> ${errorData.userEmail || 'Anônimo'}${errorData.userId ? ` (${errorData.userId.substring(0, 8)}...)` : ''}
📍 <b>Contexto:</b> ${errorData.route || 'N/A'}

🧩 <b>Status pós-correção:</b> ${errorData.status || 'NEW'}
${errorData.errorCode ? `📊 <b>Código:</b> ${errorData.errorCode}` : ''}
`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Função iniciada');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate - aceitar tanto usuário admin quanto service_role_key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // CORRIGIDO: Aceitar chamadas de outras Edge Functions via service_role_key
    const isServiceRoleCall = token === serviceRoleKey;
    
    if (isServiceRoleCall) {
      logStep('Chamada autorizada via service_role_key (Edge Function interna)');
    } else {
      // Verificar se é um usuário admin
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        });
      }

      // CORRIGIDO: Verificar role na tabela user_roles (não profiles.role)
      const { data: userRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasAdminRole = userRoles?.some(r => ['admin', 'moderator'].includes(r.role));

      if (rolesError || !hasAdminRole) {
        logStep('Acesso negado', { userId: user.id, roles: userRoles?.map(r => r.role) });
        return new Response(JSON.stringify({ error: 'Acesso negado - requer role admin ou moderator' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        });
      }

      logStep('Usuário autenticado como admin', { roles: userRoles?.map(r => r.role) });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não configurado');
    }

    const { errorData, errorLogId } = await req.json();
    logStep('Dados recebidos', { errorLogId, errorType: errorData?.errorType });

    const message = formatTelegramMessage(errorData);
    const sent = await sendTelegramMessage(message);

    if (!sent) {
      logStep('Salvando na fila offline');
      await saveToOfflineQueue(message, errorLogId);
      return new Response(JSON.stringify({ 
        success: false, 
        queued: true,
        message: 'Mensagem salva na fila para envio posterior' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202
      });
    }

    // Atualizar error_logs com telegram_notified
    if (errorLogId) {
      await supabaseAdmin
        .from('error_logs')
        .update({
          telegram_notified: true,
          telegram_sent_at: new Date().toISOString(),
          status: 'NOTIFIED'
        })
        .eq('id', errorLogId);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Mensagem enviada com sucesso ao Telegram'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
