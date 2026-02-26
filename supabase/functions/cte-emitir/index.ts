import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CTePayload {
  frete_id: string;
  empresa_id: string;
  nfe_chaves?: string[];
}

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

    const payload: CTePayload = await req.json();
    const { frete_id, empresa_id, nfe_chaves = [] } = payload;

    if (!frete_id || !empresa_id) {
      throw new Error('frete_id e empresa_id são obrigatórios');
    }

    console.log(`[CT-e Emitir] Iniciando emissão para frete ${frete_id}`);

    // ==========================================
    // COBRANÇA PIX DESATIVADA TEMPORARIAMENTE
    // Feature flag: enable_emission_billing = false
    // Reativar quando Pagar.me estiver pronto para produção
    // ==========================================
    console.log(`[CT-e Emitir] Cobrança PIX desativada - emissão gratuita para testes`);

    // Verificar permissão do usuário
    const { data: profile } = await userClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'TRANSPORTADORA') {
      throw new Error('Apenas transportadoras podem emitir CT-e');
    }

    // Buscar empresa fiscal
    const { data: empresa, error: empresaError } = await supabaseClient
      .from('empresas_fiscais')
      .select('*')
      .eq('id', empresa_id)
      .single();

    if (empresaError || !empresa) {
      throw new Error('Empresa fiscal não encontrada');
    }

    // Verificar se empresa pertence ao usuário
    const { data: company } = await supabaseClient
      .from('transport_companies')
      .select('id')
      .eq('id', empresa.transport_company_id)
      .eq('profile_id', profile.id)
      .single();

    if (!company) {
      throw new Error('Você não tem permissão para emitir CT-e por esta empresa');
    }

    // Buscar dados do frete
    const { data: freight, error: freightError } = await supabaseClient
      .from('freights')
      .select(`
        *,
        driver:driver_id(id, full_name, document, phone),
        producer:producer_id(id, full_name, document)
      `)
      .eq('id', frete_id)
      .single();

    if (freightError || !freight) {
      throw new Error('Frete não encontrado');
    }

    // Verificar se já existe CT-e autorizado para este frete
    const { data: existingCte } = await supabaseClient
      .from('ctes')
      .select('id, status')
      .eq('frete_id', frete_id)
      .in('status', ['autorizado', 'pendente', 'processando'])
      .maybeSingle();

    if (existingCte) {
      throw new Error(`Já existe um CT-e ${existingCte.status} para este frete`);
    }

    // Gerar referência única
    const referencia = `CTE-${frete_id.substring(0, 8)}-${Date.now()}`;

    // Montar payload para Focus NFe
    const ctePayload = {
      natureza_operacao: "PRESTACAO DE SERVICO DE TRANSPORTE",
      cfop: "5353", // Prestação de serviço de transporte dentro do estado
      modal: "01", // Rodoviário
      tipo_servico: "0", // Normal
      
      emitente: {
        cnpj: empresa.cnpj.replace(/\D/g, ''),
        inscricao_estadual: empresa.inscricao_estadual?.replace(/\D/g, ''),
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia || empresa.razao_social,
        endereco: {
          logradouro: empresa.endereco_logradouro || '',
          numero: empresa.endereco_numero || 'SN',
          bairro: empresa.endereco_bairro || '',
          codigo_municipio: empresa.municipio_ibge,
          nome_municipio: empresa.municipio,
          uf: empresa.uf,
          cep: empresa.endereco_cep?.replace(/\D/g, '') || '',
        },
        rntrc: empresa.rntrc,
      },
      
      tomador: {
        tipo: "0", // Remetente
        cpf: freight.producer?.document?.replace(/\D/g, ''),
        razao_social: freight.producer?.full_name,
      },
      
      remetente: {
        cpf: freight.producer?.document?.replace(/\D/g, ''),
        razao_social: freight.producer?.full_name,
        endereco: {
          logradouro: freight.origin_address || '',
          nome_municipio: freight.origin_city,
          uf: freight.origin_state || 'MT',
        },
      },
      
      destinatario: {
        cpf: freight.producer?.document?.replace(/\D/g, ''),
        razao_social: freight.producer?.full_name,
        endereco: {
          logradouro: freight.destination_address || '',
          nome_municipio: freight.destination_city,
          uf: freight.destination_state || 'MT',
        },
      },
      
      valores: {
        valor_total: freight.price || 0,
        valor_receber: freight.price || 0,
      },
      
      carga: {
        valor_carga: freight.cargo_value || freight.price || 0,
        quantidade: freight.weight || 1000,
        unidade_medida: "01", // KG
        produto_predominante: freight.cargo_type || 'CARGA GERAL',
      },
      
      // Documentos referenciados (NF-e)
      documentos: nfe_chaves.map(chave => ({
        tipo: "NFE",
        chave_nfe: chave,
      })),
    };

    // Inserir registro do CT-e
    const { data: cte, error: cteError } = await supabaseClient
      .from('ctes')
      .insert({
        frete_id,
        empresa_id,
        referencia,
        payload_envio: ctePayload,
        status: 'pendente',
        ambiente: empresa.ambiente_fiscal || 'homologacao',
        modelo: '57',
        serie: '1',
      })
      .select()
      .single();

    if (cteError) {
      console.error('[CT-e Emitir] Erro ao inserir CT-e:', cteError);
      throw new Error('Erro ao criar registro do CT-e');
    }

    // Enviar para Focus NFe (simulação em homologação)
    const isProducao = empresa.ambiente_fiscal === 'producao';
    const focusUrl = isProducao
      ? 'https://api.focusnfe.com.br/v2/cte'
      : 'https://homologacao.focusnfe.com.br/v2/cte';

    console.log(`[CT-e Emitir] Enviando para ${focusUrl}`);

    const focusResponse = await fetch(`${focusUrl}?ref=${referencia}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(FOCUS_NFE_TOKEN + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ctePayload),
    });

    const focusData = await focusResponse.json();
    console.log('[CT-e Emitir] Resposta Focus:', focusData);

    // Atualizar status do CT-e
    const newStatus = focusData.status === 'autorizado' 
      ? 'autorizado' 
      : focusData.status === 'erro_autorizacao'
        ? 'rejeitado'
        : 'processando';

    await supabaseClient
      .from('ctes')
      .update({
        status: newStatus,
        chave: focusData.chave_cte || null,
        numero: focusData.numero || null,
        resposta_sefaz: focusData,
        mensagem_erro: focusData.mensagem_sefaz || null,
        authorized_at: newStatus === 'autorizado' ? new Date().toISOString() : null,
        xml_url: focusData.caminho_xml_nota_fiscal || null,
        dacte_url: focusData.caminho_dacte || null,
      })
      .eq('id', cte.id);

    // Se autorizado, executar regras antifraude
    if (newStatus === 'autorizado') {
      try {
        await supabaseClient.rpc('run_antifraud_rules', { p_freight_id: frete_id });
        console.log('[CT-e Emitir] Regras antifraude executadas');
      } catch (antifraudError) {
        console.error('[CT-e Emitir] Erro nas regras antifraude:', antifraudError);
      }
    }

    return new Response(
      JSON.stringify({
        success: newStatus !== 'rejeitado',
        cte_id: cte.id,
        referencia,
        status: newStatus,
        chave: focusData.chave_cte,
        numero: focusData.numero,
        mensagem: focusData.mensagem_sefaz,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[CT-e Emitir] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
