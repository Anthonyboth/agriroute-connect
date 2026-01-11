import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerarEventoEncerramento } from '../_shared/mdfe-utils.ts';

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

    const { mdfe_id, uf_encerramento, municipio_codigo_encerramento } = await req.json();

    if (!mdfe_id) {
      throw new Error('mdfe_id é obrigatório');
    }

    console.log(`[MDFe Encerrar] Encerrando MDFe ${mdfe_id}`);

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
      .select('*, freight:freight_id(producer_id, driver_id)')
      .eq('id', mdfe_id)
      .single();

    if (mdfeError || !mdfe) {
      throw new Error('MDFe não encontrado');
    }

    // Check permission
    const canEncerrar =
      mdfe.emitted_by_id === profile.id ||
      mdfe.freight.producer_id === profile.id ||
      mdfe.freight.driver_id === profile.id;

    if (!canEncerrar) {
      throw new Error('Você não tem permissão para encerrar este MDFe');
    }

    // Check status
    if (mdfe.status === 'ENCERRADO') {
      throw new Error('MDFe já está encerrado');
    }

    if (mdfe.status === 'CANCELADO') {
      throw new Error('Não é possível encerrar um MDFe cancelado');
    }

    // If MDFe was transmitted to SEFAZ, use the event transmission function
    if (mdfe.referencia_focus) {
      console.log(`[MDFe Encerrar] Transmitindo encerramento para SEFAZ...`);
      
      try {
        const eventoResponse = await supabaseClient.functions.invoke('mdfe-transmitir-evento', {
          body: {
            mdfe_id,
            tipo_evento: 'ENCERRAMENTO',
            uf_encerramento: uf_encerramento || mdfe.uf_fim,
            municipio_codigo_encerramento: municipio_codigo_encerramento || mdfe.municipio_descarregamento_codigo,
          },
        });

        const eventoResult = eventoResponse.data;
        
        if (!eventoResult?.success) {
          throw new Error(eventoResult?.mensagem || eventoResult?.error || 'Erro ao encerrar na SEFAZ');
        }

        console.log(`[MDFe Encerrar] MDFe ${mdfe_id} encerrado com sucesso via SEFAZ`);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'MDFe encerrado com sucesso na SEFAZ',
            status: eventoResult.status,
            dados_sefaz: eventoResult.dados_sefaz,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } catch (transmissaoError) {
        console.error('[MDFe Encerrar] Erro na transmissão do encerramento:', transmissaoError);
        throw new Error(`Erro ao encerrar na SEFAZ: ${transmissaoError.message}`);
      }
    }

    // Fallback: Local encerramento for contingency MDFe
    const eventoXml = gerarEventoEncerramento(
      mdfe.chave_acesso,
      mdfe.protocolo_autorizacao,
      uf_encerramento || mdfe.uf_fim,
      municipio_codigo_encerramento || mdfe.municipio_descarregamento_codigo
    );

    // Update MDFe status locally
    const { error: updateError } = await supabaseClient
      .from('mdfe_manifestos')
      .update({
        status: 'ENCERRADO',
        data_encerramento: new Date().toISOString(),
      })
      .eq('id', mdfe_id);

    if (updateError) {
      throw updateError;
    }

    // Log operation
    await supabaseClient.from('mdfe_logs').insert({
      mdfe_id: mdfe.id,
      user_id: profile.id,
      tipo_operacao: 'ENCERRAMENTO',
      xml_enviado: eventoXml,
      sucesso: true,
      observacao: 'MDFe encerrado localmente (contingência). Transmitir quando disponível.',
    });

    console.log(`[MDFe Encerrar] MDFe ${mdfe_id} encerrado localmente (contingência)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MDFe encerrado localmente. Transmitir para SEFAZ quando disponível.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Encerrar] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
