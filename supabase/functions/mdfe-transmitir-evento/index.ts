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

    const { mdfe_id, tipo_evento, justificativa, uf_encerramento, municipio_codigo_encerramento } = await req.json();

    if (!mdfe_id) {
      throw new Error('mdfe_id é obrigatório');
    }

    if (!tipo_evento || !['ENCERRAMENTO', 'CANCELAMENTO'].includes(tipo_evento)) {
      throw new Error('tipo_evento deve ser ENCERRAMENTO ou CANCELAMENTO');
    }

    if (tipo_evento === 'CANCELAMENTO' && (!justificativa || justificativa.length < 15)) {
      throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    }

    console.log(`[MDFe Evento] Iniciando ${tipo_evento} para MDFe ${mdfe_id}`);

    // Get MDFe data
    const { data: mdfe, error: mdfeError } = await supabaseClient
      .from('mdfe_manifestos')
      .select('*')
      .eq('id', mdfe_id)
      .single();

    if (mdfeError || !mdfe) {
      throw new Error('MDFe não encontrado');
    }

    // Verify permission
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    // Check if has reference
    if (!mdfe.referencia_focus) {
      throw new Error('MDFe ainda não foi transmitido para SEFAZ');
    }

    // Validate status for event
    if (tipo_evento === 'ENCERRAMENTO') {
      if (mdfe.status !== 'AUTORIZADO') {
        throw new Error('Apenas MDFe autorizado pode ser encerrado');
      }
    } else if (tipo_evento === 'CANCELAMENTO') {
      if (mdfe.status !== 'AUTORIZADO') {
        throw new Error('Apenas MDFe autorizado pode ser cancelado');
      }
      
      // Check 24h limit
      const emissaoTime = new Date(mdfe.data_emissao).getTime();
      const now = Date.now();
      const hoursDiff = (now - emissaoTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        throw new Error('MDFe só pode ser cancelado até 24 horas após a emissão');
      }
    }

    let focusResponse: Response;
    let eventPayload: Record<string, any> = {};

    if (tipo_evento === 'ENCERRAMENTO') {
      eventPayload = {
        uf: uf_encerramento || mdfe.uf_fim || 'MT',
        codigo_municipio: municipio_codigo_encerramento || mdfe.municipio_descarregamento_codigo || '5103403',
      };

      focusResponse = await fetch(
        `${FOCUS_NFE_BASE_URL}/v2/mdfe/${mdfe.referencia_focus}/encerramento`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(focusToken + ':')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );
    } else {
      eventPayload = {
        justificativa: justificativa,
      };

      focusResponse = await fetch(
        `${FOCUS_NFE_BASE_URL}/v2/mdfe/${mdfe.referencia_focus}/cancelamento`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(focusToken + ':')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );
    }

    const focusData = await focusResponse.json();
    
    console.log(`[MDFe Evento] Resposta Focus NFe:`, JSON.stringify(focusData));

    // Determine success
    let success = false;
    let newStatus = mdfe.status;
    let mensagemErro = null;

    if (focusData.status === 'encerrado' || focusData.status_sefaz === 135) {
      success = true;
      newStatus = 'ENCERRADO';
    } else if (focusData.status === 'cancelado' || focusData.status_sefaz === 135) {
      success = true;
      newStatus = 'CANCELADO';
    } else if (focusData.status === 'processando_encerramento' || focusData.status === 'processando_cancelamento') {
      success = true;
      newStatus = tipo_evento === 'ENCERRAMENTO' ? 'PROCESSANDO_ENCERRAMENTO' : 'PROCESSANDO_CANCELAMENTO';
    } else if (focusData.erro || focusData.status === 'erro_autorizacao') {
      success = false;
      mensagemErro = focusData.mensagem || focusData.mensagem_sefaz || 'Erro ao processar evento';
    }

    // Update MDFe
    const updateData: Record<string, any> = {
      resposta_sefaz: focusData,
    };

    if (success && newStatus !== mdfe.status) {
      updateData.status = newStatus;
      
      if (tipo_evento === 'ENCERRAMENTO') {
        updateData.data_encerramento = new Date().toISOString();
      } else if (tipo_evento === 'CANCELAMENTO') {
        updateData.motivo_cancelamento = justificativa;
      }
    }

    if (mensagemErro) {
      updateData.mensagem_erro = mensagemErro;
    }

    await supabaseClient
      .from('mdfe_manifestos')
      .update(updateData)
      .eq('id', mdfe_id);

    // Log the operation
    await supabaseClient.from('mdfe_logs').insert({
      mdfe_id: mdfe.id,
      user_id: profile.id,
      tipo_operacao: tipo_evento,
      xml_enviado: JSON.stringify(eventPayload),
      resposta_sefaz: focusData,
      codigo_retorno: focusData.status_sefaz?.toString() || focusData.status,
      mensagem_retorno: focusData.mensagem_sefaz || focusData.mensagem || focusData.status,
      sucesso: success,
      observacao: success 
        ? `${tipo_evento} realizado com sucesso`
        : `Erro no ${tipo_evento}: ${mensagemErro}`,
    });

    console.log(`[MDFe Evento] ${tipo_evento} - Sucesso: ${success}, Status: ${newStatus}`);

    return new Response(
      JSON.stringify({
        success,
        status: newStatus,
        tipo_evento,
        mensagem: success 
          ? `${tipo_evento} realizado com sucesso`
          : mensagemErro,
        dados_sefaz: focusData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: success ? 200 : 400,
      }
    );
  } catch (error) {
    console.error('[MDFe Evento] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
