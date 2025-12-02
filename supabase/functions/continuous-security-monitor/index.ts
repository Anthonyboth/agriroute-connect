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
  console.log(`[CONTINUOUS-SECURITY-MONITOR] ${step}${detailsStr}`);
};

async function sendTelegramMessage(message: string): Promise<boolean> {
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
    return response.ok;
  } catch (error) {
    logStep('Erro ao enviar Telegram', error);
    return false;
  }
}

interface SecurityCheckResult {
  check: string;
  status: 'OK' | 'WARNING' | 'CRITICAL';
  details: string;
  count?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Iniciando monitoramento contínuo de segurança');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const results: SecurityCheckResult[] = [];

    // 1. Check error logs (last hour)
    const { data: recentErrors, error: errorsError } = await supabaseAdmin
      .from('error_logs')
      .select('*')
      .gte('created_at', lastHour.toISOString());

    if (!errorsError) {
      const criticalErrors = recentErrors?.filter(e => e.error_category === 'CRITICAL') || [];
      if (criticalErrors.length > 0) {
        results.push({
          check: 'Erros Críticos',
          status: 'CRITICAL',
          details: `${criticalErrors.length} erros críticos na última hora`,
          count: criticalErrors.length
        });
      } else if ((recentErrors?.length || 0) > 10) {
        results.push({
          check: 'Volume de Erros',
          status: 'WARNING',
          details: `${recentErrors?.length} erros na última hora (acima do normal)`,
          count: recentErrors?.length
        });
      } else {
        results.push({
          check: 'Erros',
          status: 'OK',
          details: `${recentErrors?.length || 0} erros na última hora`,
          count: recentErrors?.length || 0
        });
      }
    }

    // 2. Check failed login attempts (last 24h)
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('operation', 'LOGIN_FAILED')
      .gte('timestamp', last24h.toISOString());

    const failedLogins = auditLogs?.length || 0;
    if (failedLogins > 50) {
      results.push({
        check: 'Logins Falhos',
        status: 'CRITICAL',
        details: `${failedLogins} tentativas de login falhas em 24h (possível ataque)`,
        count: failedLogins
      });
    } else if (failedLogins > 20) {
      results.push({
        check: 'Logins Falhos',
        status: 'WARNING',
        details: `${failedLogins} tentativas de login falhas em 24h`,
        count: failedLogins
      });
    } else {
      results.push({
        check: 'Logins Falhos',
        status: 'OK',
        details: `${failedLogins} tentativas em 24h`,
        count: failedLogins
      });
    }

    // 3. Check rate limit violations
    const { data: rateLimitViolations } = await supabaseAdmin
      .from('rate_limit_violations')
      .select('*')
      .gte('created_at', last24h.toISOString());

    const violations = rateLimitViolations?.length || 0;
    if (violations > 100) {
      results.push({
        check: 'Rate Limit',
        status: 'CRITICAL',
        details: `${violations} violações de rate limit em 24h`,
        count: violations
      });
    } else if (violations > 20) {
      results.push({
        check: 'Rate Limit',
        status: 'WARNING',
        details: `${violations} violações em 24h`,
        count: violations
      });
    } else {
      results.push({
        check: 'Rate Limit',
        status: 'OK',
        details: `${violations} violações em 24h`,
        count: violations
      });
    }

    // 4. Check blocked IPs
    const { data: blockedIPs } = await supabaseAdmin
      .from('security_blacklist')
      .select('*')
      .eq('is_active', true);

    results.push({
      check: 'IPs Bloqueados',
      status: (blockedIPs?.length || 0) > 10 ? 'WARNING' : 'OK',
      details: `${blockedIPs?.length || 0} IPs ativos na blacklist`,
      count: blockedIPs?.length || 0
    });

    // 5. Check for unusual admin activity
    const { data: adminActivity } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .gte('timestamp', lastHour.toISOString())
      .in('operation', ['DELETE', 'UPDATE_ROLE', 'GRANT_ADMIN']);

    if ((adminActivity?.length || 0) > 5) {
      results.push({
        check: 'Atividade Admin',
        status: 'WARNING',
        details: `${adminActivity?.length} operações admin na última hora`,
        count: adminActivity?.length
      });
    } else {
      results.push({
        check: 'Atividade Admin',
        status: 'OK',
        details: `${adminActivity?.length || 0} operações admin`,
        count: adminActivity?.length || 0
      });
    }

    // 6. Check for suspicious profiles (invalid roles)
    const { data: suspiciousProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .not('role', 'in', '(PRODUTOR,MOTORISTA,PRESTADOR_SERVICOS,TRANSPORTADORA,MOTORISTA_AFILIADO)');

    if ((suspiciousProfiles?.length || 0) > 0) {
      results.push({
        check: 'Perfis Suspeitos',
        status: 'CRITICAL',
        details: `${suspiciousProfiles?.length} perfis com roles inválidos detectados`,
        count: suspiciousProfiles?.length
      });
    } else {
      results.push({
        check: 'Perfis',
        status: 'OK',
        details: 'Todos os perfis com roles válidos',
        count: 0
      });
    }

    // Calculate health score
    const criticalCount = results.filter(r => r.status === 'CRITICAL').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;
    const healthScore = Math.max(0, 100 - (criticalCount * 25) - (warningCount * 10));

    logStep('Verificações concluídas', { results: results.length, healthScore });

    // Send alert if there are critical issues
    const criticalResults = results.filter(r => r.status === 'CRITICAL');
    const warningResults = results.filter(r => r.status === 'WARNING');

    if (criticalResults.length > 0 || warningResults.length > 0) {
      let alertMessage = `🔒 <b>MONITORAMENTO DE SEGURANÇA - AgriRoute</b>\n\n`;
      alertMessage += `📊 <b>Score de Saúde:</b> ${healthScore}/100\n`;
      alertMessage += `🕐 <b>Timestamp:</b> ${now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}\n\n`;

      if (criticalResults.length > 0) {
        alertMessage += `🔴 <b>PROBLEMAS CRÍTICOS (${criticalResults.length}):</b>\n`;
        criticalResults.forEach(r => {
          alertMessage += `  • ${r.check}: ${r.details}\n`;
        });
        alertMessage += `\n`;
      }

      if (warningResults.length > 0) {
        alertMessage += `🟡 <b>AVISOS (${warningResults.length}):</b>\n`;
        warningResults.forEach(r => {
          alertMessage += `  • ${r.check}: ${r.details}\n`;
        });
      }

      alertMessage += `\n📱 Acesse o Dashboard de Segurança para mais detalhes.`;

      await sendTelegramMessage(alertMessage);
    }

    // Log the security check
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'SECURITY_CHECK',
        table_name: 'system',
        new_data: {
          results,
          healthScore,
          timestamp: now.toISOString()
        }
      });

    return new Response(JSON.stringify({
      success: true,
      healthScore,
      results,
      criticalCount,
      warningCount,
      timestamp: now.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    // Send error alert to Telegram
    const errorMessage = `🚨 <b>ERRO NO MONITORAMENTO DE SEGURANÇA</b>\n\n❌ ${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
    await sendTelegramMessage(errorMessage);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
