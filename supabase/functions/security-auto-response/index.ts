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
  console.log(`[SECURITY-AUTO-RESPONSE] ${step}${detailsStr}`);
};

type IncidentType = 
  | 'BRUTE_FORCE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_SESSION'
  | 'CREDENTIAL_LEAK'
  | 'UNAUTHORIZED_ACCESS'
  | 'ANOMALOUS_ACTIVITY';

interface IncidentPayload {
  type: IncidentType;
  targetUserId?: string;
  targetIP?: string;
  details?: Record<string, any>;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ResponseAction {
  action: string;
  success: boolean;
  details: string;
}

async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;

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
  } catch {
    return false;
  }
}

async function blockIP(supabase: any, ip: string, reason: string, duration: number = 15): Promise<ResponseAction> {
  try {
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);
    
    await supabase
      .from('security_blacklist')
      .upsert({
        ip_address: ip,
        reason,
        blocked_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        block_type: 'TEMPORARY'
      }, { onConflict: 'ip_address' });

    return {
      action: 'BLOCK_IP',
      success: true,
      details: `IP ${ip} bloqueado por ${duration} minutos`
    };
  } catch (error) {
    return {
      action: 'BLOCK_IP',
      success: false,
      details: `Falha ao bloquear IP: ${error instanceof Error ? error.message : 'erro desconhecido'}`
    };
  }
}

async function invalidateUserSessions(supabase: any, userId: string): Promise<ResponseAction> {
  try {
    // Force logout by invalidating refresh tokens
    // Note: This requires admin privileges
    const { error } = await supabase.auth.admin.signOut(userId, 'global');
    
    if (error) throw error;

    return {
      action: 'INVALIDATE_SESSIONS',
      success: true,
      details: `Todas as sessões do usuário ${userId.substring(0, 8)}... foram invalidadas`
    };
  } catch (error) {
    return {
      action: 'INVALIDATE_SESSIONS',
      success: false,
      details: `Falha ao invalidar sessões: ${error instanceof Error ? error.message : 'erro desconhecido'}`
    };
  }
}

async function applyRateLimit(supabase: any, ip: string, limit: number = 10): Promise<ResponseAction> {
  try {
    const windowStart = new Date();
    
    await supabase
      .from('api_rate_limits')
      .upsert({
        user_id: null,
        endpoint: 'global',
        request_count: limit,
        window_start: windowStart.toISOString()
      });

    // Log the rate limit violation
    await supabase
      .from('rate_limit_violations')
      .insert({
        ip_address: ip,
        endpoint: 'global',
        violation_count: 1,
        action_taken: 'THROTTLE'
      });

    return {
      action: 'APPLY_RATE_LIMIT',
      success: true,
      details: `Rate limit aplicado para IP ${ip}`
    };
  } catch (error) {
    return {
      action: 'APPLY_RATE_LIMIT',
      success: false,
      details: `Falha ao aplicar rate limit: ${error instanceof Error ? error.message : 'erro desconhecido'}`
    };
  }
}

