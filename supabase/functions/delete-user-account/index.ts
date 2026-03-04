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
    // ✅ Validate JWT via getClaims() (signing-keys compatible)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ✅ Use anon key + user's auth header for getClaims
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = data.claims.sub as string;
    console.log(`[delete-user-account] Iniciando exclusão para user_id=${userId}`);

    // Service role client for admin operations
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get all profile IDs for this user
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', userId);

    const profileIds = (profiles || []).map((p: any) => p.id);

    // Clean up related data (order matters for FK constraints)
    if (profileIds.length > 0) {
      await admin.from('notifications').delete().in('user_id', profileIds);
      await admin.from('freight_proposals').delete().in('driver_id', profileIds);
      await admin.from('driver_availability').delete().in('driver_id', profileIds);
      await admin.from('driver_badges').delete().in('driver_id', profileIds);
      await admin.from('driver_expenses').delete().in('driver_id', profileIds);
      await admin.from('user_cities').delete().eq('user_id', userId);
      await admin.from('company_drivers').delete().in('driver_profile_id', profileIds);
      await admin.from('balance_transactions').delete().in('provider_id', profileIds);
      await admin.from('support_tickets').delete().in('user_id', profileIds);
      await admin.from('driver_current_locations').delete().in('driver_profile_id', profileIds);

      const { error: profileDeleteError } = await admin
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileDeleteError) {
        console.error('[delete-user-account] Erro ao deletar profiles:', profileDeleteError);
      }
    }

    // Delete auth user
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('[delete-user-account] Erro ao deletar auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir conta de autenticação' }),
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
