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
    const FOCUS_NFE_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!FOCUS_NFE_TOKEN) {
      throw new Error('Token do provedor fiscal não configurado');
    }

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

    const { cte_id, referencia } = await req.json();

    if (!cte_id && !referencia) {
      throw new Error('cte_id ou referencia é obrigatório');
    }

    // Buscar CT-e no banco
    let query = supabaseClient.from('ctes').select('*, empresa:empresa_id(ambiente_fiscal)');
    
    if (cte_id) {
      query = query.eq('id', cte_id);
    } else {
      query = query.eq('referencia', referencia);
    }

    const { data: cte, error: cteError } = await query.single();

    if (cteError || !cte) {
      throw new Error('CT-e não encontrado');
    }

    // Se já está autorizado ou rejeitado, retornar dados do banco
    if (cte.status === 'autorizado' || cte.status === 'rejeitado' || cte.status === 'cancelado') {
      return new Response(
        JSON.stringify({
          success: true,
          cte_id: cte.id,
          status: cte.status,
          chave: cte.chave,
          numero: cte.numero,
          serie: cte.serie,
          xml_url: cte.xml_url,
          dacte_url: cte.dacte_url,
          authorized_at: cte.authorized_at,
          mensagem: cte.mensagem_erro,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Consultar status na SEFAZ via Focus
    const isProducao = cte.empresa?.ambiente_fiscal === 'producao';
    const focusUrl = isProducao
      ? `https://api.focusnfe.com.br/v2/cte/${cte.referencia}`
      : `https://homologacao.focusnfe.com.br/v2/cte/${cte.referencia}`;

    console.log(`[CT-e Consultar] Consultando ${focusUrl}`);

    const focusResponse = await fetch(focusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(FOCUS_NFE_TOKEN + ':')}`,
      },
    });

    const focusData = await focusResponse.json();
    console.log('[CT-e Consultar] Resposta Focus:', focusData);

    // Atualizar status no banco
    const newStatus = focusData.status === 'autorizado' 
      ? 'autorizado' 
      : focusData.status === 'erro_autorizacao'
        ? 'rejeitado'
        : focusData.status === 'cancelado'
          ? 'cancelado'
          : 'processando';

    const updateData: Record<string, any> = {
      status: newStatus,
      resposta_sefaz: focusData,
      tentativas: (cte.tentativas || 0) + 1,
    };

    if (focusData.chave_cte) updateData.chave = focusData.chave_cte;
    if (focusData.numero) updateData.numero = focusData.numero;
    if (focusData.mensagem_sefaz) updateData.mensagem_erro = focusData.mensagem_sefaz;
    if (focusData.caminho_xml_nota_fiscal) updateData.xml_url = focusData.caminho_xml_nota_fiscal;
    if (focusData.caminho_dacte) updateData.dacte_url = focusData.caminho_dacte;
    if (newStatus === 'autorizado' && !cte.authorized_at) {
      updateData.authorized_at = new Date().toISOString();
    }

    await supabaseClient
      .from('ctes')
      .update(updateData)
      .eq('id', cte.id);

    // Se autorizado agora, executar regras antifraude
    if (newStatus === 'autorizado' && cte.status !== 'autorizado' && cte.frete_id) {
      try {
        await supabaseClient.rpc('run_antifraud_rules', { p_freight_id: cte.frete_id });
        console.log('[CT-e Consultar] Regras antifraude executadas');
      } catch (antifraudError) {
        console.error('[CT-e Consultar] Erro nas regras antifraude:', antifraudError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cte_id: cte.id,
        status: newStatus,
        chave: focusData.chave_cte || cte.chave,
        numero: focusData.numero || cte.numero,
        serie: cte.serie,
        xml_url: focusData.caminho_xml_nota_fiscal || cte.xml_url,
        dacte_url: focusData.caminho_dacte || cte.dacte_url,
        mensagem: focusData.mensagem_sefaz,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[CT-e Consultar] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
