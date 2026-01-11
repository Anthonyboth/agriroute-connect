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
      console.error('[CT-e Polling] Token Focus NFe não configurado');
      return new Response(
        JSON.stringify({ error: 'Token não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar CT-es em processamento com menos de 10 tentativas
    const { data: ctesPendentes, error: selectError } = await supabaseClient
      .from('ctes')
      .select('id, referencia, tentativas, empresa:empresa_id(ambiente_fiscal), frete_id')
      .eq('status', 'processando')
      .lt('tentativas', 10)
      .order('created_at', { ascending: true })
      .limit(20);

    if (selectError) {
      console.error('[CT-e Polling] Erro ao buscar CT-es:', selectError);
      throw selectError;
    }

    if (!ctesPendentes || ctesPendentes.length === 0) {
      console.log('[CT-e Polling] Nenhum CT-e em processamento');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum CT-e pendente', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[CT-e Polling] Processando ${ctesPendentes.length} CT-es`);

    const results = [];

    for (const cte of ctesPendentes) {
      try {
        // Determinar ambiente
        const isProducao = cte.empresa?.ambiente_fiscal === 'producao';
        const focusUrl = isProducao
          ? `https://api.focusnfe.com.br/v2/cte/${cte.referencia}`
          : `https://homologacao.focusnfe.com.br/v2/cte/${cte.referencia}`;

        console.log(`[CT-e Polling] Consultando ${cte.referencia} em ${isProducao ? 'produção' : 'homologação'}`);

        const focusResponse = await fetch(focusUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(FOCUS_NFE_TOKEN + ':')}`,
          },
        });

        const focusData = await focusResponse.json();
        console.log(`[CT-e Polling] Resposta para ${cte.referencia}:`, focusData.status);

        // Mapear status
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
          updated_at: new Date().toISOString(),
        };

        if (focusData.chave_cte) updateData.chave = focusData.chave_cte;
        if (focusData.numero) updateData.numero = focusData.numero;
        if (focusData.mensagem_sefaz) updateData.mensagem_erro = focusData.mensagem_sefaz;
        if (focusData.caminho_xml_nota_fiscal) updateData.xml_url = focusData.caminho_xml_nota_fiscal;
        if (focusData.caminho_dacte) updateData.dacte_url = focusData.caminho_dacte;
        if (newStatus === 'autorizado') {
          updateData.authorized_at = new Date().toISOString();
        }

        // Atualizar no banco
        const { error: updateError } = await supabaseClient
          .from('ctes')
          .update(updateData)
          .eq('id', cte.id);

        if (updateError) {
          console.error(`[CT-e Polling] Erro ao atualizar ${cte.referencia}:`, updateError);
        }

        // Se autorizado agora, executar regras antifraude
        if (newStatus === 'autorizado' && cte.frete_id) {
          try {
            await supabaseClient.rpc('run_antifraud_rules', { p_freight_id: cte.frete_id });
            console.log(`[CT-e Polling] Regras antifraude executadas para frete ${cte.frete_id}`);
          } catch (antifraudError) {
            console.error(`[CT-e Polling] Erro nas regras antifraude:`, antifraudError);
          }
        }

        results.push({
          referencia: cte.referencia,
          oldStatus: 'processando',
          newStatus,
          success: true,
        });
      } catch (cteError) {
        console.error(`[CT-e Polling] Erro ao processar ${cte.referencia}:`, cteError);
        
        // Incrementar tentativas mesmo em caso de erro
        await supabaseClient
          .from('ctes')
          .update({ tentativas: (cte.tentativas || 0) + 1 })
          .eq('id', cte.id);

        results.push({
          referencia: cte.referencia,
          success: false,
          error: cteError.message,
        });
      }
    }

    const authorized = results.filter(r => r.newStatus === 'autorizado').length;
    const rejected = results.filter(r => r.newStatus === 'rejeitado').length;
    const stillProcessing = results.filter(r => r.newStatus === 'processando').length;

    console.log(`[CT-e Polling] Resultado: ${authorized} autorizados, ${rejected} rejeitados, ${stillProcessing} ainda processando`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        authorized,
        rejected,
        stillProcessing,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[CT-e Polling] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
