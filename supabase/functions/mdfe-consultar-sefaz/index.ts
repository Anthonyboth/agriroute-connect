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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!focusToken) {
      throw new Error('FOCUS_NFE_TOKEN não configurado');
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Não autenticado');
    }

    const { mdfe_id } = await req.json();

    if (!mdfe_id) {
      throw new Error('mdfe_id é obrigatório');
    }

    console.log(`[MDFe Consultar] Consultando status para MDFe ${mdfe_id}`);

    // Get MDFe data
    const { data: mdfe, error: mdfeError } = await supabaseClient
      .from('mdfe_manifestos')
      .select('*')
      .eq('id', mdfe_id)
      .single();

    if (mdfeError || !mdfe) {
      throw new Error('MDFe não encontrado');
    }

    // Check if has reference to Focus NFe
    if (!mdfe.referencia_focus) {
      throw new Error('MDFe ainda não foi transmitido para SEFAZ');
    }

    // Query Focus NFe
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
    
    console.log(`[MDFe Consultar] Resposta Focus NFe:`, JSON.stringify(focusData));

    // Get user profile for logging
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Update MDFe based on response
    let newStatus = mdfe.status;
    let protocolo = mdfe.protocolo_autorizacao;

    if (focusData.status === 'autorizado') {
      newStatus = 'AUTORIZADO';
      protocolo = focusData.protocolo || protocolo;
    } else if (focusData.status === 'cancelado') {
      newStatus = 'CANCELADO';
    } else if (focusData.status === 'encerrado') {
      newStatus = 'ENCERRADO';
    } else if (focusData.status === 'processando_autorizacao' || focusData.status === 'processando') {
      newStatus = 'PROCESSANDO';
    } else if (focusData.status === 'erro_autorizacao' || focusData.status === 'rejeitado') {
      newStatus = 'REJEITADO';
    }

    // Only update if status changed
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

      if (newStatus === 'AUTORIZADO' && !mdfe.data_autorizacao) {
        updateData.data_autorizacao = new Date().toISOString();
      }

      await supabaseClient
        .from('mdfe_manifestos')
        .update(updateData)
        .eq('id', mdfe_id);

      // Log the operation
      if (profile) {
        await supabaseClient.from('mdfe_logs').insert({
          mdfe_id: mdfe.id,
          user_id: profile.id,
          tipo_operacao: 'CONSULTA',
          resposta_sefaz: focusData,
          codigo_retorno: focusData.status_sefaz?.toString() || focusData.status,
          mensagem_retorno: focusData.mensagem_sefaz || focusData.status,
          sucesso: true,
          observacao: `Status atualizado: ${mdfe.status} -> ${newStatus}`,
        });
      }
    }

    console.log(`[MDFe Consultar] MDFe ${mdfe_id} - Status: ${newStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        status_anterior: mdfe.status,
        alterado: newStatus !== mdfe.status,
        protocolo: focusData.protocolo || protocolo,
        chave: focusData.chave || mdfe.chave_acesso,
        xml_url: focusData.caminho_xml_nota_fiscal,
        dacte_url: focusData.caminho_danfe,
        dados_sefaz: focusData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Consultar] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
