import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token de autenticação obrigatório' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate user token - MANDATORY
    const token = authHeader.replace('Bearer ', '');
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = data.user;

    // Check if user is admin - MANDATORY
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some((r: { role: string }) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const { issuer_id } = await req.json();
    if (!issuer_id || typeof issuer_id !== 'string') {
      return new Response(JSON.stringify({ error: 'issuer_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for NFe emissions (RESTRICT prevents delete)
    const { count: emissionsCount } = await supabase
      .from('nfe_emissions')
      .select('id', { count: 'exact', head: true })
      .eq('issuer_id', issuer_id);

    if (emissionsCount && emissionsCount > 0) {
      return new Response(
        JSON.stringify({
          error: 'Não é possível excluir emissor com emissões fiscais vinculadas',
          emissionsCount,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dissociate wallet (ON DELETE SET NULL will happen, but let's be explicit)
    await supabase.from('fiscal_wallet').update({ issuer_id: null }).eq('issuer_id', issuer_id);

    // Delete issuer (cascades certificates, antifraud events, terms)
    const { error: deleteError } = await supabase.from('fiscal_issuers').delete().eq('id', issuer_id);

    if (deleteError) {
      console.error('[admin-delete-fiscal-issuer] Delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Erro ao excluir emissor', details: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[admin-delete-fiscal-issuer] Issuer ${issuer_id} deleted by admin ${user?.id ?? 'service_role'}`);

    return new Response(JSON.stringify({ success: true, deleted: issuer_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-delete-fiscal-issuer] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
