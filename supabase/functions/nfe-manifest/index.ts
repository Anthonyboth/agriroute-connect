import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MANIFESTATION_TYPE_MAP: Record<string, string> = {
  'operation_confirmed': 'ciencia',
  'operation_unknown': 'desconhecimento',
  'rejection': 'nao_realizada',
  'cancellation': 'cancelamento'
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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const { access_key, manifestation_type, justification, freight_id } = await req.json();

    if (!access_key || !manifestation_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se justificativa é obrigatória
    if ((manifestation_type === 'rejection' || manifestation_type === 'cancellation') && !justification) {
      return new Response(
        JSON.stringify({ success: false, error: 'Justificativa é obrigatória para rejeição ou cancelamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar NF-e no banco
    const { data: nfe } = await supabaseClient
      .from('nfe_documents')
      .select('*')
      .eq('access_key', access_key)
      .single();

    if (!nfe) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (nfe.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e já foi manifestada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Manifestar na API da NFE.io
    const nfeIoKey = Deno.env.get('NFE_IO_API_KEY');
    const nfeIoType = MANIFESTATION_TYPE_MAP[manifestation_type] || 'ciencia';
    
    const manifestResponse = await fetch('https://api.nfe.io/v1/nfe/manifestations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nfeIoKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_key: access_key,
        type: nfeIoType,
        justification: justification || undefined,
      }),
    });

    if (!manifestResponse.ok) {
      const errorData = await manifestResponse.json();
      throw new Error(errorData.message || 'Erro ao manifestar NF-e na NFE.io');
    }

    // Atualizar no banco
    const { error: updateError } = await supabaseClient
      .from('nfe_documents')
      .update({
        status: 'manifested',
        manifestation_type: manifestation_type,
        manifestation_date: new Date().toISOString(),
        manifestation_justification: justification || null,
        freight_id: freight_id || nfe.freight_id,
        updated_at: new Date().toISOString(),
      })
      .eq('access_key', access_key);

    if (updateError) {
      throw updateError;
    }

    // Enviar notificação
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          user_id: user.id,
          title: 'NF-e Manifestada',
          message: `A NF-e ${nfe.number} foi manifestada com sucesso`,
          type: 'nfe_manifested',
          data: {
            access_key: access_key,
            manifestation_type: manifestation_type,
          },
        },
      });
    } catch (notifError) {
      console.error('Erro ao enviar notificação:', notifError);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'NF-e manifestada com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em nfe-manifest:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
