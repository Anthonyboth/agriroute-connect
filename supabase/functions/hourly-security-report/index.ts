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

type Status = 'OK' | 'ATENCAO' | 'CRITICO';

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
    const cuiabaTime = now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

    let overallStatus: Status = 'OK';
    const issues: string[] = [];

    // ==========================================
    // 1. TOTAL DE USUÁRIOS ATIVOS
    // ==========================================
    logStep('Contando usuários ativos');
    const { count: totalActiveUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('status', ['APPROVED', 'ACTIVE']);

    // ==========================================
    // 2. PERFIS POR ROLE
    // ==========================================
    logStep('Contando perfis por role');
    
    const { count: totalProdutores } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'PRODUTOR');

    const { count: totalMotoristas } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'MOTORISTA');

    const { count: totalMotoristasAfiliados } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'MOTORISTA_AFILIADO');

    const { count: totalPrestadores } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'PRESTADOR_SERVICOS');

    const { count: totalTransportadoras } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'TRANSPORTADORA');

    // ==========================================
    // 3. PERFIS PENDENTES DE APROVAÇÃO
    // ==========================================
    logStep('Verificando perfis pendentes');
    const { count: pendingApproval } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // Pendentes há mais de 24h (crítico)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { count: pendingOver24h } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .lt('created_at', oneDayAgo.toISOString());

    if ((pendingOver24h || 0) > 0) {
      overallStatus = 'CRITICO';
      issues.push(`${pendingOver24h} perfis pendentes há +24h`);
    } else if ((pendingApproval || 0) > 10) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${pendingApproval} perfis aguardando aprovação`);
    }

    // ==========================================
    // 4. PERFIS BLOQUEADOS
    // ==========================================
    logStep('Verificando perfis bloqueados');
    const { count: blockedProfiles } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('status', ['BLOCKED', 'SUSPENDED', 'BANNED']);

    // ==========================================
    // 5. PERFIS COM ROLE INCONSISTENTE
    // ==========================================
    logStep('Verificando roles inconsistentes');
    const validRoles = ['PRODUTOR', 'MOTORISTA', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'];
    const { data: invalidRoleProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .not('role', 'in', `(${validRoles.join(',')})`);

    const invalidRolesCount = invalidRoleProfiles?.length || 0;
    if (invalidRolesCount > 0) {
      overallStatus = 'CRITICO';
      issues.push(`${invalidRolesCount} perfis com role inválido`);
    }

    // ==========================================
    // 6. TENTATIVAS DE LOGIN FALHAS (última 1h)
    // ==========================================
    logStep('Verificando logins falhos');
    const { data: failedLogins } = await supabaseAdmin
      .from('audit_logs')
      .select('user_id, new_data')
      .eq('operation', 'LOGIN_FAILED')
      .gte('timestamp', oneHourAgo.toISOString());

    const failedLoginsCount = failedLogins?.length || 0;
    
    // Verificar tentativas múltiplas por usuário (brute force)
    const loginAttemptsByUser: Record<string, number> = {};
    failedLogins?.forEach(log => {
      const identifier = log.user_id || log.new_data?.email || 'unknown';
      loginAttemptsByUser[identifier] = (loginAttemptsByUser[identifier] || 0) + 1;
    });
    
    const bruteForceAttempts = Object.entries(loginAttemptsByUser)
      .filter(([_, count]) => count >= 5)
      .length;

    if (bruteForceAttempts > 0) {
      overallStatus = 'CRITICO';
      issues.push(`${bruteForceAttempts} possíveis ataques brute force`);
    } else if (failedLoginsCount > 20) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${failedLoginsCount} logins falhos na última hora`);
    }

    // ==========================================
    // 7. ALERTAS DE RLS NEGADO
    // ==========================================
    logStep('Verificando RLS negados');
    const { count: rlsDenied } = await supabaseAdmin
      .from('access_denied_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    if ((rlsDenied || 0) > 10) {
      overallStatus = 'CRITICO';
      issues.push(`${rlsDenied} acessos negados por RLS`);
    } else if ((rlsDenied || 0) > 3) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${rlsDenied} acessos negados por RLS`);
    }

    // ==========================================
    // 8. ERROS CRÍTICOS DE EDGE FUNCTIONS (última 1h)
    // ==========================================
    logStep('Verificando erros de edge functions');
    // Only count BACKEND errors — frontend React crashes are NOT edge function errors
    const { count: criticalErrors } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .eq('error_category', 'CRITICAL')
      .neq('error_type', 'FRONTEND')
      .gte('created_at', oneHourAgo.toISOString());

    const { count: totalEdgeErrors } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .neq('error_type', 'FRONTEND')
      .gte('created_at', oneHourAgo.toISOString());

    if ((criticalErrors || 0) > 0) {
      overallStatus = 'CRITICO';
      issues.push(`${criticalErrors} erros CRÍTICOS em Edge Functions`);
    } else if ((totalEdgeErrors || 0) > 20) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${totalEdgeErrors} erros em Edge Functions`);
    }

    // ==========================================
    // 9. DUPLICADOS (CPF/CNPJ, Telefone, Email)
    // ==========================================
    logStep('Verificando duplicados');
    
    const { data: duplicateDocs } = await supabaseAdmin.rpc('find_duplicate_documents');
    const { data: duplicatePhones } = await supabaseAdmin.rpc('find_duplicate_phones');
    const { data: duplicateEmails } = await supabaseAdmin.rpc('find_duplicate_emails');

    const totalDuplicates = (duplicateDocs?.length || 0) + (duplicatePhones?.length || 0) + (duplicateEmails?.length || 0);
    
    if (totalDuplicates > 5) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${totalDuplicates} duplicados detectados`);
    }

    // ==========================================
    // 10. RATE LIMIT / IPs BLOQUEADOS
    // ==========================================
    logStep('Verificando rate limits');
    const { count: blockedIPs } = await supabaseAdmin
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .not('blocked_until', 'is', null)
      .gte('blocked_until', now.toISOString());

    // ==========================================
    // BUILD MESSAGE - FORMATO OBRIGATÓRIO
    // ==========================================
    const statusEmoji = overallStatus === 'CRITICO' ? '🔴' : overallStatus === 'ATENCAO' ? '🟡' : '🟢';

    let message = `🔐 <b>RELATÓRIO DE SEGURANÇA — AGRIROUTE</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // STATUS GERAL
    message += `📊 <b>Status Geral:</b> ${statusEmoji} ${overallStatus}\n\n`;

    // USUÁRIOS
    message += `👥 <b>USUÁRIOS</b>\n`;
    message += `├ Total Ativos: <b>${totalActiveUsers || 0}</b>\n`;
    message += `├ Produtores: ${totalProdutores || 0}\n`;
    message += `├ Motoristas: ${totalMotoristas || 0}\n`;
    message += `├ Motoristas Afiliados: ${totalMotoristasAfiliados || 0}\n`;
    message += `├ Prestadores de Serviços: ${totalPrestadores || 0}\n`;
    message += `└ Transportadoras: ${totalTransportadoras || 0}\n\n`;

    // STATUS DE PERFIS
    message += `📋 <b>STATUS DE PERFIS</b>\n`;
    message += `├ Pendentes de Aprovação: <b>${pendingApproval || 0}</b>`;
    if ((pendingOver24h || 0) > 0) message += ` ⚠️ (${pendingOver24h} há +24h)`;
    message += `\n`;
    message += `├ Bloqueados/Suspensos: ${blockedProfiles || 0}\n`;
    message += `└ Roles Inconsistentes: ${invalidRolesCount}${invalidRolesCount > 0 ? ' ⚠️' : ''}\n\n`;

    // SEGURANÇA
    message += `🛡️ <b>SEGURANÇA (última 1h)</b>\n`;
    message += `├ Logins Falhos: <b>${failedLoginsCount}</b>`;
    if (bruteForceAttempts > 0) message += ` 🚨 (${bruteForceAttempts} possíveis brute force)`;
    message += `\n`;
    message += `├ Acessos Negados (RLS): ${rlsDenied || 0}\n`;
    message += `├ Erros Edge Functions: ${totalEdgeErrors || 0}`;
    if ((criticalErrors || 0) > 0) message += ` 🚨 (${criticalErrors} críticos)`;
    message += `\n`;
    message += `├ IPs/Usuários Bloqueados: ${blockedIPs || 0}\n`;
    message += `└ Duplicados Detectados: ${totalDuplicates} (CPF: ${duplicateDocs?.length || 0}, Tel: ${duplicatePhones?.length || 0}, Email: ${duplicateEmails?.length || 0})\n\n`;

    // ISSUES (se houver)
    if (issues.length > 0) {
      message += `⚠️ <b>ALERTAS ATIVOS:</b>\n`;
      issues.forEach(issue => {
        message += `• ${issue}\n`;
      });
      message += `\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 Gerado em: ${cuiabaTime}`;

    // Send to Telegram
    const sent = await sendTelegramMessage(message);
    logStep('Relatório enviado', { sent, status: overallStatus, issues: issues.length });

    // Log to audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'HOURLY_SECURITY_REPORT',
        table_name: 'system',
        new_data: {
          status: overallStatus,
          totalActiveUsers,
          profilesByRole: {
            produtores: totalProdutores,
            motoristas: totalMotoristas,
            motoristasAfiliados: totalMotoristasAfiliados,
            prestadores: totalPrestadores,
            transportadoras: totalTransportadoras
          },
          pendingApproval,
          blockedProfiles,
          invalidRolesCount,
          failedLoginsCount,
          rlsDenied,
          criticalErrors,
          totalEdgeErrors,
          totalDuplicates,
          blockedIPs,
          issues,
          executionTime: Date.now() - startTime,
          reportSent: sent
        }
      });

    return new Response(JSON.stringify({
      success: true,
      status: overallStatus,
      issues,
      metrics: {
        totalActiveUsers,
        pendingApproval,
        failedLoginsCount,
        rlsDenied,
        criticalErrors
      },
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
