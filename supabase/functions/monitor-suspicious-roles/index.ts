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

function formatAdminConflictAlert(conflicts: any[]): string {
  let message = `🚨 <b>ALERTA CRÍTICO - PRIVILÉGIOS ADMINISTRATIVOS ELEVADOS DETECTADOS</b>\n\n`;
  message += `⚠️ <b>Total de administradores:</b> ${conflicts.length}\n\n`;
  message += `⚠️ <b>Descrição:</b> Usuários com privilégios administrativos REAIS (admin) detectados na tabela user_roles\n\n`;
  
  conflicts.forEach((conflict, index) => {
    message += `<b>${index + 1}. Administrador Detectado</b>\n`;
    message += `   👤 Email: ${conflict.email || 'N/A'}\n`;
    message += `   🆔 User ID: ${conflict.user_id?.substring(0, 12)}...\n`;
    message += `   📋 Profile Role: <code>${conflict.profile_role}</code>\n`;
    message += `   🔑 Privilégio Administrativo: <code>${conflict.admin_role}</code>\n`;
    message += `\n`;
  });
  
  message += `\n🔍 <b>Ação Requerida:</b>\n`;
  message += `   • Revisar se estes privilégios são legítimos\n`;
  message += `   • Verificar necessidade de acesso elevado\n`;
  message += `   • Revogar privilégios se não autorizados\n\n`;
  message += `ℹ️ <b>Nota:</b> Apenas privilégios de 'admin' são monitorados. Roles de negócio não são reportadas.\n\n`;
  message += `⏰ Verificação realizada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
  
  return message;
}

function formatMonitoringSummary(stats: any): string {
  const allClear = stats.suspiciousCount === 0 && stats.realAdminCount === 0;
  
  let message = `${allClear ? '✅' : '⚠️'} <b>RELATÓRIO DE MONITORAMENTO DE SEGURANÇA</b>\n\n`;
  message += `📊 <b>Estatísticas da Verificação:</b>\n`;
  message += `   • Perfis verificados: ${stats.totalProfiles}\n`;
  message += `   • Perfis com roles inválidas: ${stats.suspiciousCount}\n`;
  message += `   • Administradores reais (admin): ${stats.realAdminCount}\n\n`;
  
  if (allClear) {
    message += `✅ <b>Status:</b> Sistema OK - Nenhuma anomalia detectada\n\n`;
  } else {
    message += `🚨 <b>Status:</b> ATENÇÃO - Anomalias detectadas!\n\n`;
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

    const suspiciousProfiles = allProfiles.filter(
      profile => !VALID_ROLES.includes(profile.role)
    );

    logStep('Profiles suspeitos encontrados', { count: suspiciousProfiles.length });

    // 2. Verificar usuários com PRIVILÉGIOS ADMINISTRATIVOS REAIS (admin)
    logStep('Verificando privilégios administrativos elevados');
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        user_id,
        role
      `)
      .in('role', ['admin']); // APENAS role administrativa real (admin)

    if (adminError) {
      throw new Error(`Erro ao buscar admin roles: ${adminError.message}`);
    }

    // Buscar profiles desses usuários para comparação
    const adminUserIds = adminUsers.map(u => u.user_id);
    const { data: adminProfiles, error: adminProfilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, email, role')
      .in('user_id', adminUserIds);

    if (adminProfilesError) {
      throw new Error(`Erro ao buscar admin profiles: ${adminProfilesError.message}`);
    }

    // Detectar conflitos (apenas para auditoria - não é necessariamente um problema)
    const conflicts = adminUsers.map(adminUser => {
      const profile = adminProfiles.find(p => p.user_id === adminUser.user_id);
      return {
        user_id: adminUser.user_id,
        email: profile?.email,
        profile_role: profile?.role,
        admin_role: adminUser.role
      };
    });

    logStep('Conflitos encontrados', { count: conflicts.length });

    // 3. Preparar estatísticas
    const stats = {
      totalProfiles: allProfiles.length,
      suspiciousCount: suspiciousProfiles.length,
      realAdminCount: adminUsers.length // Apenas admin real
    };

    // 4. Enviar alertas ao Telegram
    let alertsSent = 0;

    // Enviar alerta de profiles suspeitos (CRÍTICO)
    if (suspiciousProfiles.length > 0) {
      const message = formatSuspiciousRolesAlert(suspiciousProfiles);
      const sent = await sendTelegramAlert(message);
      if (sent) alertsSent++;
    }

    // Enviar alerta de privilégios administrativos reais (CRÍTICO - apenas admin)
    if (conflicts.length > 0) {
      const message = formatAdminConflictAlert(conflicts);
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
      conflicts: conflicts.map(c => ({
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
