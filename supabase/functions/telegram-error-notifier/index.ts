import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * TELEGRAM ERROR NOTIFIER
 * 
 * Função DEDICADA EXCLUSIVAMENTE para notificação de erros no Telegram.
 * - SEM deduplicação
 * - SEM auto-correção
 * - SEM verificação de autenticação (público)
 * - TODOS os erros são enviados imediatamente
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-skip-error-monitoring, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749'; // Supergroup AgriRoute

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TELEGRAM-ERROR-NOTIFIER] ${step}`, details ? JSON.stringify(details) : '');
};

/**
 * Escapa caracteres especiais para HTML do Telegram
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatErrorMessage(errorData: any): string {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  const categoryIcon = errorData.errorCategory === 'CRITICAL' ? '🔴' : '🟡';
  const typeIcon = {
    'FRONTEND': '🖥️',
    'BACKEND': '⚙️',
    'DATABASE': '🗄️',
    'NETWORK': '🌐',
    'PAYMENT': '💳',
    'WEBSOCKET': '📡'
  }[errorData.errorType] || '❓';

  let message = `🚨 <b>ERRO DETECTADO - AGRIROUTE</b>\n\n`;
  
  message += `${categoryIcon} <b>Categoria:</b> ${escapeHtml(errorData.errorCategory) || 'N/A'}\n`;
  message += `${typeIcon} <b>Tipo:</b> ${escapeHtml(errorData.errorType) || 'N/A'}\n\n`;
  
  message += `<b>📍 Localização:</b>\n`;
  message += `  • Rota: ${escapeHtml(errorData.route) || 'N/A'}\n`;
  message += `  • Módulo: ${escapeHtml(errorData.module) || 'N/A'}\n`;
  if (errorData.functionName) {
    message += `  • Função: ${escapeHtml(errorData.functionName)}\n`;
  }
  message += `\n`;
  
  message += `<b>💥 Erro:</b>\n`;
  const errorMsg = escapeHtml(errorData.errorMessage) || 'Mensagem não disponível';
  message += `<pre>${errorMsg.substring(0, 500)}${errorMsg.length > 500 ? '...' : ''}</pre>\n\n`;
  
  if (errorData.errorCode) {
    message += `<b>📊 Código:</b> ${escapeHtml(String(errorData.errorCode))}\n`;
  }
  
  if (errorData.userId || errorData.userEmail) {
    message += `<b>👤 Usuário:</b>\n`;
    if (errorData.userEmail) message += `  • Email: ${escapeHtml(errorData.userEmail)}\n`;
    if (errorData.userId) message += `  • ID: ${escapeHtml(errorData.userId.substring(0, 8))}...\n`;
    message += `\n`;
  }
  
  if (errorData.metadata) {
    const { userAgent, url } = errorData.metadata;
    if (userAgent || url) {
      message += `<b>🌐 Contexto:</b>\n`;
      if (url) message += `  • URL: ${escapeHtml(url)}\n`;
      if (userAgent) {
        const shortUA = userAgent.split(' ').slice(0, 3).join(' ');
        message += `  • Browser: ${escapeHtml(shortUA)}\n`;
      }
      message += `\n`;
    }
  }
  
  if (errorData.errorStack) {
    const stackLines = errorData.errorStack.split('\n').slice(0, 5);
    const escapedStack = escapeHtml(stackLines.join('\n')).substring(0, 300);
    message += `<b>📋 Stack:</b>\n<pre>${escapedStack}</pre>\n\n`;
  }
  
  message += `<b>⏰ Timestamp:</b> ${timestamp}`;
  
  return message;
}

async function sendToTelegram(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    logStep('TELEGRAM_BOT_TOKEN não configurado');
    return false;
  }

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
      const errorText = await response.text();
      logStep('Erro ao enviar para Telegram', { status: response.status, error: errorText });
      return false;
    }

    logStep('Mensagem enviada com sucesso ao Telegram');
    return true;
  } catch (error) {
    logStep('Exceção ao enviar para Telegram', { error: String(error) });
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  logStep('Função iniciada');

  try {
    const errorData = await req.json();
    logStep('Dados recebidos', { 
      type: errorData.errorType, 
      category: errorData.errorCategory,
      message: errorData.errorMessage?.substring(0, 100)
    });

    // ✅ Suporte a mensagens customizadas (ex: auto-heal reports)
    const message = errorData._customMessage 
      ? String(errorData._customMessage)
      : formatErrorMessage(errorData);
    const sent = await sendToTelegram(message);

    return new Response(JSON.stringify({ 
      success: sent,
      notified: sent,
      message: sent ? 'Erro notificado no Telegram' : 'Falha ao notificar (rate limit ou token ausente)'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // ✅ Always 200 - function ran correctly, delivery is best-effort
    });

  } catch (error) {
    logStep('ERRO na função', { error: String(error) });
    
    // Tentar notificar o erro da própria função
    const selfErrorMessage = `🔴 <b>ERRO NO NOTIFICADOR</b>\n\nA função telegram-error-notifier falhou:\n<pre>${String(error)}</pre>`;
    await sendToTelegram(selfErrorMessage);

    return new Response(JSON.stringify({ 
      success: false,
      error: String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
