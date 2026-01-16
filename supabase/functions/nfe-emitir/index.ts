import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NFePayload {
  issuer_id: string;
  freight_id?: string;
  destinatario: {
    cnpj_cpf: string;
    razao_social: string;
    ie?: string;
    email?: string;
    telefone?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  itens: Array<{
    descricao: string;
    ncm?: string;
    cfop?: string;
    unidade?: string;
    quantidade: number;
    valor_unitario: number;
  }>;
  valores: {
    total: number;
    frete?: number;
    desconto?: number;
  };
  informacoes_adicionais?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Focus NFe token
    const FOCUS_NFE_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!FOCUS_NFE_TOKEN) {
      console.error('[nfe-emitir] FOCUS_NFE_TOKEN não configurado');
      throw new Error('Token do provedor fiscal não configurado');
    }

    // Setup Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: NFePayload = await req.json();
    const { issuer_id, freight_id, destinatario, itens, valores, informacoes_adicionais } = payload;

    if (!issuer_id) {
      return new Response(
        JSON.stringify({ error: 'issuer_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!destinatario?.cnpj_cpf || !destinatario?.razao_social) {
      return new Response(
        JSON.stringify({ error: 'Dados do destinatário são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!itens || itens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Pelo menos um item é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[nfe-emitir] Iniciando emissão para issuer ${issuer_id}`);

    // Fetch fiscal issuer and verify ownership
    const { data: issuer, error: issuerError } = await supabase
      .from('fiscal_issuers')
      .select('*')
      .eq('id', issuer_id)
      .single();

    if (issuerError || !issuer) {
      console.error('[nfe-emitir] Issuer não encontrado:', issuerError);
      return new Response(
        JSON.stringify({ error: 'Emissor fiscal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (issuer.profile_id !== profile.id) {
      return new Response(
        JSON.stringify({ error: 'Você não tem permissão para emitir por este emissor' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check issuer status
    if (issuer.status === 'blocked' || issuer.status === 'suspended') {
      return new Response(
        JSON.stringify({ error: 'Emissor fiscal bloqueado ou suspenso' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('fiscal_wallet')
      .select('available_balance, reserved_balance')
      .eq('issuer_id', issuer_id)
      .maybeSingle();

    if (walletError) {
      console.error('[nfe-emitir] Erro ao buscar carteira fiscal:', walletError);
    }

    console.log('[nfe-emitir] Wallet:', JSON.stringify({ issuer_id, wallet }));

    if (!wallet || wallet.available_balance < 1) {
      return new Response(
        JSON.stringify({ error: 'Saldo insuficiente de emissões. Adquira mais créditos.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference
    const internalRef = `NFE-${issuer_id.substring(0, 8)}-${Date.now()}`;
    
    // Determine environment
    const isProducao = issuer.fiscal_environment === 'production';
    const focusUrl = isProducao
      ? 'https://api.focusnfe.com.br/v2/nfe'
      : 'https://homologacao.focusnfe.com.br/v2/nfe';

    console.log(`[nfe-emitir] Ambiente: ${isProducao ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}`);
    console.log(`[nfe-emitir] URL: ${focusUrl}`);

    // Get city IBGE code for destinatario
    const destMunicipio = destinatario.endereco?.municipio || '';
    const destUf = destinatario.endereco?.uf || 'MT';
    
    let destCodigoMunicipio = '';
    if (destMunicipio) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('ibge_code')
        .ilike('name', destMunicipio)
        .eq('state', destUf)
        .maybeSingle();
      destCodigoMunicipio = cityData?.ibge_code || '';
    }

    // Build Focus NFe payload
    const nfePayload = {
      natureza_operacao: "VENDA DE MERCADORIA",
      forma_pagamento: "0", // À vista
      tipo_documento: "1", // Saída
      finalidade_emissao: "1", // Normal
      consumidor_final: destinatario.cnpj_cpf.length === 11 ? "1" : "0", // CPF = consumidor final
      
      // Emitente (from issuer)
      cnpj_emitente: issuer.document_number,
      inscricao_estadual_emitente: issuer.state_registration || '',
      nome_emitente: issuer.legal_name,
      nome_fantasia_emitente: issuer.trade_name || issuer.legal_name,
      logradouro_emitente: issuer.address_street || '',
      numero_emitente: issuer.address_number || 'SN',
      bairro_emitente: issuer.address_neighborhood || '',
      municipio_emitente: issuer.city,
      codigo_municipio_emitente: issuer.city_ibge_code || '',
      uf_emitente: issuer.uf,
      cep_emitente: issuer.address_zip_code?.replace(/\D/g, '') || '',
      
      // Map tax regime
      regime_tributario: mapTaxRegime(issuer.tax_regime),
      
      // Destinatário
      cpf_destinatario: destinatario.cnpj_cpf.length === 11 ? destinatario.cnpj_cpf : undefined,
      cnpj_destinatario: destinatario.cnpj_cpf.length === 14 ? destinatario.cnpj_cpf : undefined,
      nome_destinatario: destinatario.razao_social,
      inscricao_estadual_destinatario: destinatario.ie || '',
      email_destinatario: destinatario.email || '',
      telefone_destinatario: destinatario.telefone?.replace(/\D/g, '') || '',
      logradouro_destinatario: destinatario.endereco?.logradouro || '',
      numero_destinatario: destinatario.endereco?.numero || 'SN',
      bairro_destinatario: destinatario.endereco?.bairro || '',
      municipio_destinatario: destMunicipio,
      codigo_municipio_destinatario: destCodigoMunicipio,
      uf_destinatario: destUf,
      cep_destinatario: destinatario.endereco?.cep?.replace(/\D/g, '') || '',
      
      // Itens
      items: itens.map((item, index) => ({
        numero_item: index + 1,
        codigo_produto: String(index + 1).padStart(5, '0'),
        descricao: item.descricao,
        ncm: item.ncm || '99999999',
        cfop: item.cfop || '5102',
        unidade_comercial: item.unidade || 'UN',
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: item.valor_unitario,
        valor_bruto: item.quantidade * item.valor_unitario,
        unidade_tributavel: item.unidade || 'UN',
        quantidade_tributavel: item.quantidade,
        valor_unitario_tributavel: item.valor_unitario,
        origem: "0", // Nacional
        // ICMS for Simples Nacional
        icms_situacao_tributaria: "102", // ICMS cobrado anteriormente (Simples Nacional)
      })),
      
      // Valores totais
      valor_produtos: valores.total,
      valor_frete: valores.frete || 0,
      valor_desconto: valores.desconto || 0,
      valor_total: valores.total + (valores.frete || 0) - (valores.desconto || 0),
      
      // Frete
      modalidade_frete: "9", // Sem frete
      
      // Informações adicionais
      informacoes_complementares: informacoes_adicionais || '',
    };

    console.log(`[nfe-emitir] Enviando para Focus NFe...`);

    // Create emission record BEFORE sending to Focus
    const { data: emission, error: emissionError } = await supabase
      .from('nfe_emissions')
      .insert({
        issuer_id,
        freight_id: freight_id || null,
        internal_ref: internalRef,
        fiscal_environment: issuer.fiscal_environment,
        status: 'processing',
        emission_context: nfePayload,
        totals: {
          total_produtos: valores.total,
          total_frete: valores.frete || 0,
          total_desconto: valores.desconto || 0,
          total_nota: valores.total + (valores.frete || 0) - (valores.desconto || 0),
        },
        recipient_document: destinatario.cnpj_cpf,
        recipient_name: destinatario.razao_social,
        emission_cost: 100, // 100 centavos = R$ 1,00 custo padrão
        created_by: profile.id,
      })
      .select()
      .single();

    if (emissionError) {
      console.error('[nfe-emitir] Erro ao criar registro de emissão:', emissionError);
      throw new Error('Erro ao criar registro de emissão');
    }

    // Reserve emission credit
    await supabase.rpc('reserve_emission_credit', { p_issuer_id: issuer_id, p_emission_id: emission.id });

    // Send to Focus NFe
    let focusResponse: any;
    let focusData: any;

    try {
      focusResponse = await fetch(`${focusUrl}?ref=${internalRef}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(FOCUS_NFE_TOKEN + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nfePayload),
      });

      focusData = await focusResponse.json();
      console.log('[nfe-emitir] Resposta Focus:', JSON.stringify(focusData).substring(0, 500));
    } catch (fetchError) {
      console.error('[nfe-emitir] Erro na comunicação com Focus NFe:', fetchError);
      
      // Update emission with error
      await supabase
        .from('nfe_emissions')
        .update({
          status: 'error',
          error_message: 'Falha na comunicação com o provedor fiscal',
          updated_at: new Date().toISOString(),
        })
        .eq('id', emission.id);

      // Release reserved credit
      await supabase.rpc('release_emission_credit', { p_emission_id: emission.id });

      throw new Error('Falha na comunicação com o provedor fiscal');
    }

    // Determine status from Focus response
    let newStatus: string;
    let errorMessage: string | null = null;

    if (focusData.status === 'autorizado') {
      newStatus = 'authorized';
    } else if (focusData.status === 'cancelado') {
      newStatus = 'cancelled';
    } else if (focusData.status === 'erro_autorizacao' || focusData.status === 'rejeitado') {
      newStatus = 'denied';
      errorMessage = focusData.mensagem_sefaz || focusData.mensagem || 'Erro na autorização';
    } else if (focusData.status === 'processando_autorizacao') {
      newStatus = 'processing';
    } else {
      newStatus = 'pending';
    }

    // Update emission record
    await supabase
      .from('nfe_emissions')
      .update({
        status: newStatus,
        focus_nfe_ref: internalRef,
        focus_nfe_response: focusData,
        access_key: focusData.chave_nfe || null,
        number: focusData.numero ? String(focusData.numero) : null,
        series: focusData.serie ? String(focusData.serie) : null,
        sefaz_status_code: focusData.status_sefaz || null,
        sefaz_status_message: focusData.mensagem_sefaz || null,
        sefaz_protocol: focusData.protocolo || null,
        error_code: focusData.codigo_erro || null,
        error_message: errorMessage,
        xml_url: focusData.caminho_xml_nota_fiscal || null,
        danfe_url: focusData.caminho_danfe || null,
        authorized_at: newStatus === 'authorized' ? new Date().toISOString() : null,
        emission_paid: newStatus === 'authorized',
        updated_at: new Date().toISOString(),
      })
      .eq('id', emission.id);

    // Confirm or release credit based on status
    if (newStatus === 'authorized') {
      await supabase.rpc('confirm_emission_credit', { p_emission_id: emission.id });
      console.log(`[nfe-emitir] Emissão ${emission.id} autorizada e crédito confirmado`);
    } else if (newStatus === 'denied' || newStatus === 'error') {
      await supabase.rpc('release_emission_credit', { p_emission_id: emission.id });
      console.log(`[nfe-emitir] Emissão ${emission.id} rejeitada e crédito liberado`);
    }

    // Return response
    return new Response(
      JSON.stringify({
        success: newStatus === 'authorized' || newStatus === 'processing',
        emission_id: emission.id,
        internal_ref: internalRef,
        status: newStatus,
        numero: focusData.numero || null,
        chave: focusData.chave_nfe || null,
        danfe_url: focusData.caminho_danfe || null,
        xml_url: focusData.caminho_xml_nota_fiscal || null,
        message: newStatus === 'authorized' 
          ? 'NF-e autorizada com sucesso!' 
          : newStatus === 'processing' 
            ? 'NF-e em processamento. Aguarde.' 
            : errorMessage || 'Erro ao processar NF-e',
        ambiente: isProducao ? 'producao' : 'homologacao',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[nfe-emitir] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro interno ao processar NF-e' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to map tax regime to Focus NFe format
function mapTaxRegime(regime: string): string {
  switch (regime) {
    case 'simples_nacional':
    case 'mei':
      return '1'; // Simples Nacional
    case 'simples_nacional_excesso':
      return '2'; // Simples Nacional - excesso de sublimite de receita bruta
    case 'lucro_presumido':
    case 'lucro_real':
      return '3'; // Regime Normal
    default:
      return '1';
  }
}
