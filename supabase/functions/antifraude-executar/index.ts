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

    const { frete_id, empresa_id } = await req.json();

    if (!frete_id) {
      throw new Error('frete_id é obrigatório');
    }

    // Verificar permissão do usuário
    const { data: profile } = await userClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'TRANSPORTADORA') {
      throw new Error('Apenas transportadoras podem executar análise antifraude');
    }

    console.log(`[Antifraude] Executando análise para frete ${frete_id}`);

    // Executar regras antifraude
    const { data: resultado, error: antifraudError } = await supabaseClient
      .rpc('run_antifraud_rules', { p_freight_id: frete_id });

    if (antifraudError) {
      console.error('[Antifraude] Erro ao executar regras:', antifraudError);
      throw new Error('Erro ao executar análise antifraude');
    }

    // Buscar eventos gerados
    const { data: eventos } = await supabaseClient
      .from('auditoria_eventos')
      .select('*')
      .eq('frete_id', frete_id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calcular score de risco
    const alertasCriticos = eventos?.filter(e => e.severidade === 'critical').length || 0;
    const alertasAltos = eventos?.filter(e => e.severidade === 'high').length || 0;
    const alertasMedios = eventos?.filter(e => e.severidade === 'medium').length || 0;
    const alertasBaixos = eventos?.filter(e => e.severidade === 'low').length || 0;

    const riskScore = Math.min(100, 
      alertasCriticos * 40 + 
      alertasAltos * 20 + 
      alertasMedios * 10 + 
      alertasBaixos * 5
    );

    const riskLevel = riskScore >= 80 ? 'critical' :
                      riskScore >= 50 ? 'high' :
                      riskScore >= 20 ? 'medium' : 'low';

    return new Response(
      JSON.stringify({
        success: true,
        frete_id,
        analise: {
          score: riskScore,
          nivel: riskLevel,
          total_alertas: eventos?.length || 0,
          alertas_criticos: alertasCriticos,
          alertas_altos: alertasAltos,
          alertas_medios: alertasMedios,
          alertas_baixos: alertasBaixos,
        },
        eventos: eventos?.map(e => ({
          id: e.id,
          tipo: e.tipo,
          codigo_regra: e.codigo_regra,
          severidade: e.severidade,
          descricao: e.descricao,
          resolvido: e.resolvido,
          created_at: e.created_at,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Antifraude] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
