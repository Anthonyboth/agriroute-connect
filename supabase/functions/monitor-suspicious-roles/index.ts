import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749'; // Grupo de monitoramento

const VALID_ROLES = ['PRODUTOR', 'MOTORISTA', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'];

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MONITOR-SUSPICIOUS-ROLES] ${step}${detailsStr}`);
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
    
    if (!response.ok) {
      const errorBody = await response.text();
      logStep('Erro ao enviar Telegram', { status: response.status, body: errorBody });
      return false;
    }
    
    logStep('Alerta enviado ao Telegram com sucesso');
    return true;
  } catch (error) {
    logStep('Erro ao enviar Telegram', error);
    return false;
  }
}

function formatSuspiciousRolesAlert(suspiciousProfiles: any[]): string {
  let message = `🚨 <b>ALERTA DE SEGURANÇA - ROLES SUSPEITAS DETECTADAS</b>\n\n`;
  message += `⚠️ <b>Total de perfis suspeitos:</b> ${suspiciousProfiles.length}\n\n`;
  
  suspiciousProfiles.forEach((profile, index) => {
    message += `<b>${index + 1}. Perfil Suspeito</b>\n`;
    message += `   👤 Email: ${profile.email || 'N/A'}\n`;
    message += `   🆔 User ID: ${profile.user_id?.substring(0, 12)}...\n`;
    message += `   🔴 Role Inválida: <code>${profile.role}</code>\n`;
    message += `   📅 Criado em: ${new Date(profile.created_at).toLocaleString('pt-BR')}\n`;
    if (profile.phone) message += `   📱 Telefone: ${profile.phone}\n`;
    message += `\n`;
  });
  
  message += `\n🔍 <b>Ação Requerida:</b>\n`;
  message += `   • Investigar perfis listados\n`;
  message += `   • Verificar logs de auditoria\n`;
  message += `   • Corrigir ou remover perfis suspeitos\n\n`;
  message += `⏰ Verificação realizada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
  
  return message;
}

function uniqueUserIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

