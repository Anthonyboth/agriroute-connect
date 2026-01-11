import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerarEventoCancelamento } from '../_shared/mdfe-utils.ts';

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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Não autenticado');
    }

    const { mdfe_id, justificativa } = await req.json();

    if (!mdfe_id) {
      throw new Error('mdfe_id é obrigatório');
    }

    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    }

    console.log(`[MDFe Cancelar] Cancelando MDFe ${mdfe_id}`);

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    // Get MDFe
    const { data: mdfe, error: mdfeError } = await supabaseClient
      .from('mdfe_manifestos')
      .select('*')
      .eq('id', mdfe_id)
      .single();

    if (mdfeError || !mdfe) {
      throw new Error('MDFe não encontrado');
    }

    // Check permission
    if (mdfe.emitted_by_id !== profile.id) {
      throw new Error('Apenas o emitente pode cancelar o MDFe');
    }

    // Check status
    if (mdfe.status !== 'AUTORIZADO' && mdfe.status !== 'CONTINGENCIA') {
      throw new Error('Apenas MDFe autorizado ou em contingência pode ser cancelado');
    }

    // Check 24h limit
    const emissaoTime = new Date(mdfe.data_emissao).getTime();
    const now = new Date().getTime();
    const hoursDiff = (now - emissaoTime) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      throw new Error('MDFe só pode ser cancelado até 24 horas após a emissão');
    }

    // If MDFe was transmitted to SEFAZ, use the event transmission function
    if (mdfe.referencia_focus) {
      console.log(`[MDFe Cancelar] Transmitindo cancelamento para SEFAZ...`);
      
      try {
        const eventoResponse = await supabaseClient.functions.invoke('mdfe-transmitir-evento', {
          body: {
            mdfe_id,
            tipo_evento: 'CANCELAMENTO',
            justificativa,
          },
        });

        const eventoResult = eventoResponse.data;
        
        if (!eventoResult?.success) {
          throw new Error(eventoResult?.mensagem || eventoResult?.error || 'Erro ao cancelar na SEFAZ');
        }

        console.log(`[MDFe Cancelar] MDFe ${mdfe_id} cancelado com sucesso via SEFAZ`);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'MDFe cancelado com sucesso na SEFAZ',
            status: eventoResult.status,
            dados_sefaz: eventoResult.dados_sefaz,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } catch (transmissaoError) {
        console.error('[MDFe Cancelar] Erro na transmissão do cancelamento:', transmissaoError);
        throw new Error(`Erro ao cancelar na SEFAZ: ${transmissaoError.message}`);
      }
    }

    // Fallback: Local cancelamento for contingency MDFe
    const eventoXml = gerarEventoCancelamento(
      mdfe.chave_acesso,
      mdfe.protocolo_autorizacao,
      justificativa
    );

    // Update MDFe status locally
    const { error: updateError } = await supabaseClient
      .from('mdfe_manifestos')
      .update({
        status: 'CANCELADO',
        motivo_cancelamento: justificativa,
      })
      .eq('id', mdfe_id);

    if (updateError) {
      throw updateError;
    }

    // Log operation
    await supabaseClient.from('mdfe_logs').insert({
      mdfe_id: mdfe.id,
      user_id: profile.id,
      tipo_operacao: 'CANCELAMENTO',
      xml_enviado: eventoXml,
      sucesso: true,
      observacao: `MDFe cancelado localmente (contingência). Motivo: ${justificativa}`,
    });

    console.log(`[MDFe Cancelar] MDFe ${mdfe_id} cancelado localmente (contingência)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MDFe cancelado localmente. Transmitir para SEFAZ quando disponível.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Cancelar] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