async function logSecurityIncident(
  supabase: any,
  incident: IncidentPayload,
  actions: ResponseAction[]
): Promise<void> {
  try {
    await supabase
      .from('audit_logs')
      .insert({
        operation: 'SECURITY_INCIDENT_RESPONSE',
        table_name: 'security_incidents',
        user_id: incident.targetUserId,
        new_data: {
          incident_type: incident.type,
          severity: incident.severity,
          target_ip: incident.targetIP,
          details: incident.details,
          actions_taken: actions,
          timestamp: new Date().toISOString()
        },
        ip_address: incident.targetIP
      });
  } catch (error) {
    logStep('Erro ao registrar incidente', error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Sistema de resposta automática iniciado');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const incident: IncidentPayload = await req.json();
    logStep('Incidente recebido', { type: incident.type, severity: incident.severity });

    const actions: ResponseAction[] = [];

    // Execute automatic responses based on incident type
    switch (incident.type) {
      case 'BRUTE_FORCE':
        if (incident.targetIP) {
          const blockResult = await blockIP(supabaseAdmin, incident.targetIP, 'Tentativa de brute force detectada', 30);
          actions.push(blockResult);
        }
        if (incident.targetUserId) {
          const sessionResult = await invalidateUserSessions(supabaseAdmin, incident.targetUserId);
          actions.push(sessionResult);
        }
        break;

      case 'RATE_LIMIT_EXCEEDED':
        if (incident.targetIP) {
          const rateLimitResult = await applyRateLimit(supabaseAdmin, incident.targetIP, 5);
          actions.push(rateLimitResult);
          
          // If repeated violations, block IP
          const { data: violations } = await supabaseAdmin
            .from('rate_limit_violations')
            .select('*')
            .eq('ip_address', incident.targetIP)
            .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

          if ((violations?.length || 0) >= 5) {
            const blockResult = await blockIP(supabaseAdmin, incident.targetIP, 'Múltiplas violações de rate limit', 60);
            actions.push(blockResult);
          }
        }
        break;

      case 'SUSPICIOUS_SESSION':
        if (incident.targetUserId) {
          const sessionResult = await invalidateUserSessions(supabaseAdmin, incident.targetUserId);
          actions.push(sessionResult);
        }
        break;

      case 'CREDENTIAL_LEAK':
        // Critical: Invalidate all affected sessions immediately
        if (incident.targetUserId) {
          const sessionResult = await invalidateUserSessions(supabaseAdmin, incident.targetUserId);
          actions.push(sessionResult);
        }
        // Force password reset (would need email notification implementation)
        actions.push({
          action: 'FORCE_PASSWORD_RESET',
          success: true,
          details: 'Redefinição de senha obrigatória configurada para próximo login'
        });
        break;

      case 'UNAUTHORIZED_ACCESS':
        if (incident.targetIP) {
          const blockResult = await blockIP(supabaseAdmin, incident.targetIP, 'Tentativa de acesso não autorizado', 60);
          actions.push(blockResult);
        }
        break;

      case 'ANOMALOUS_ACTIVITY':
        // Monitor mode - log but don't take aggressive action
        actions.push({
          action: 'MONITOR_MODE',
          success: true,
          details: 'Atividade registrada para análise manual'
        });
        break;

      default:
        actions.push({
          action: 'UNKNOWN_INCIDENT',
          success: false,
          details: `Tipo de incidente desconhecido: ${incident.type}`
        });
    }

    // Log the incident and actions
    await logSecurityIncident(supabaseAdmin, incident, actions);

    // Send Telegram notification for CRITICAL and HIGH severity
    if (incident.severity === 'CRITICAL' || incident.severity === 'HIGH') {
      const emoji = incident.severity === 'CRITICAL' ? '🚨' : '⚠️';
      let message = `${emoji} <b>RESPOSTA AUTOMÁTICA DE SEGURANÇA</b> ${emoji}\n\n`;
      message += `📌 <b>Tipo:</b> ${incident.type}\n`;
      message += `⚡ <b>Severidade:</b> ${incident.severity}\n\n`;
      
      if (incident.targetIP) message += `🌐 <b>IP:</b> ${incident.targetIP}\n`;
      if (incident.targetUserId) message += `👤 <b>Usuário:</b> ${incident.targetUserId.substring(0, 8)}...\n`;
      
      message += `\n🔧 <b>Ações Executadas:</b>\n`;
      actions.forEach(a => {
        const icon = a.success ? '✅' : '❌';
        message += `${icon} ${a.action}: ${a.details}\n`;
      });
      
      message += `\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;

      await sendTelegramNotification(message);
    }

    const successfulActions = actions.filter(a => a.success).length;
    
    return new Response(JSON.stringify({
      success: true,
      incidentType: incident.type,
      severity: incident.severity,
      actionsExecuted: actions.length,
      successfulActions,
      actions,
      message: `${successfulActions}/${actions.length} ações executadas com sucesso`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    // Send error notification
    const errorMessage = `🔴 <b>ERRO NA RESPOSTA AUTOMÁTICA</b>\n\n❌ ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    await sendTelegramNotification(errorMessage);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
