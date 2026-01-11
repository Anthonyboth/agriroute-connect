import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOCUS_NFE_BASE_URL = 'https://api.focusnfe.com.br';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role for cron job access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!focusToken) {
      throw new Error('FOCUS_NFE_TOKEN não configurado');
    }

    console.log('[MDFe Polling] Iniciando polling de MDF-es pendentes...');

    // Find all MDFe in pending statuses
    const pendingStatuses = [
      'PROCESSANDO',
      'PROCESSANDO_ENCERRAMENTO',
      'PROCESSANDO_CANCELAMENTO',
      'PENDENTE',
      'CONTINGENCIA'
    ];

    const { data: mdfes, error: mdfesError } = await supabaseClient
      .from('mdfe_manifestos')
      .select('id, referencia_focus, status, chave_acesso, data_emissao')
      .in('status', pendingStatuses)
      .not('referencia_focus', 'is', null)
      .order('data_emissao', { ascending: true })
      .limit(50);

    if (mdfesError) {
      console.error('[MDFe Polling] Erro ao buscar MDF-es:', mdfesError);
      throw mdfesError;
    }

    if (!mdfes || mdfes.length === 0) {
      console.log('[MDFe Polling] Nenhum MDF-e pendente encontrado');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum MDF-e pendente', processados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MDFe Polling] Encontrados ${mdfes.length} MDF-es para consultar`);

    const results = {
      total: mdfes.length,
      autorizados: 0,
      encerrados: 0,
      cancelados: 0,
      rejeitados: 0,
      ainda_processando: 0,
      erros: 0,
    };

    // Process each MDFe
    for (const mdfe of mdfes) {
      try {
        console.log(`[MDFe Polling] Consultando ${mdfe.referencia_focus}...`);

        const focusResponse = await fetch(
          `${FOCUS_NFE_BASE_URL}/v2/mdfe/${mdfe.referencia_focus}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${btoa(focusToken + ':')}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const focusData = await focusResponse.json();

        // Determine new status
        let newStatus = mdfe.status;
        
        if (focusData.status === 'autorizado') {
          newStatus = 'AUTORIZADO';
          results.autorizados++;
        } else if (focusData.status === 'encerrado') {
          newStatus = 'ENCERRADO';
          results.encerrados++;
        } else if (focusData.status === 'cancelado') {
          newStatus = 'CANCELADO';
          results.cancelados++;
        } else if (focusData.status === 'erro_autorizacao' || focusData.status === 'rejeitado') {
          newStatus = 'REJEITADO';
          results.rejeitados++;
        } else if (focusData.status?.includes('processando')) {
          results.ainda_processando++;
          continue; // Don't update, still processing
        }

        // Update if status changed
        if (newStatus !== mdfe.status) {
          const updateData: Record<string, any> = {
            status: newStatus,
            resposta_sefaz: focusData,
          };

          if (focusData.protocolo) {
            updateData.protocolo_autorizacao = focusData.protocolo;
          }

          if (focusData.chave) {
            updateData.chave_acesso = focusData.chave;
          }

          if (focusData.caminho_xml_nota_fiscal) {
            updateData.xml_url = focusData.caminho_xml_nota_fiscal;
          }

          if (focusData.caminho_danfe) {
            updateData.dacte_url = focusData.caminho_danfe;
          }

          if (newStatus === 'AUTORIZADO' && !focusData.data_autorizacao) {
            updateData.data_autorizacao = new Date().toISOString();
          }

          if (newStatus === 'REJEITADO') {
            updateData.mensagem_erro = focusData.mensagem_sefaz || focusData.mensagem || 'Rejeitado pela SEFAZ';
          }

          await supabaseClient
            .from('mdfe_manifestos')
            .update(updateData)
            .eq('id', mdfe.id);

          // Log
          await supabaseClient.from('mdfe_logs').insert({
            mdfe_id: mdfe.id,
            user_id: null, // Polling job, no user
            tipo_operacao: 'POLLING',
            resposta_sefaz: focusData,
            codigo_retorno: focusData.status_sefaz?.toString() || focusData.status,
            mensagem_retorno: focusData.mensagem_sefaz || focusData.status,
            sucesso: newStatus === 'AUTORIZADO' || newStatus === 'ENCERRADO' || newStatus === 'CANCELADO',
            observacao: `Status atualizado por polling: ${mdfe.status} -> ${newStatus}`,
          });

          console.log(`[MDFe Polling] ${mdfe.referencia_focus}: ${mdfe.status} -> ${newStatus}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (mdfeError) {
        console.error(`[MDFe Polling] Erro ao processar ${mdfe.referencia_focus}:`, mdfeError);
        results.erros++;
      }
    }

    console.log('[MDFe Polling] Resultados:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Polling concluído',
        resultados: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Polling] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
