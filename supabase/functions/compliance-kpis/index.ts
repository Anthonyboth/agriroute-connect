import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Não autenticado');
    }

    const { empresa_id } = await req.json();

    // Verificar permissão do usuário
    const { data: profile } = await userClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'TRANSPORTADORA') {
      throw new Error('Apenas transportadoras podem visualizar KPIs de compliance');
    }

    console.log(`[Compliance KPIs] Calculando para empresa ${empresa_id || 'todas'}`);

    // Calcular KPIs via função SQL
    const { data: kpis, error: kpisError } = await supabaseClient
      .rpc('get_compliance_kpis', { p_empresa_id: empresa_id || null });

    if (kpisError) {
      console.error('[Compliance KPIs] Erro ao calcular:', kpisError);
      throw new Error('Erro ao calcular KPIs');
    }

    // Buscar alertas não resolvidos
    let alertasQuery = supabaseClient
      .from('auditoria_eventos')
      .select('id, tipo, codigo_regra, severidade, descricao, created_at, frete_id')
      .eq('resolvido', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (empresa_id) {
      alertasQuery = alertasQuery.eq('empresa_id', empresa_id);
    }

    const { data: alertasPendentes } = await alertasQuery;

    // Buscar CT-es recentes
    let ctesQuery = supabaseClient
      .from('ctes')
      .select('id, numero, serie, status, chave, frete_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (empresa_id) {
      ctesQuery = ctesQuery.eq('empresa_id', empresa_id);
    }

    const { data: ctesRecentes } = await ctesQuery;

    return new Response(
      JSON.stringify({
        success: true,
        kpis: kpis?.[0] || {
          total_ctes: 0,
          ctes_autorizados: 0,
          ctes_rejeitados: 0,
          taxa_sucesso: 0,
          total_alertas: 0,
          alertas_pendentes: 0,
          alertas_resolvidos: 0,
          taxa_resolucao: 0,
          score_compliance: 100,
        },
        alertas_pendentes: alertasPendentes || [],
        ctes_recentes: ctesRecentes || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Compliance KPIs] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
