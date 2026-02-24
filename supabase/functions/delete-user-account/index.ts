import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth client to verify the requesting user
    const authClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[delete-user-account] Iniciando exclusão para user_id=${userId}`);

    // 2. Service role client for admin operations
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Get all profile IDs for this user
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', userId);

    const profileIds = (profiles || []).map((p: any) => p.id);

    // 4. Clean up related data (order matters for FK constraints)
    if (profileIds.length > 0) {
      // Notifications
      await admin.from('notifications').delete().in('user_id', profileIds);

      // Freight proposals
      await admin.from('freight_proposals').delete().in('driver_id', profileIds);

      // Driver availability
      await admin.from('driver_availability').delete().in('driver_id', profileIds);

      // Driver badges
      await admin.from('driver_badges').delete().in('driver_id', profileIds);

      // Driver expenses
      await admin.from('driver_expenses').delete().in('driver_id', profileIds);

      // User cities
      await admin.from('user_cities').delete().eq('user_id', userId);

      // Company drivers
      await admin.from('company_drivers').delete().in('driver_profile_id', profileIds);

      // Balance transactions
      await admin.from('balance_transactions').delete().in('provider_id', profileIds);

      // Support tickets
      await admin.from('support_tickets').delete().in('user_id', profileIds);

      // Driver current locations
      await admin.from('driver_current_locations').delete().in('driver_profile_id', profileIds);

      // Profiles (all of them)
      const { error: profileDeleteError } = await admin
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileDeleteError) {
        console.error('[delete-user-account] Erro ao deletar profiles:', profileDeleteError);
      }
    }

    // 5. Delete auth user (this is what Apple requires)
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('[delete-user-account] Erro ao deletar auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir conta de autenticação', details: deleteAuthError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-user-account] Conta excluída com sucesso: user_id=${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Conta excluída permanentemente' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[delete-user-account] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar exclusão' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
