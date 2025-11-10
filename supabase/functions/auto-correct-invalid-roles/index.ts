import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749';

const VALID_ROLES = ['PRODUTOR', 'MOTORISTA', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'];
const DEFAULT_ROLE = 'PRODUTOR';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AUTO-CORRECT-INVALID-ROLES] ${step}${detailsStr}`);
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

function formatCorrectionAlert(corrections: any[]): string {
  let message = `🔧 <b>AUTO-CORREÇÃO DE ROLES EXECUTADA</b>\n\n`;
  message += `✅ <b>Total de correções:</b> ${corrections.length}\n\n`;
  
  corrections.forEach((correction, index) => {
    message += `<b>${index + 1}. Perfil Corrigido</b>\n`;
    message += `   👤 Email: ${correction.email || 'N/A'}\n`;
    message += `   🔴 Role Inválida: <code>${correction.old_role}</code>\n`;
    message += `   ✅ Nova Role: <code>${correction.new_role}</code>\n`;
    message += `   📝 Auditoria: Log ID ${correction.audit_log_id?.substring(0, 8)}...\n`;
    message += `\n`;
  });
  
  message += `⏰ Correção realizada em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
  
  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Iniciando auto-correção de roles inválidas');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar profiles com roles inválidas
    const { data: allProfiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, phone, role, created_at')
      .not('role', 'is', null);

    if (profilesError) {
      throw new Error(`Erro ao buscar profiles: ${profilesError.message}`);
    }

    const invalidProfiles = allProfiles.filter(
      profile => !VALID_ROLES.includes(profile.role)
    );

    logStep('Profiles inválidos encontrados', { count: invalidProfiles.length });

    if (invalidProfiles.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Nenhum profile inválido encontrado',
        corrected: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const corrections = [];

    // Corrigir cada profile
    for (const profile of invalidProfiles) {
      const oldRole = profile.role;
      
      // Criar log de auditoria
      const { data: auditLog, error: auditError } = await supabaseAdmin
        .from('role_correction_audit')
        .insert({
          profile_id: profile.id,
          user_id: profile.user_id,
          old_role: oldRole,
          new_role: DEFAULT_ROLE,
          correction_reason: 'Auto-correção: role inválida detectada pelo sistema',
          corrected_by: 'SYSTEM',
          metadata: {
            profile_email: profile.email,
            profile_created_at: profile.created_at,
            auto_correction: true
          }
        })
        .select('id')
        .single();

      if (auditError) {
        logStep('Erro ao criar log de auditoria', { profileId: profile.id, error: auditError });
        continue;
      }

      // Atualizar role do profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: DEFAULT_ROLE })
        .eq('id', profile.id);

      if (updateError) {
        logStep('Erro ao atualizar profile', { profileId: profile.id, error: updateError });
        continue;
      }

      // Criar notificação para o usuário
      const notificationMessage = `Seu perfil foi atualizado automaticamente. Sua role foi alterada de "${oldRole}" para "${DEFAULT_ROLE}" devido a uma inconsistência detectada. Se você acredita que isso foi um erro, entre em contato com o suporte.`;

      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: profile.user_id,
          type: 'system',
          title: 'Perfil Atualizado Automaticamente',
          message: notificationMessage,
          metadata: {
            old_role: oldRole,
            new_role: DEFAULT_ROLE,
            audit_log_id: auditLog.id,
            auto_correction: true
          }
        });

      corrections.push({
        profile_id: profile.id,
        email: profile.email,
        old_role: oldRole,
        new_role: DEFAULT_ROLE,
        audit_log_id: auditLog.id
      });

      logStep('Profile corrigido', { 
        profileId: profile.id, 
        email: profile.email,
        oldRole,
        newRole: DEFAULT_ROLE
      });
    }

    // Enviar alerta ao Telegram
    if (corrections.length > 0 && TELEGRAM_BOT_TOKEN) {
      const message = formatCorrectionAlert(corrections);
      await sendTelegramAlert(message);
    }

    logStep('Auto-correção concluída', { 
      profilesVerified: allProfiles.length,
      corrected: corrections.length
    });

    return new Response(JSON.stringify({ 
      success: true,
      profilesVerified: allProfiles.length,
      corrected: corrections.length,
      corrections
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    // Tentar enviar erro crítico ao Telegram
    if (TELEGRAM_BOT_TOKEN) {
      const errorMessage = `🚨 <b>ERRO CRÍTICO NA AUTO-CORREÇÃO</b>\n\n` +
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
