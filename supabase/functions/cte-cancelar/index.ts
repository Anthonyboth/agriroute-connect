import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelPayload {
  cte_id?: string;
  referencia?: string;
  justificativa: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FOCUS_NFE_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!FOCUS_NFE_TOKEN) {
      console.error('[CT-e Cancelar] Token Focus NFe não configurado');
      return new Response(
        JSON.stringify({ error: 'Token Focus NFe não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Criar cliente Supabase com service role para operações administrativas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar cliente Supabase para autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação requerida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const payload: CancelPayload = await req.json();
    const { cte_id, referencia, justificativa } = payload;

    // Validar justificativa (15-255 caracteres conforme Focus NFe)
    if (!justificativa || justificativa.length < 15 || justificativa.length > 255) {
      return new Response(
        JSON.stringify({ 
          error: 'Justificativa inválida',
          message: 'A justificativa deve ter entre 15 e 255 caracteres'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar CT-e
    let cteQuery = supabaseAdmin.from('ctes').select(`
      id, referencia, chave, status, ambiente, created_at, authorized_at,
      empresa:empresa_id(id, ambiente_fiscal),
      frete:frete_id(id, producer_id, driver_id, company_id)
    `);

    if (cte_id) {
      cteQuery = cteQuery.eq('id', cte_id);
    } else if (referencia) {
      cteQuery = cteQuery.eq('referencia', referencia);
    } else {
      return new Response(
        JSON.stringify({ error: 'Informe cte_id ou referencia' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { data: cte, error: cteError } = await cteQuery.maybeSingle();

    if (cteError || !cte) {
      return new Response(
        JSON.stringify({ error: 'CT-e não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verificar se CT-e está autorizado
    if (cte.status !== 'autorizado') {
      return new Response(
        JSON.stringify({ 
          error: 'CT-e não pode ser cancelado',
          message: `Status atual: ${cte.status}. Apenas CT-es autorizados podem ser cancelados.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar prazo legal (geralmente 7 dias para cancelamento)
    const authorizedAt = new Date(cte.authorized_at || cte.created_at);
    const now = new Date();
    const hoursSinceAuthorization = (now.getTime() - authorizedAt.getTime()) / (1000 * 60 * 60);
    const maxHours = 168; // 7 dias

    if (hoursSinceAuthorization > maxHours) {
      return new Response(
        JSON.stringify({ 
          error: 'Prazo de cancelamento expirado',
          message: `O CT-e foi autorizado há mais de ${Math.floor(hoursSinceAuthorization / 24)} dias. O prazo legal para cancelamento é de 7 dias.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar permissões do usuário
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    const frete = cte.frete as any;
    const isAdmin = userProfile?.role === 'admin';
    const isTransportadora = userProfile?.role === 'TRANSPORTADORA';
    const isOwner = frete && (frete.producer_id === userProfile?.id || frete.driver_id === userProfile?.id);

    if (!isAdmin && !isTransportadora && !isOwner) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para cancelar este CT-e' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Determinar ambiente
    const empresa = cte.empresa as any;
    const isProducao = empresa?.ambiente_fiscal === 'producao';
    const focusBaseUrl = isProducao
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    console.log(`[CT-e Cancelar] Cancelando ${cte.referencia} em ${isProducao ? 'produção' : 'homologação'}`);

    // Chamar API Focus NFe para cancelar
    // Documentação: DELETE /v2/cte/{ref} com body { justificativa: "..." }
    const focusResponse = await fetch(`${focusBaseUrl}/v2/cte/${cte.referencia}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(FOCUS_NFE_TOKEN + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa }),
    });

    const focusData = await focusResponse.json();
    console.log('[CT-e Cancelar] Resposta Focus:', focusData);

    if (!focusResponse.ok && focusResponse.status !== 200) {
      // Atualizar CT-e com erro
      await supabaseAdmin
        .from('ctes')
        .update({
          mensagem_erro: focusData.mensagem || focusData.erros?.join(', ') || 'Erro ao cancelar',
          resposta_sefaz: focusData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cte.id);

      // Log de auditoria
      await supabaseAdmin.from('auditoria_eventos').insert({
        tipo: 'ERRO_CANCELAMENTO_CTE',
        codigo_regra: 'CTE_CANCEL_001',
        descricao: `Erro ao cancelar CT-e: ${focusData.mensagem || 'Erro desconhecido'}`,
        severidade: 'MEDIA',
        frete_id: frete?.id,
        evidencias: {
          cte_id: cte.id,
          referencia: cte.referencia,
          response: focusData,
          user_id: user.id,
        },
      });

      return new Response(
        JSON.stringify({ 
          error: 'Falha ao cancelar CT-e',
          message: focusData.mensagem || 'Erro na comunicação com SEFAZ',
          details: focusData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Atualizar status do CT-e
    const updateData: Record<string, any> = {
      status: 'cancelado',
      resposta_sefaz: focusData,
      updated_at: new Date().toISOString(),
    };

    if (focusData.status === 'cancelado') {
      updateData.status = 'cancelado';
    }

    const { error: updateError } = await supabaseAdmin
      .from('ctes')
      .update(updateData)
      .eq('id', cte.id);

    if (updateError) {
      console.error('[CT-e Cancelar] Erro ao atualizar CT-e:', updateError);
    }

    // Log de auditoria
    await supabaseAdmin.from('auditoria_eventos').insert({
      tipo: 'CTE_CANCELADO',
      codigo_regra: 'CTE_CANCEL_SUCCESS',
      descricao: `CT-e ${cte.referencia} cancelado com sucesso`,
      severidade: 'INFO',
      frete_id: frete?.id,
      evidencias: {
        cte_id: cte.id,
        referencia: cte.referencia,
        chave: cte.chave,
        justificativa,
        cancelado_por: user.id,
        cancelado_em: new Date().toISOString(),
      },
    });

    // Log no compliance_audit_events
    await supabaseAdmin.from('compliance_audit_events').insert({
      event_type: 'CTE_CANCELLED',
      event_category: 'fiscal',
      freight_id: frete?.id,
      actor_id: userProfile?.id,
      event_data: {
        cte_id: cte.id,
        referencia: cte.referencia,
        chave: cte.chave,
        justificativa,
        response: focusData,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'CT-e cancelado com sucesso',
        cte: {
          id: cte.id,
          referencia: cte.referencia,
          chave: cte.chave,
          status: 'cancelado',
        },
        sefaz_response: focusData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[CT-e Cancelar] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
