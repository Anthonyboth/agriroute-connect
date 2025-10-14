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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

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

    // Verificar se o usuário é admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'ADMIN') {
      throw new Error('Acesso negado. Apenas administradores podem resetar senhas.');
    }

    const { user_email, new_password, reset_reason } = await req.json() as ResetPasswordRequest;

    if (!user_email || !new_password) {
      throw new Error('E-mail e nova senha são obrigatórios');
    }

    if (new_password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres');
    }

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

    // Registrar no audit log
    const { data: adminProfile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

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
          admin_id: user.id
        },
        timestamp: new Date().toISOString()
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