function formatUnauthorizedAdminAlert(unauthorizedAdmins: any[]): string {
  let message = `🚨 <b>ALERTA CRÍTICO - ADMIN FORA DA ALLOWLIST DETECTADO</b>\n\n`;
  message += `⚠️ <b>Total de usuários com role admin fora da allowlist:</b> ${unauthorizedAdmins.length}\n\n`;
  message += `⚠️ <b>Descrição:</b> Usuários com role <code>admin</code> em <code>user_roles</code> sem vínculo ativo em <code>admin_users</code>.\n\n`;
  
  unauthorizedAdmins.forEach((admin, index) => {
    message += `<b>${index + 1}. Usuário com Privilégio Elevado</b>\n`;
    message += `   👤 Email: ${admin.email || 'N/A'}\n`;
    message += `   🆔 User ID: ${admin.user_id?.substring(0, 12)}...\n`;
    message += `   📋 Profile Role: <code>${admin.profile_role}</code>\n`;
    message += `   🔑 Role Elevada: <code>${admin.admin_role}</code>\n`;
    message += `\n`;
  });
  
  message += `\n🔍 <b>Ação Requerida:</b>\n`;
  message += `   • Validar legitimidade destes privilégios\n`;
  message += `   • Se legítimo, incluir o usuário na allowlist (admin_users)\n`;
  message += `   • Se não legítimo, revogar role admin imediatamente\n\n`;
  message += `⏰ Verificação realizada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
  
  return message;
}

function formatMonitoringSummary(stats: any): string {
  const allClear = stats.suspiciousCount === 0 && stats.unauthorizedAdminCount === 0;
  
  let message = `${allClear ? '✅' : '⚠️'} <b>RELATÓRIO DE MONITORAMENTO DE SEGURANÇA</b>\n\n`;
  message += `📊 <b>Estatísticas da Verificação:</b>\n`;
  message += `   • Perfis verificados: ${stats.totalProfiles}\n`;
  message += `   • Perfis com roles inválidas: ${stats.suspiciousCount}\n`;
  message += `   • Administradores allowlist ativos: ${stats.allowlistedAdminCount}\n`;
  message += `   • Usuários com role admin (user_roles): ${stats.elevatedRoleCount}\n`;
  message += `   • Admins não allowlisted (risco): ${stats.unauthorizedAdminCount}\n\n`;
  
  if (allClear) {
    message += `✅ <b>Status:</b> Sistema OK - Nenhuma anomalia detectada\n\n`;
  } else {
    message += `🚨 <b>Status:</b> ATENÇÃO - Anomalias detectadas!\n\n`;
  }

  if (stats.allowlistedAdminCount === 0) {
    message += `ℹ️ <b>Atenção operacional:</b> Nenhum admin ativo na allowlist (admin_users).\n\n`;
  }
  
  message += `ℹ️ <b>Nota:</b> Roles de negócio (driver, producer, service_provider) não são reportadas como conflitos.\n\n`;
  message += `⏰ Verificação realizada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
  
  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Iniciando monitoramento de roles suspeitas');

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN não configurado');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verificar profiles com roles inválidas
    logStep('Verificando profiles com roles inválidas');
    const { data: allProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, phone, role, created_at')
      .not('role', 'is', null);

    if (profilesError) {
      throw new Error(`Erro ao buscar profiles: ${profilesError.message}`);
    }

    const profiles = allProfiles ?? [];
    const suspiciousProfiles = profiles.filter(
      profile => !VALID_ROLES.includes(profile.role)
    );

    logStep('Profiles suspeitos encontrados', { count: suspiciousProfiles.length });

    // 2. Verificar admins allowlisted ativos e privilégios admin em user_roles
    logStep('Verificando privilégios administrativos elevados');
    const { data: elevatedAdminRoles, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'admin');

    if (adminError) {
      throw new Error(`Erro ao buscar admin roles: ${adminError.message}`);
    }

    const { data: allowlistedAdmins, error: allowlistedError } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, email, role, is_active')
      .eq('is_active', true)
      .not('user_id', 'is', null);

    if (allowlistedError) {
      throw new Error(`Erro ao buscar admins allowlisted: ${allowlistedError.message}`);
    }

    const elevatedAdminUserIds = uniqueUserIds((elevatedAdminRoles ?? []).map(u => u.user_id));
    const allowlistedAdminUserIds = new Set(uniqueUserIds((allowlistedAdmins ?? []).map(a => a.user_id)));
    const unauthorizedAdminUserIds = elevatedAdminUserIds.filter(userId => !allowlistedAdminUserIds.has(userId));

    let unauthorizedAdmins: any[] = [];

    if (unauthorizedAdminUserIds.length > 0) {
      const { data: unauthorizedProfiles, error: unauthorizedProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, email, role')
        .in('user_id', unauthorizedAdminUserIds);

      if (unauthorizedProfilesError) {
        throw new Error(`Erro ao buscar profiles de admins não allowlisted: ${unauthorizedProfilesError.message}`);
      }

      unauthorizedAdmins = unauthorizedAdminUserIds.map((userId) => {
        const profile = unauthorizedProfiles?.find(p => p.user_id === userId);
        const elevatedRole = elevatedAdminRoles?.find(r => r.user_id === userId);

        return {
          user_id: userId,
          email: profile?.email,
          profile_role: profile?.role,
          admin_role: elevatedRole?.role ?? 'admin'
        };
      });
    }

    logStep('Admins allowlisted detectados', { count: allowlistedAdmins?.length || 0 });
    logStep('Admins com role admin em user_roles', { count: elevatedAdminUserIds.length });
    logStep('Admins não allowlisted detectados', { count: unauthorizedAdmins.length });

    // 3. Preparar estatísticas
    const stats = {
      totalProfiles: profiles.length,
      suspiciousCount: suspiciousProfiles.length,
      allowlistedAdminCount: allowlistedAdmins?.length || 0,
      elevatedRoleCount: elevatedAdminUserIds.length,
      unauthorizedAdminCount: unauthorizedAdmins.length,
    };

    // 4. Enviar alertas ao Telegram
    let alertsSent = 0;

    // Enviar alerta de profiles suspeitos (CRÍTICO)
    if (suspiciousProfiles.length > 0) {
      const message = formatSuspiciousRolesAlert(suspiciousProfiles);
      const sent = await sendTelegramAlert(message);
      if (sent) alertsSent++;
    }

    // Enviar alerta apenas para admins elevados fora da allowlist
    if (unauthorizedAdmins.length > 0) {
      const message = formatUnauthorizedAdminAlert(unauthorizedAdmins);
      const sent = await sendTelegramAlert(message);
      if (sent) alertsSent++;
    }

    // Enviar resumo sempre (para confirmar que o monitoramento está funcionando)
    const summaryMessage = formatMonitoringSummary(stats);
    const summarySent = await sendTelegramAlert(summaryMessage);
    if (summarySent) alertsSent++;

    logStep('Monitoramento concluído', { 
      stats,
      alertsSent
    });

    return new Response(JSON.stringify({ 
      success: true,
      stats,
      suspiciousProfiles: suspiciousProfiles.map(p => ({
        email: p.email,
        role: p.role,
        created_at: p.created_at
      })),
      unauthorizedAdmins: unauthorizedAdmins.map(c => ({
        email: c.email,
        profile_role: c.profile_role,
        admin_role: c.admin_role
      })),
      alertsSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO no monitoramento', error);
    
    // Tentar enviar erro crítico ao Telegram
    if (TELEGRAM_BOT_TOKEN) {
      const errorMessage = `🚨 <b>ERRO CRÍTICO NO MONITORAMENTO DE SEGURANÇA</b>\n\n` +
        `❌ <b>Erro:</b> ${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n` +
        `⏰ ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}\n\n` +
        `⚠️ Sistema de monitoramento automático falhou - verificação manual necessária!`;
      
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
