import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento para tipos SEFAZ
const MANIFESTATION_TYPE_MAP: Record<string, { code: string; description: string }> = {
  'ciencia': { code: '210210', description: 'Ciencia da Operacao' },
  'confirmacao': { code: '210200', description: 'Confirmacao da Operacao' },
  'desconhecimento': { code: '210220', description: 'Desconhecimento da Operacao' },
  'nao_realizada': { code: '210240', description: 'Operacao nao Realizada' },
  // Suporte a tipos legados
  'operation_confirmed': { code: '210200', description: 'Confirmacao da Operacao' },
  'operation_unknown': { code: '210220', description: 'Desconhecimento da Operacao' },
  'rejection': { code: '210240', description: 'Operacao nao Realizada' },
  'cancellation': { code: '210240', description: 'Operacao nao Realizada' },
};

// Mapeamento de erros SEFAZ
const SEFAZ_ERRORS: Record<string, string> = {
  '217': 'NF-e não encontrada na base da SEFAZ',
  '573': 'Evento já registrado anteriormente',
  '580': 'Prazo para manifestação encerrado',
  '539': 'CNPJ não autorizado para esta NF-e',
  '593': 'Justificativa obrigatória não informada',
  '594': 'Justificativa com menos de 15 caracteres',
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

    console.log('[nfe-manifest] Recebido:', { access_key, manifestation_type, freight_id });

    if (!access_key || !manifestation_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados inválidos', sefaz_code: '400' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter configuração do tipo de manifestação
    const typeConfig = MANIFESTATION_TYPE_MAP[manifestation_type];
    if (!typeConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de manifestação inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se justificativa é obrigatória (para desconhecimento e não realizada)
    const requiresJustification = ['desconhecimento', 'nao_realizada', 'operation_unknown', 'rejection', 'cancellation'].includes(manifestation_type);
    if (requiresJustification) {
      if (!justification || justification.trim().length < 15) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Justificativa obrigatória (mínimo 15 caracteres)',
            sefaz_code: '594'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar NF-e no banco
    const { data: nfe, error: nfeError } = await supabaseClient
      .from('nfe_documents')
      .select('*')
      .eq('access_key', access_key)
      .single();

    if (nfeError || !nfe) {
      console.log('[nfe-manifest] NF-e não encontrada no banco:', access_key);
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada', sefaz_code: '217' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (nfe.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e já foi manifestada', sefaz_code: '573' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tentar manifestar via NFE.io (se configurado)
    const nfeIoKey = Deno.env.get('NFE_IO_API_KEY');
    let protocol = null;
    
    if (nfeIoKey) {
      try {
        // Mapear tipo para API NFE.io
        const nfeIoTypeMap: Record<string, string> = {
          'ciencia': 'ciencia',
          'confirmacao': 'confirmacao',
          'desconhecimento': 'desconhecimento',
          'nao_realizada': 'nao_realizada',
          'operation_confirmed': 'confirmacao',
          'operation_unknown': 'desconhecimento',
          'rejection': 'nao_realizada',
          'cancellation': 'nao_realizada',
        };

        const manifestResponse = await fetch('https://api.nfe.io/v1/nfe/manifestations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nfeIoKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_key: access_key,
            type: nfeIoTypeMap[manifestation_type] || 'ciencia',
            justification: justification || undefined,
          }),
        });

        if (manifestResponse.ok) {
          const result = await manifestResponse.json();
          protocol = result.protocol || result.data?.protocol;
          console.log('[nfe-manifest] NFE.io response:', result);
        } else {
          const errorData = await manifestResponse.json().catch(() => ({}));
          console.error('[nfe-manifest] Erro NFE.io:', errorData);
          
          // Mapear erros da NFE.io para códigos SEFAZ
          const sefazCode = errorData.code || '999';
          const sefazMessage = SEFAZ_ERRORS[sefazCode] || errorData.message || 'Erro ao manifestar na SEFAZ';
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: sefazMessage,
              sefaz_code: sefazCode 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (apiError) {
        console.error('[nfe-manifest] Erro ao chamar NFE.io:', apiError);
        // Continuar mesmo sem NFE.io (para testes)
      }
    }

    // Normalizar tipo de manifestação para o novo padrão
    const normalizedType = manifestation_type.includes('operation') || manifestation_type === 'rejection' || manifestation_type === 'cancellation'
      ? (manifestation_type === 'operation_confirmed' ? 'confirmacao' 
         : manifestation_type === 'operation_unknown' ? 'desconhecimento' 
         : 'nao_realizada')
      : manifestation_type;

    // Atualizar no banco
    const { error: updateError } = await supabaseClient
      .from('nfe_documents')
      .update({
        status: 'manifested',
        manifestation_type: normalizedType,
        manifestation_date: new Date().toISOString(),
        manifestation_justification: justification || null,
        freight_id: freight_id || nfe.freight_id,
        updated_at: new Date().toISOString(),
      })
      .eq('access_key', access_key);

    if (updateError) {
      throw updateError;
    }

    // Log de auditoria
    console.log('[nfe-manifest] ✅ Manifestação registrada:', {
      access_key,
      type: normalizedType,
      sefaz_code: typeConfig.code,
      protocol,
      user_id: user.id,
    });

    // Enviar notificação
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          user_id: user.id,
          title: 'NF-e Manifestada',
          message: `A NF-e ${nfe.number} foi manifestada: ${typeConfig.description}`,
          type: 'nfe_manifested',
          data: {
            access_key,
            manifestation_type: normalizedType,
            sefaz_code: typeConfig.code,
            protocol,
          },
        },
      });
    } catch (notifError) {
      console.error('[nfe-manifest] Erro ao enviar notificação:', notifError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'NF-e manifestada com sucesso',
        protocol,
        sefaz_code: typeConfig.code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[nfe-manifest] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, sefaz_code: '999' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
