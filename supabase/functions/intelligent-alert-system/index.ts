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
  console.log(`[INTELLIGENT-ALERT-SYSTEM] ${step}${detailsStr}`);
};

type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AlertType = 
  | 'SECRET_LEAK'
  | 'BRUTE_FORCE'
  | 'UNAUTHORIZED_ACCESS'
  | 'HIGH_ERROR_RATE'
  | 'BACKUP_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'SYSTEM_HEALTH'
  | 'CUSTOM';

interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  details?: Record<string, any>;
  source?: string;
  userId?: string;
  userEmail?: string;
  actionRequired?: boolean;
  autoResolve?: boolean;
}

const SEVERITY_EMOJI = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢'
};

const TYPE_EMOJI: Record<AlertType, string> = {
  SECRET_LEAK: '🔐',
  BRUTE_FORCE: '🔨',
  UNAUTHORIZED_ACCESS: '🚫',
  HIGH_ERROR_RATE: '📈',
  BACKUP_FAILURE: '💾',
  RATE_LIMIT_EXCEEDED: '⚡',
  SUSPICIOUS_ACTIVITY: '👁️',
  SYSTEM_HEALTH: '💓',
  CUSTOM: '📢'
};

function formatAlertMessage(alert: AlertPayload): string {
  const severityEmoji = SEVERITY_EMOJI[alert.severity];
  const typeEmoji = TYPE_EMOJI[alert.type] || '📢';
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

  let message = `${severityEmoji} <b>${alert.severity} ALERT - AgriRoute</b> ${severityEmoji}\n\n`;
  message += `${typeEmoji} <b>Tipo:</b> ${alert.type.replace(/_/g, ' ')}\n`;
  message += `📌 <b>Título:</b> ${alert.title}\n\n`;
  message += `📝 <b>Descrição:</b>\n${alert.message}\n\n`;

  if (alert.source) {
    message += `📍 <b>Origem:</b> ${alert.source}\n`;
  }

  if (alert.userId || alert.userEmail) {
    message += `👤 <b>Usuário:</b> ${alert.userEmail || 'N/A'} ${alert.userId ? `(${alert.userId.substring(0, 8)}...)` : ''}\n`;
  }

  if (alert.details && Object.keys(alert.details).length > 0) {
    message += `\n📋 <b>Detalhes:</b>\n`;
    for (const [key, value] of Object.entries(alert.details)) {
      message += `  • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
    }
  }

  message += `\n🕐 <b>Timestamp:</b> ${timestamp}`;

  if (alert.actionRequired) {
    message += `\n\n⚠️ <b>AÇÃO REQUERIDA</b>`;
  }

  return message;
}

async function sendTelegramAlert(message: string): Promise<boolean> {
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
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }

    return true;
  } catch (error) {
    logStep('Erro ao enviar Telegram', error);
    return false;
  }
}

async function checkDeduplication(
  supabase: any,
  alertType: string,
  alertMessage: string,
  windowMinutes: number = 30
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  // Check for similar recent alerts
  const { data: recentAlerts } = await supabase
    .from('error_logs')
    .select('id')
    .eq('error_type', alertType)
    .gte('created_at', windowStart.toISOString())
    .limit(1);

  return (recentAlerts?.length || 0) > 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Sistema de alertas inteligente iniciado');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const alertPayload: AlertPayload = await req.json();
    logStep('Alert recebido', { type: alertPayload.type, severity: alertPayload.severity });

    // Validate payload
    if (!alertPayload.type || !alertPayload.severity || !alertPayload.title || !alertPayload.message) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Payload inválido: type, severity, title e message são obrigatórios'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Check deduplication for non-critical alerts
    if (alertPayload.severity !== 'CRITICAL') {
      const isDuplicate = await checkDeduplication(
        supabaseAdmin,
        alertPayload.type,
        alertPayload.message
      );

      if (isDuplicate) {
        logStep('Alerta duplicado ignorado', { type: alertPayload.type });
        return new Response(JSON.stringify({
          success: true,
          deduplicated: true,
          message: 'Alerta similar já enviado recentemente'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }

    // Format and send alert
    const formattedMessage = formatAlertMessage(alertPayload);
    
    // Determine if should send to Telegram based on severity
    let telegramSent = false;
    if (alertPayload.severity === 'CRITICAL' || alertPayload.severity === 'HIGH') {
      telegramSent = await sendTelegramAlert(formattedMessage);
      logStep('Alerta enviado ao Telegram', { success: telegramSent });
    }

    // Log the alert to database
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('error_logs')
      .insert({
        error_type: alertPayload.type,
        error_category: alertPayload.severity,
        error_message: alertPayload.message,
        module: alertPayload.source || 'intelligent-alert-system',
        user_id: alertPayload.userId,
        user_email: alertPayload.userEmail,
        metadata: {
          title: alertPayload.title,
          details: alertPayload.details,
          actionRequired: alertPayload.actionRequired,
          autoResolve: alertPayload.autoResolve
        },
        telegram_notified: telegramSent,
        telegram_sent_at: telegramSent ? new Date().toISOString() : null,
        status: alertPayload.autoResolve ? 'AUTO_FIXED' : 'NEW'
      })
      .select()
      .single();

    if (logError) {
      logStep('Erro ao salvar log', logError);
    }

    // Create audit log entry
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'SECURITY_ALERT',
        table_name: 'error_logs',
        new_data: {
          alert_type: alertPayload.type,
          severity: alertPayload.severity,
          telegram_sent: telegramSent,
          log_id: logEntry?.id
        }
      });

    return new Response(JSON.stringify({
      success: true,
      alertId: logEntry?.id,
      telegramSent,
      severity: alertPayload.severity,
      message: 'Alerta processado com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
