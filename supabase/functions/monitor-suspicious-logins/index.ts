import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MONITOR-SUSPICIOUS-LOGINS] ${step}${detailsStr}`);
};

async function sendTelegramAlert(message: string): Promise<boolean> {
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
    return response.ok;
  } catch (error) {
    logStep('Erro ao enviar Telegram', error);
    return false;
  }
}

function formatSuspiciousLoginAlert(suspiciousActivity: any): string {
  let message = `🚨 <b>ATIVIDADE DE LOGIN SUSPEITA DETECTADA</b>\n\n`;
  
  if (suspiciousActivity.multipleFailedAttempts?.length > 0) {
    message += `❌ <b>Múltiplas Falhas de Login:</b>\n`;
    suspiciousActivity.multipleFailedAttempts.forEach((attempt: any) => {
      message += `   👤 Email: ${attempt.email}\n`;
      message += `   🔢 Tentativas: ${attempt.failed_count} (última hora)\n`;
      message += `   🌐 IP: ${attempt.ip_addresses.join(', ')}\n\n`;
    });
  }

  if (suspiciousActivity.multipleIPs?.length > 0) {
    message += `🌍 <b>Múltiplos IPs (mesmo usuário):</b>\n`;
    suspiciousActivity.multipleIPs.forEach((activity: any) => {
      message += `   👤 Email: ${activity.email}\n`;
      message += `   🔢 IPs diferentes: ${activity.ip_count}\n`;
      message += `   🌐 IPs: ${activity.ip_addresses.join(', ')}\n\n`;
    });
  }

  if (suspiciousActivity.unusualHours?.length > 0) {
    message += `🌙 <b>Logins em Horários Incomuns:</b>\n`;
    suspiciousActivity.unusualHours.forEach((login: any) => {
      const hour = new Date(login.created_at).getHours();
      message += `   👤 Email: ${login.email}\n`;
      message += `   ⏰ Horário: ${hour}:00 (madrugada)\n`;
      message += `   🌐 IP: ${login.ip_address}\n\n`;
    });
  }

  message += `\n🔍 <b>Ação Requerida:</b>\n`;
  message += `   • Investigar contas listadas\n`;
  message += `   • Verificar se são atividades legítimas\n`;
  message += `   • Considerar bloqueio temporário se necessário\n\n`;
  message += `⏰ Verificação realizada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
  
  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Iniciando monitoramento de logins suspeitos');

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não configurado');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // 1. Detectar múltiplas falhas de login
    logStep('Verificando múltiplas falhas de login');
    
    const { data: failedAttempts, error: failedError } = await supabaseAdmin
      .rpc('get_failed_login_attempts', { 
        since_timestamp: oneHourAgo,
        min_failures: 3
      });

    if (failedError) {
      logStep('Erro ao buscar tentativas falhas', failedError);
    }

    // 2. Detectar múltiplos IPs para o mesmo usuário
    logStep('Verificando múltiplos IPs');
    
    const { data: multipleIPs, error: ipError } = await supabaseAdmin
      .rpc('get_multiple_ip_logins', {
        since_timestamp: sixHoursAgo,
        min_ip_count: 3
      });

    if (ipError) {
      logStep('Erro ao buscar múltiplos IPs', ipError);
    }

    // 3. Detectar logins em horários incomuns (madrugada: 2h-6h)
    logStep('Verificando logins em horários incomuns');
    
    const { data: unusualHours, error: hoursError } = await supabaseAdmin
      .rpc('get_unusual_hour_logins', {
        since_timestamp: oneHourAgo,
        start_hour: 2,
        end_hour: 6
      });

    if (hoursError) {
      logStep('Erro ao buscar logins em horários incomuns', hoursError);
    }

    const suspiciousActivity = {
      multipleFailedAttempts: failedAttempts || [],
      multipleIPs: multipleIPs || [],
      unusualHours: unusualHours || []
    };

    const totalSuspicious = 
      suspiciousActivity.multipleFailedAttempts.length +
      suspiciousActivity.multipleIPs.length +
      suspiciousActivity.unusualHours.length;

    logStep('Atividades suspeitas encontradas', { total: totalSuspicious });

    // Enviar alerta se houver atividade suspeita
    if (totalSuspicious > 0 && TELEGRAM_BOT_TOKEN) {
      const message = formatSuspiciousLoginAlert(suspiciousActivity);
      await sendTelegramAlert(message);
    }

    return new Response(JSON.stringify({ 
      success: true,
      suspiciousActivity,
      totalSuspicious,
      summary: {
        multipleFailures: suspiciousActivity.multipleFailedAttempts.length,
        multipleIPs: suspiciousActivity.multipleIPs.length,
        unusualHours: suspiciousActivity.unusualHours.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    if (TELEGRAM_BOT_TOKEN) {
      const errorMessage = `🚨 <b>ERRO NO MONITORAMENTO DE LOGINS</b>\n\n` +
        `❌ <b>Erro:</b> ${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n` +
        `⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
      
      await sendTelegramAlert(errorMessage);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
