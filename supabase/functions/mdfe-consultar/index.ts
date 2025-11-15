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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Não autenticado');
    }

    const { mdfe_id, chave_acesso } = await req.json();

    if (!mdfe_id && !chave_acesso) {
      throw new Error('mdfe_id ou chave_acesso é obrigatório');
    }

    console.log(`[MDFe Consultar] Consultando MDFe: ${mdfe_id || chave_acesso}`);

    // Query MDFe
    let query = supabaseClient
      .from('mdfe_manifestos')
      .select(`
        *,
        freight:freight_id(*),
        emitted_by:emitted_by_id(id, full_name, document, role),
        company:company_id(id, company_name),
        condutores:mdfe_condutores(*),
        veiculos:mdfe_veiculos(*),
        documentos:mdfe_documentos(*),
        logs:mdfe_logs(*)
      `);

    if (mdfe_id) {
      query = query.eq('id', mdfe_id);
    } else {
      query = query.eq('chave_acesso', chave_acesso);
    }

    const { data: mdfe, error: mdfeError } = await query.single();

    if (mdfeError || !mdfe) {
      throw new Error('MDFe não encontrado');
    }

    // Check user permission to view
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    const canView =
      mdfe.emitted_by_id === profile.id ||
      mdfe.freight.producer_id === profile.id ||
      mdfe.freight.driver_id === profile.id ||
      (mdfe.company_id &&
        (await checkCompanyOwnership(supabaseClient, profile.id, mdfe.company_id)));

    if (!canView) {
      throw new Error('Você não tem permissão para visualizar este MDFe');
    }

    console.log(`[MDFe Consultar] MDFe ${mdfe.id} consultado com sucesso`);

    // Log operation
    await supabaseClient.from('mdfe_logs').insert({
      mdfe_id: mdfe.id,
      user_id: profile.id,
      tipo_operacao: 'CONSULTA',
      sucesso: true,
      observacao: 'Consulta realizada com sucesso',
    });

    return new Response(
      JSON.stringify({
        success: true,
        mdfe: {
          ...mdfe,
          status_label: getStatusLabel(mdfe.status),
          can_encerrar: mdfe.status === 'AUTORIZADO' || mdfe.status === 'CONTINGENCIA',
          can_cancelar:
            mdfe.status === 'AUTORIZADO' &&
            new Date().getTime() - new Date(mdfe.data_emissao).getTime() <
              24 * 60 * 60 * 1000,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Consultar] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

async function checkCompanyOwnership(
  supabase: any,
  profileId: string,
  companyId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('transport_companies')
    .select('id')
    .eq('id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle();

  return !!data;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente de Transmissão',
    CONTINGENCIA: 'Em Contingência',
    AUTORIZADO: 'Autorizado',
    ENCERRADO: 'Encerrado',
    CANCELADO: 'Cancelado',
  };
  return labels[status] || status;
}
