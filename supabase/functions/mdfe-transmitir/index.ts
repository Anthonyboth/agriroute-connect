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

    console.log(`[MDFe Transmitir] Iniciando transmissão para MDFe ${mdfe_id}`);

    // Get MDFe data with all related info
    const { data: mdfe, error: mdfeError } = await supabaseClient
      .from('mdfe_manifestos')
      .select(`
        *,
        condutores:mdfe_condutores(*),
        veiculos:mdfe_veiculos(*),
        documentos:mdfe_documentos(*),
        freight:freight_id(*)
      `)
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

    if (!profile || mdfe.emitted_by_id !== profile.id) {
      throw new Error('Você não tem permissão para transmitir este MDFe');
    }

    // Check status - only transmit if in CONTINGENCIA or PENDENTE
    if (mdfe.status !== 'CONTINGENCIA' && mdfe.status !== 'PENDENTE') {
      throw new Error(`MDFe não pode ser transmitido. Status atual: ${mdfe.status}`);
    }

    // Get emitter config
    const { data: config } = await supabaseClient
      .from('mdfe_config')
      .select('*')
      .or(`user_id.eq.${profile.id}`)
      .single();

    if (!config) {
      throw new Error('Configuração de emissor não encontrada');
    }

    // Determine environment
    const ambiente = config.ambiente_fiscal === 'producao' ? 1 : 2; // 1=Produção, 2=Homologação

    // Build payload for Focus NFe
    const referencia = `MDFE-${mdfe.id.substring(0, 8)}`;
    
    // Get vehicle info
    const veiculo = mdfe.veiculos?.[0];
    const condutor = mdfe.condutores?.[0];

    // Build MDF-e payload according to Focus NFe API
    const payload = {
      modal_rodoviario: {
        rntrc: config.rntrc,
        ciot: [],
        contratante: [],
        vale_pedagio: [],
        veiculo_tracao: {
          codigo_interno: veiculo?.vehicle_id || 'VEI001',
          placa: veiculo?.placa || '',
          renavam: veiculo?.renavam || '',
          tara: veiculo?.tara || 8000,
          capacidade_kg: veiculo?.capacidade_kg || 30000,
          tipo_rodado: mapTipoRodado(veiculo?.tipo_rodado),
          tipo_carroceria: mapTipoCarroceria(veiculo?.tipo_carroceria),
          tipo_proprietario: 0, // TAC Agregado
          uf: config.uf || 'MT',
          condutor: [{
            cpf: condutor?.cpf?.replace(/\D/g, '') || '',
            nome: condutor?.nome || '',
          }],
          proprietario: {
            cpf_cnpj: config.cnpj?.replace(/\D/g, '') || '',
            rntrc: config.rntrc || '',
            nome_razao_social: config.razao_social || '',
            inscricao_estadual: config.inscricao_estadual?.replace(/\D/g, '') || '',
            tipo_proprietario: 0,
          },
        },
        veiculo_reboque: [],
        lacres_rodoviarios: [],
      },
      uf_inicio: mdfe.uf_inicio || 'MT',
      uf_fim: mdfe.uf_fim || 'MT',
      encerramento: {
        uf: mdfe.uf_fim || 'MT',
        codigo_municipio: mdfe.municipio_descarregamento_codigo || '5103403',
      },
      municipio_carregamento: [{
        codigo_municipio: mdfe.municipio_carregamento_codigo || '5103403',
        nome_municipio: mdfe.municipio_carregamento_nome || 'Cuiabá',
      }],
      municipio_descarregamento: [{
        codigo_municipio: mdfe.municipio_descarregamento_codigo || '5103403',
        nome_municipio: mdfe.municipio_descarregamento_nome || 'Cuiabá',
        ...buildDocumentos(mdfe.documentos || []),
      }],
      cnpj_emitente: config.cnpj?.replace(/\D/g, '') || '',
      inscricao_estadual_emitente: config.inscricao_estadual?.replace(/\D/g, '') || '',
      nome_emitente: config.razao_social || '',
      nome_fantasia_emitente: config.nome_fantasia || config.razao_social || '',
      fone_emitente: config.telefone || '',
      logradouro_emitente: config.logradouro || '',
      numero_emitente: config.numero || 'SN',
      bairro_emitente: config.bairro || '',
      codigo_municipio_emitente: config.municipio_codigo || '5103403',
      nome_municipio_emitente: config.municipio_nome || 'Cuiabá',
      cep_emitente: config.cep?.replace(/\D/g, '') || '',
      uf_emitente: config.uf || 'MT',
      valor_carga: mdfe.valor_carga || 0,
      codigo_unidade_medida_peso_bruto: '01', // KG
      peso_bruto: mdfe.peso_bruto_kg || 1000,
      quantidade_carga: 1,
      informacoes_adicionais_fisco: '',
      informacoes_complementares: `MDF-e emitido pelo AgriRoute. Frete ID: ${mdfe.freight_id}`,
    };

    console.log(`[MDFe Transmitir] Enviando para Focus NFe - Ref: ${referencia}, Ambiente: ${ambiente === 1 ? 'Produção' : 'Homologação'}`);

    // Send to Focus NFe
    const focusResponse = await fetch(`${FOCUS_NFE_BASE_URL}/v2/mdfe?ref=${referencia}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(focusToken + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const focusData = await focusResponse.json();
    
    console.log(`[MDFe Transmitir] Resposta Focus NFe:`, JSON.stringify(focusData));

    // Update MDFe based on response
    let newStatus = mdfe.status;
    let protocolo = null;
    let mensagemErro = null;

    if (focusData.status === 'autorizado') {
      newStatus = 'AUTORIZADO';
      protocolo = focusData.protocolo;
    } else if (focusData.status === 'processando_autorizacao' || focusData.status === 'processando') {
      newStatus = 'PROCESSANDO';
    } else if (focusData.status === 'erro_autorizacao' || focusData.status === 'rejeitado') {
      newStatus = 'REJEITADO';
      mensagemErro = focusData.mensagem || focusData.mensagem_sefaz || 'Erro na autorização';
    } else if (focusData.status_sefaz) {
      // Handle direct SEFAZ response
      if (focusData.status_sefaz === 100) {
        newStatus = 'AUTORIZADO';
        protocolo = focusData.protocolo;
      } else {
        newStatus = 'REJEITADO';
        mensagemErro = focusData.mensagem_sefaz || `Código SEFAZ: ${focusData.status_sefaz}`;
      }
    }

    // Update MDFe record
    const updateData: Record<string, any> = {
      status: newStatus,
      referencia_focus: referencia,
      ambiente_fiscal: ambiente === 1 ? 'producao' : 'homologacao',
      resposta_sefaz: focusData,
    };

    if (protocolo) {
      updateData.protocolo_autorizacao = protocolo;
      updateData.data_autorizacao = new Date().toISOString();
    }

    if (focusData.chave) {
      updateData.chave_acesso = focusData.chave;
    }

    if (mensagemErro) {
      updateData.mensagem_erro = mensagemErro;
    }

    const { error: updateError } = await supabaseClient
      .from('mdfe_manifestos')
      .update(updateData)
      .eq('id', mdfe_id);

    if (updateError) {
      console.error('[MDFe Transmitir] Erro ao atualizar MDFe:', updateError);
    }

    // Log the operation
    await supabaseClient.from('mdfe_logs').insert({
      mdfe_id: mdfe.id,
      user_id: profile.id,
      tipo_operacao: 'TRANSMISSAO',
      xml_enviado: JSON.stringify(payload),
      resposta_sefaz: focusData,
      codigo_retorno: focusData.status_sefaz?.toString() || focusData.status,
      mensagem_retorno: focusData.mensagem_sefaz || focusData.mensagem || focusData.status,
      sucesso: newStatus === 'AUTORIZADO' || newStatus === 'PROCESSANDO',
      observacao: `Transmitido via Focus NFe. Status: ${newStatus}`,
    });

    console.log(`[MDFe Transmitir] MDFe ${mdfe_id} - Status: ${newStatus}`);

    return new Response(
      JSON.stringify({
        success: newStatus === 'AUTORIZADO' || newStatus === 'PROCESSANDO',
        status: newStatus,
        protocolo,
        chave: focusData.chave || mdfe.chave_acesso,
        referencia,
        mensagem: mensagemErro || `MDFe ${newStatus.toLowerCase()}`,
        dados_sefaz: focusData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Transmitir] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function mapTipoRodado(tipo: string | null): number {
  const map: Record<string, number> = {
    'TRUCK': 2,
    'TOCO': 3,
    'CAVALO_MECANICO': 4,
    'VAN': 5,
    'UTILITARIO': 6,
    'OUTROS': 1,
  };
  return map[tipo || 'TRUCK'] || 2;
}

function mapTipoCarroceria(tipo: string | null): number {
  const map: Record<string, number> = {
    'FECHADA': 0,
    'GRANELEIRA': 1,
    'PORTA_CONTAINER': 2,
    'SIDER': 3,
    'ABERTA': 4,
  };
  return map[tipo || 'FECHADA'] || 0;
}

function buildDocumentos(documentos: any[]): Record<string, any> {
  const nfes: string[] = [];
  const ctes: string[] = [];

  for (const doc of documentos) {
    if (doc.tipo_documento === 'NFE' && doc.chave_acesso) {
      nfes.push(doc.chave_acesso);
    } else if (doc.tipo_documento === 'CTE' && doc.chave_acesso) {
      ctes.push(doc.chave_acesso);
    }
  }

  const result: Record<string, any> = {};
  
  if (nfes.length > 0) {
    result.nfe = nfes.map(chave => ({ chave }));
  }
  
  if (ctes.length > 0) {
    result.cte = ctes.map(chave => ({ chave }));
  }

  return result;
}
