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
  console.log(`[DAILY-SECURITY-REPORT] ${step}${detailsStr}`);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Gerando relatório diário de segurança');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all security metrics
    const [
      errors24h,
      errors7d,
      auditLogs,
      rateLimitViolations,
      blockedIPs,
      suspiciousProfiles,
      activeUsers
    ] = await Promise.all([
      supabase.from('error_logs').select('*', { count: 'exact' }).gte('created_at', yesterday.toISOString()),
      supabase.from('error_logs').select('*', { count: 'exact' }).gte('created_at', last7days.toISOString()),
      supabase.from('audit_logs').select('*').gte('timestamp', yesterday.toISOString()),
      supabase.from('rate_limit_violations').select('*', { count: 'exact' }).gte('created_at', yesterday.toISOString()),
      supabase.from('security_blacklist').select('*', { count: 'exact' }).eq('is_active', true),
      supabase.from('profiles').select('id').not('role', 'in', '(PRODUTOR,MOTORISTA,PRESTADOR_SERVICOS,TRANSPORTADORA,MOTORISTA_AFILIADO)'),
      supabase.from('profiles').select('id', { count: 'exact' }).gte('updated_at', yesterday.toISOString())
    ].map(p => supabaseAdmin.from(p.from).select(p.select, p.options || {}).then(r => r)));

    // Calculate metrics
    const totalErrors24h = errors24h.count || 0;
    const totalErrors7d = errors7d.count || 0;
    const avgErrorsPerDay = Math.round(totalErrors7d / 7);
    const criticalErrors = errors24h.data?.filter(e => e.error_category === 'CRITICAL').length || 0;
    const failedLogins = auditLogs.data?.filter(l => l.operation === 'LOGIN_FAILED').length || 0;
    const successfulLogins = auditLogs.data?.filter(l => l.operation === 'LOGIN_SUCCESS').length || 0;
    const adminOperations = auditLogs.data?.filter(l => ['DELETE', 'UPDATE_ROLE', 'GRANT_ADMIN'].includes(l.operation)).length || 0;

    // Calculate health score
    const baseScore = 100;
    const criticalPenalty = criticalErrors * 15;
    const errorPenalty = Math.max(0, totalErrors24h - avgErrorsPerDay) * 2;
    const violationPenalty = (rateLimitViolations.count || 0) * 1;
    const suspiciousPenalty = (suspiciousProfiles.data?.length || 0) * 20;
    const healthScore = Math.max(0, Math.min(100, baseScore - criticalPenalty - errorPenalty - violationPenalty - suspiciousPenalty));

    // Determine status emoji
    let statusEmoji = '🟢';
    let statusText = 'EXCELENTE';
    if (healthScore < 80) { statusEmoji = '🟡'; statusText = 'BOM'; }
    if (healthScore < 60) { statusEmoji = '🟠'; statusText = 'ATENÇÃO'; }
    if (healthScore < 40) { statusEmoji = '🔴'; statusText = 'CRÍTICO'; }

    // Build report message
    let report = `📊 <b>RELATÓRIO DIÁRIO DE SEGURANÇA</b>\n`;
    report += `<b>AgriRoute Connect</b>\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `${statusEmoji} <b>Status Geral:</b> ${statusText}\n`;
    report += `💯 <b>Score de Saúde:</b> ${healthScore}/100\n`;
    report += `📅 <b>Período:</b> ${yesterday.toLocaleDateString('pt-BR')} - ${now.toLocaleDateString('pt-BR')}\n\n`;

    report += `📈 <b>MÉTRICAS DE ERROS</b>\n`;
    report += `├ Total (24h): ${totalErrors24h}\n`;
    report += `├ Críticos: ${criticalErrors}\n`;
    report += `├ Média semanal: ${avgErrorsPerDay}/dia\n`;
    report += `└ Tendência: ${totalErrors24h > avgErrorsPerDay ? '📈 Acima' : totalErrors24h < avgErrorsPerDay ? '📉 Abaixo' : '➡️ Normal'}\n\n`;

    report += `🔐 <b>AUTENTICAÇÃO</b>\n`;
    report += `├ Logins bem-sucedidos: ${successfulLogins}\n`;
    report += `├ Logins falhos: ${failedLogins}\n`;
    report += `└ Taxa de sucesso: ${successfulLogins > 0 ? Math.round((successfulLogins / (successfulLogins + failedLogins)) * 100) : 100}%\n\n`;

    report += `🛡️ <b>SEGURANÇA</b>\n`;
    report += `├ IPs bloqueados: ${blockedIPs.count || 0}\n`;
    report += `├ Violações rate limit: ${rateLimitViolations.count || 0}\n`;
    report += `├ Perfis suspeitos: ${suspiciousProfiles.data?.length || 0}\n`;
    report += `└ Operações admin: ${adminOperations}\n\n`;

    report += `👥 <b>USUÁRIOS</b>\n`;
    report += `└ Ativos (24h): ${activeUsers.count || 0}\n\n`;

    // Add alerts section if there are issues
    if (criticalErrors > 0 || (suspiciousProfiles.data?.length || 0) > 0 || failedLogins > 20) {
      report += `⚠️ <b>ALERTAS</b>\n`;
      if (criticalErrors > 0) report += `├ 🔴 ${criticalErrors} erros críticos detectados\n`;
      if ((suspiciousProfiles.data?.length || 0) > 0) report += `├ 🔴 ${suspiciousProfiles.data?.length} perfis com roles inválidos\n`;
      if (failedLogins > 20) report += `├ 🟡 ${failedLogins} tentativas de login falhas\n`;
      report += `\n`;
    }

    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🕐 Gerado em: ${now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;

    // Send report
    const sent = await sendTelegramMessage(report);
    logStep('Relatório enviado', { sent, healthScore });

    // Log the report generation
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'DAILY_SECURITY_REPORT',
        table_name: 'system',
        new_data: {
          healthScore,
          totalErrors24h,
          criticalErrors,
          failedLogins,
          blockedIPs: blockedIPs.count || 0,
          suspiciousProfiles: suspiciousProfiles.data?.length || 0,
          reportSent: sent
        }
      });

    return new Response(JSON.stringify({
      success: true,
      healthScore,
      metrics: {
        totalErrors24h,
        criticalErrors,
        failedLogins,
        successfulLogins,
        blockedIPs: blockedIPs.count || 0,
        rateLimitViolations: rateLimitViolations.count || 0,
        suspiciousProfiles: suspiciousProfiles.data?.length || 0,
        adminOperations,
        activeUsers: activeUsers.count || 0
      },
      reportSent: sent
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
