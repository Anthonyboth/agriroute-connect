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
  console.log(`[HOURLY-SECURITY-REPORT] ${step}${detailsStr}`);
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
    
    if (!response.ok) {
      const errorText = await response.text();
      logStep('Erro na API do Telegram', { status: response.status, error: errorText });
      return false;
    }
    
    return true;
  } catch (error) {
    logStep('Erro ao enviar Telegram', error);
    return false;
  }
}

type Status = 'NORMAL' | 'ATENCAO' | 'CRITICO';

interface SecurityMetric {
  name: string;
  value: number;
  status: Status;
  details?: string;
}

function getStatusEmoji(status: Status): string {
  switch (status) {
    case 'CRITICO': return '🔴';
    case 'ATENCAO': return '🟡';
    case 'NORMAL': return '🟢';
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    logStep('Iniciando relatório horário de segurança');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cuiabaTime = now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

    const metrics: SecurityMetric[] = [];
    let hasWarning = false;
    let hasCritical = false;

    // 1. Tentativas de login falhas (última 1h)
    logStep('Verificando logins falhos');
    const { data: failedLogins1h } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('operation', 'LOGIN_FAILED')
      .gte('timestamp', oneHourAgo.toISOString());

    const failedLoginsCount = failedLogins1h?.length || 0;
    let loginStatus: Status = 'NORMAL';
    if (failedLoginsCount > 20) { loginStatus = 'CRITICO'; hasCritical = true; }
    else if (failedLoginsCount > 5) { loginStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Logins Falhos (1h)',
      value: failedLoginsCount,
      status: loginStatus
    });

    // 2. Usuários com muitas tentativas falhas (> 3 por hora)
    const userFailures: Record<string, number> = {};
    failedLogins1h?.forEach(log => {
      const userId = log.user_id || log.new_data?.email || 'unknown';
      userFailures[userId] = (userFailures[userId] || 0) + 1;
    });
    const usersWithManyFailures = Object.entries(userFailures).filter(([_, count]) => count >= 3);
    
    let bruteForceStatus: Status = 'NORMAL';
    if (usersWithManyFailures.length > 3) { bruteForceStatus = 'CRITICO'; hasCritical = true; }
    else if (usersWithManyFailures.length > 0) { bruteForceStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Usuários com +3 Falhas',
      value: usersWithManyFailures.length,
      status: bruteForceStatus,
      details: usersWithManyFailures.length > 0 ? usersWithManyFailures.slice(0, 3).map(([u, c]) => `${u.substring(0, 20)}... (${c}x)`).join(', ') : undefined
    });

    // 3. Novas contas criadas (última 1h)
    logStep('Verificando novas contas');
    const { data: newAccounts } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, created_at')
      .gte('created_at', oneHourAgo.toISOString());

    const newAccountsCount = newAccounts?.length || 0;
    let newAccountsStatus: Status = 'NORMAL';
    if (newAccountsCount > 20) { newAccountsStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Novas Contas (1h)',
      value: newAccountsCount,
      status: newAccountsStatus,
      details: newAccounts?.slice(0, 3).map(a => a.role).join(', ')
    });

    // 4. Tentativas de acesso negadas por RLS (última 1h)
    logStep('Verificando acessos negados por RLS');
    const { data: accessDenied } = await supabaseAdmin
      .from('access_denied_logs')
      .select('*')
      .gte('created_at', oneHourAgo.toISOString());

    const accessDeniedCount = accessDenied?.length || 0;
    let rlsStatus: Status = 'NORMAL';
    if (accessDeniedCount > 10) { rlsStatus = 'CRITICO'; hasCritical = true; }
    else if (accessDeniedCount > 3) { rlsStatus = 'ATENCAO'; hasWarning = true; }

    // Agrupar por tabela
    const deniedByTable: Record<string, number> = {};
    accessDenied?.forEach(log => {
      const route = log.attempted_route || 'unknown';
      deniedByTable[route] = (deniedByTable[route] || 0) + 1;
    });

    metrics.push({
      name: 'Acessos Negados (RLS)',
      value: accessDeniedCount,
      status: rlsStatus,
      details: Object.entries(deniedByTable).slice(0, 3).map(([r, c]) => `${r}: ${c}`).join(', ') || undefined
    });

    // 5. Chamadas a edge functions sensíveis (admin, fiscal, pagamentos)
    logStep('Verificando chamadas a funções sensíveis');
    const { data: sensitiveErrors } = await supabaseAdmin
      .from('error_logs')
      .select('function_name, error_category')
      .gte('created_at', oneHourAgo.toISOString())
      .or('function_name.ilike.%admin%,function_name.ilike.%fiscal%,function_name.ilike.%payment%,function_name.ilike.%checkout%,function_name.ilike.%payout%');

    const sensitiveErrorsCount = sensitiveErrors?.length || 0;
    let sensitiveStatus: Status = 'NORMAL';
    if (sensitiveErrorsCount > 10) { sensitiveStatus = 'CRITICO'; hasCritical = true; }
    else if (sensitiveErrorsCount > 3) { sensitiveStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Erros Funções Sensíveis',
      value: sensitiveErrorsCount,
      status: sensitiveStatus
    });

    // 6. Alterações críticas de perfil
    logStep('Verificando alterações críticas de perfil');
    const { data: criticalChanges } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .gte('timestamp', oneHourAgo.toISOString())
      .or('operation.eq.UPDATE_ROLE,operation.eq.CHANGE_EMAIL,operation.eq.PASSWORD_RESET,operation.ilike.%role%,operation.ilike.%password%');

    const criticalChangesCount = criticalChanges?.length || 0;
    let changesStatus: Status = 'NORMAL';
    if (criticalChangesCount > 5) { changesStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Alterações Críticas Perfil',
      value: criticalChangesCount,
      status: changesStatus,
      details: criticalChanges?.slice(0, 3).map(c => c.operation).join(', ') || undefined
    });

    // 7. Detecção de duplicados (CPF/CNPJ, telefone, email)
    logStep('Verificando duplicados');
    
    // Duplicados por CPF/CNPJ
    const { data: duplicateDocs } = await supabaseAdmin
      .rpc('find_duplicate_documents');
    const duplicateDocsCount = duplicateDocs?.length || 0;

    // Duplicados por telefone
    const { data: duplicatePhones } = await supabaseAdmin
      .rpc('find_duplicate_phones');
    const duplicatePhonesCount = duplicatePhones?.length || 0;

    // Duplicados por email
    const { data: duplicateEmails } = await supabaseAdmin
      .rpc('find_duplicate_emails');
    const duplicateEmailsCount = duplicateEmails?.length || 0;

    const totalDuplicates = duplicateDocsCount + duplicatePhonesCount + duplicateEmailsCount;
    let duplicatesStatus: Status = 'NORMAL';
    if (totalDuplicates > 5) { duplicatesStatus = 'CRITICO'; hasCritical = true; }
    else if (totalDuplicates > 0) { duplicatesStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Perfis Duplicados',
      value: totalDuplicates,
      status: duplicatesStatus,
      details: `CPF/CNPJ: ${duplicateDocsCount}, Tel: ${duplicatePhonesCount}, Email: ${duplicateEmailsCount}`
    });

    // 8. Acesso administrativo indevido
    logStep('Verificando acessos admin');
    const { data: adminAccess } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .gte('timestamp', oneHourAgo.toISOString())
      .or('operation.ilike.%admin%,operation.eq.GRANT_ADMIN,operation.eq.DELETE');

    const adminAccessCount = adminAccess?.length || 0;
    let adminStatus: Status = 'NORMAL';
    if (adminAccessCount > 10) { adminStatus = 'CRITICO'; hasCritical = true; }
    else if (adminAccessCount > 3) { adminStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'Operações Admin',
      value: adminAccessCount,
      status: adminStatus
    });

    // 9. Perfis com roles inválidos
    logStep('Verificando roles inválidos');
    const { data: invalidRoles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .not('role', 'in', '(PRODUTOR,MOTORISTA,PRESTADOR_SERVICOS,TRANSPORTADORA,MOTORISTA_AFILIADO)');

    const invalidRolesCount = invalidRoles?.length || 0;
    let rolesStatus: Status = 'NORMAL';
    if (invalidRolesCount > 0) { rolesStatus = 'CRITICO'; hasCritical = true; }

    metrics.push({
      name: 'Roles Inválidos',
      value: invalidRolesCount,
      status: rolesStatus,
      details: invalidRoles?.slice(0, 3).map(r => `${r.role}`).join(', ') || undefined
    });

    // 10. Rate limit violations
    logStep('Verificando rate limit');
    const { data: rateLimitViolations } = await supabaseAdmin
      .from('api_rate_limits')
      .select('*')
      .not('blocked_until', 'is', null)
      .gte('blocked_until', now.toISOString());

    const blockedCount = rateLimitViolations?.length || 0;
    let rateStatus: Status = 'NORMAL';
    if (blockedCount > 10) { rateStatus = 'ATENCAO'; hasWarning = true; }

    metrics.push({
      name: 'IPs/Usuários Bloqueados',
      value: blockedCount,
      status: rateStatus
    });

    // Calculate health score
    const criticalCount = metrics.filter(m => m.status === 'CRITICO').length;
    const warningCount = metrics.filter(m => m.status === 'ATENCAO').length;
    const healthScore = Math.max(0, 100 - (criticalCount * 25) - (warningCount * 10));

    // Determine overall status
    let overallStatus = '🟢 NORMAL';
    if (hasCritical) overallStatus = '🔴 CRÍTICO';
    else if (hasWarning) overallStatus = '🟡 ATENÇÃO';

    // Build Telegram message
    let message = `🔐 <b>SECURITY STATUS - AgriRoute</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📊 <b>Status:</b> ${overallStatus}\n`;
    message += `💯 <b>Score:</b> ${healthScore}/100\n`;
    message += `🕐 <b>Período:</b> Última 1 hora\n\n`;

    // Group metrics by status
    const criticalMetrics = metrics.filter(m => m.status === 'CRITICO');
    const warningMetrics = metrics.filter(m => m.status === 'ATENCAO');
    const normalMetrics = metrics.filter(m => m.status === 'NORMAL');

    if (criticalMetrics.length > 0) {
      message += `🔴 <b>CRÍTICO (${criticalMetrics.length}):</b>\n`;
      criticalMetrics.forEach(m => {
        message += `├ ${m.name}: <b>${m.value}</b>`;
        if (m.details) message += ` (${m.details})`;
        message += `\n`;
      });
      message += `\n`;
    }

    if (warningMetrics.length > 0) {
      message += `🟡 <b>ATENÇÃO (${warningMetrics.length}):</b>\n`;
      warningMetrics.forEach(m => {
        message += `├ ${m.name}: <b>${m.value}</b>`;
        if (m.details) message += ` (${m.details})`;
        message += `\n`;
      });
      message += `\n`;
    }

    message += `🟢 <b>NORMAL (${normalMetrics.length}):</b>\n`;
    normalMetrics.forEach(m => {
      message += `├ ${m.name}: ${m.value}\n`;
    });

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⏱️ Gerado em: ${cuiabaTime}`;

    // Send to Telegram
    const sent = await sendTelegramMessage(message);
    logStep('Relatório enviado', { sent, healthScore, metrics: metrics.length });

    // Log to audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'HOURLY_SECURITY_REPORT',
        table_name: 'system',
        new_data: {
          healthScore,
          criticalCount,
          warningCount,
          metrics,
          executionTime: Date.now() - startTime,
          reportSent: sent
        }
      });

    return new Response(JSON.stringify({
      success: true,
      healthScore,
      criticalCount,
      warningCount,
      metrics,
      reportSent: sent,
      executionTime: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
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
