import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  user_email: string;
  new_password: string;
  reset_reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Service role client for admin operations (password reset, audit logs)
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar se o requisitante é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    // 🔒 SEGURANÇA: Verificar se usuário está na whitelist de admins (admin_users)
    // Usa cliente com token do usuário para que auth.uid() funcione no RPC
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: isAdmin, error: adminCheckError } = await supabaseUserClient
      .rpc('is_allowlisted_admin');

    if (adminCheckError || !isAdmin) {
      console.error('[admin-reset-password] Unauthorized access attempt by user:', user.id);
      
      // Send Telegram alert about unauthorized attempt
      await supabaseClient.functions.invoke('send-telegram-alert', {
        body: {
          errorData: {
            errorType: 'SECURITY_VIOLATION',
            errorCategory: 'UNAUTHORIZED_ACCESS',
            errorMessage: 'Unauthorized attempt to reset user password (non-admin)',
            metadata: {
              attempted_by_user_id: user?.id,
              attempted_by_email: user?.email,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });
      
      throw new Error('Acesso negado. Apenas administradores podem resetar senhas.');
    }

    // Buscar profile_id do admin para rate limiting
    const { data: adminProfile, error: adminProfileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (adminProfileError || !adminProfile) {
      throw new Error('Perfil do administrador não encontrado');
    }

    const { user_email, new_password, reset_reason } = await req.json() as ResetPasswordRequest;

    if (!user_email || !new_password) {
      throw new Error('E-mail e nova senha são obrigatórios');
    }

    // 🔒 SEGURANÇA 1: Validar força da senha (12+ chars, complexidade)
    const { data: passwordValidation, error: validationError } = await supabaseClient
      .rpc('validate_password_strength', { password: new_password });

    if (validationError) {
      console.error('Erro ao validar senha:', validationError);
      throw new Error('Erro ao validar requisitos de senha');
    }

    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // 🔒 SEGURANÇA 2: Rate Limiting (5 resets/hora por admin)
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
      .rpc('check_admin_reset_rate_limit', { 
        p_admin_profile_id: adminProfile.id 
      });

    if (rateLimitError) {
      console.error('Erro ao verificar rate limit:', rateLimitError);
      throw new Error('Erro ao verificar limite de operações');
    }

    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Limite de operações atingido. Você já realizou ${rateLimitCheck.reset_count} resets na última hora. ` +
        `Aguarde até ${new Date(rateLimitCheck.window_resets_at).toLocaleTimeString('pt-BR')} para fazer novos resets.`
      );
    }

    console.log(`[RATE-LIMIT] Admin ${user.email}: ${rateLimitCheck.reset_count}/${rateLimitCheck.max_per_hour} resets, ${rateLimitCheck.remaining} restantes`);

    // Buscar o usuário pelo e-mail
    const { data: targetUser, error: findError } = await supabaseClient.auth.admin.listUsers();
    
    if (findError) {
      throw new Error('Erro ao buscar usuário: ' + findError.message);
    }

    const userToReset = targetUser.users.find(u => u.email === user_email);

    if (!userToReset) {
      throw new Error('Usuário não encontrado com este e-mail');
    }

    // Resetar a senha usando a API de Admin
    const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      userToReset.id,
      { password: new_password }
    );

    if (updateError) {
      throw new Error('Erro ao atualizar senha: ' + updateError.message);
    }

    // 🔒 SEGURANÇA 3: Registrar no audit log com IP e User Agent
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (adminProfile) {
      await supabaseClient.from('audit_logs').insert({
        user_id: adminProfile.id,
        table_name: 'auth.users',
        operation: 'PASSWORD_RESET_BY_ADMIN',
        new_data: {
          target_user_email: user_email,
          target_user_id: userToReset.id,
          reset_reason: reset_reason || 'Solicitação via WhatsApp',
          admin_action: true,
          admin_id: user.id,
          security_metadata: {
            ip_address: clientIP,
            user_agent: userAgent,
            timestamp: new Date().toISOString(),
            rate_limit_status: rateLimitCheck
          }
        },
        ip_address: clientIP,
        user_agent: userAgent,
        timestamp: new Date().toISOString()
      });

      // 🔒 SEGURANÇA 4: Detectar atividade suspeita (5+ resets/hora)
      await supabaseClient.rpc('detect_suspicious_admin_activity', {
        p_admin_profile_id: adminProfile.id,
        p_activity_type: 'PASSWORD_RESET',
        p_details: {
          target_email: user_email,
          reset_count: rateLimitCheck.reset_count,
          ip_address: clientIP,
          user_agent: userAgent
        }
      });
    }

    console.log(`Senha resetada para usuário: ${user_email} por admin: ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha resetada com sucesso',
        user_email: user_email,
        user_id: userToReset.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
