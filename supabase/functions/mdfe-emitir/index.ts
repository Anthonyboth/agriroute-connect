import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerarChaveAcesso, gerarXMLMDFe, type MDFeData } from '../_shared/mdfe-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Service role client para operações internas
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Não autenticado');
    }

    // Parse request
    const { freight_id, modo = 'CONTINGENCIA', documentos = [] } = await req.json();

    if (!freight_id) {
      throw new Error('freight_id é obrigatório');
    }

    console.log(`[MDFe Emitir] Iniciando emissão para frete ${freight_id}, modo: ${modo}`);

    // ==========================================
    // COBRANÇA PIX DESATIVADA TEMPORARIAMENTE
    // Feature flag: enable_emission_billing = false
    // Reativar quando Pagar.me estiver pronto para produção
    // ==========================================
    console.log(`[MDFe Emitir] Cobrança PIX desativada - emissão gratuita para testes`);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role, document, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Perfil não encontrado');
    }

    // Get freight data - use drivers_assigned instead of driver_id
    const { data: freight, error: freightError } = await supabaseClient
      .from('freights')
      .select(`
        *,
        producer:producer_id(id, full_name, document)
      `)
      .eq('id', freight_id)
      .single();

    if (freightError || !freight) {
      throw new Error('Frete não encontrado');
    }

    // Resolve driver from drivers_assigned array or driver_id fallback
    const assignedDriverId = freight.drivers_assigned?.length
      ? freight.drivers_assigned[0]
      : freight.driver_id || null;

    let driverData: { id: string; full_name: string; document: string } | null = null;
    if (assignedDriverId) {
      const { data: driverProfile } = await supabaseClient
        .from('profiles')
        .select('id, full_name, document')
        .eq('id', assignedDriverId)
        .single();
      driverData = driverProfile;
    }

    // Verify user permission
    const isProducer = freight.producer_id === profile.id;
    const isDriver = assignedDriverId === profile.id;
    const isCompany = freight.company_id && await checkCompanyOwnership(supabaseClient, profile.id, freight.company_id);

    if (!isProducer && !isDriver && !isCompany) {
      throw new Error('Você não tem permissão para emitir MDFe para este frete');
    }

    // Check if MDFe already exists
    const { data: existingMDFe } = await supabaseClient
      .from('mdfe_manifestos')
      .select('id')
      .eq('freight_id', freight_id)
      .maybeSingle();

    if (existingMDFe) {
      throw new Error('Já existe um MDFe emitido para este frete');
    }

    // Determine emitter type
    let emitterType = 'PRODUCER';
    let companyId = null;

    if (isCompany) {
      emitterType = 'COMPANY';
      companyId = freight.company_id;
    } else if (isDriver && !isProducer) {
      emitterType = 'DRIVER';
    }

    // Get emitter config
    const { data: config } = await supabaseClient
      .from('mdfe_config')
      .select('*')
      .or(`company_id.eq.${companyId},user_id.eq.${profile.id}`)
      .single();

    if (!config || !config.cnpj || !config.inscricao_estadual || !config.rntrc) {
      throw new Error('Configuração de emissão incompleta. Configure CNPJ, IE e RNTRC antes de emitir.');
    }

    // Get vehicle data - try assigned driver first, then current user
    const driverForVehicle = assignedDriverId || profile.id;
    const { data: vehicle } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('driver_id', driverForVehicle)
      .limit(1)
      .single();

    if (!vehicle) {
      throw new Error('Veículo não encontrado. Cadastre um veículo antes de emitir o MDFe.');
    }

    // Get next numero_mdfe
    const nextNumero = (config.ultimo_numero_mdfe || 0) + 1;

    // Extract municipality codes from addresses
    const originCity = await getCityFromAddress(supabaseClient, freight.origin_address, freight.origin_city);
    const destCity = await getCityFromAddress(supabaseClient, freight.destination_address, freight.destination_city);

    // Prepare MDFe data
    const mdfeData: MDFeData = {
      numero: nextNumero.toString(),
      serie: config.serie_mdfe || '1',
      emitente: {
        cnpj: config.cnpj,
        inscricaoEstadual: config.inscricao_estadual,
        rntrc: config.rntrc,
        razaoSocial: config.razao_social || '',
        nomeFantasia: config.nome_fantasia,
        endereco: {
          logradouro: config.logradouro || '',
          numero: config.numero || 'SN',
          bairro: config.bairro || '',
          codigoMunicipio: config.municipio_codigo || '5103403',
          nomeMunicipio: config.municipio_nome || 'Cuiabá',
          uf: config.uf || 'MT',
          cep: config.cep || '',
        },
      },
      percurso: {
        ufInicio: originCity.uf || 'MT',
        ufFim: destCity.uf || 'MT',
      },
      carregamento: {
        codigoMunicipio: originCity.codigo || '5103403',
        nomeMunicipio: originCity.nome || freight.origin_city || 'Cuiabá',
      },
      descarregamento: {
        codigoMunicipio: destCity.codigo || '5103403',
        nomeMunicipio: destCity.nome || freight.destination_city || 'Cuiabá',
      },
      veiculo: {
        placa: vehicle.license_plate,
        renavam: vehicle.renavam || '00000000000',
        tara: vehicle.tara || 8000,
        capacidadeKg: vehicle.capacity_kg || 30000,
        tipoRodado: vehicle.type || 'TRUCK',
        tipoCarroceria: 'FECHADA',
      },
      condutor: {
        cpf: driverData?.document || profile.document || '',
        nome: driverData?.full_name || profile.full_name || '',
      },
      documentos: documentos,
      carga: {
        pesoKg: freight.weight || 1000,
        valor: freight.price || 0,
      },
      cneTest: config.cne_test || '7120-1/00',
    };

    // Generate access key
    const chaveAcesso = gerarChaveAcesso(mdfeData);

    // Generate XML
    const xml = gerarXMLMDFe(mdfeData, chaveAcesso);

    console.log(`[MDFe Emitir] Chave gerada: ${chaveAcesso}`);

    // Insert manifesto
    const { data: mdfe, error: mdfeError } = await supabaseClient
      .from('mdfe_manifestos')
      .insert({
        freight_id,
        emitted_by_id: profile.id,
        emitter_type: emitterType,
        company_id: companyId,
        numero_mdfe: nextNumero.toString(),
        serie: config.serie_mdfe || '1',
        chave_acesso: chaveAcesso,
        cne_test: config.cne_test || '7120-1/00',
        xml_contingencia: xml,
        status: modo === 'CONTINGENCIA' ? 'CONTINGENCIA' : 'PENDENTE',
        modo_emissao: modo === 'CONTINGENCIA' ? 'CONTINGENCIA_FSDA' : 'NORMAL',
        uf_inicio: originCity.uf || 'MT',
        uf_fim: destCity.uf || 'MT',
        municipio_carregamento_codigo: originCity.codigo || '5103403',
        municipio_carregamento_nome: originCity.nome || freight.origin_city || 'Cuiabá',
        municipio_descarregamento_codigo: destCity.codigo || '5103403',
        municipio_descarregamento_nome: destCity.nome || freight.destination_city || 'Cuiabá',
        peso_bruto_kg: freight.weight || 1000,
        valor_carga: freight.price || 0,
      })
      .select()
      .single();

    if (mdfeError) {
      console.error('[MDFe Emitir] Erro ao inserir manifesto:', mdfeError);
      throw mdfeError;
    }

    // Insert condutor
    await supabaseClient.from('mdfe_condutores').insert({
      mdfe_id: mdfe.id,
      driver_id: assignedDriverId || profile.id,
      cpf: mdfeData.condutor.cpf,
      nome: mdfeData.condutor.nome,
    });

    // Insert veiculo
    await supabaseClient.from('mdfe_veiculos').insert({
      mdfe_id: mdfe.id,
      vehicle_id: vehicle.id,
      placa: vehicle.license_plate,
      renavam: vehicle.renavam || '00000000000',
      tara: vehicle.tara || 8000,
      capacidade_kg: vehicle.capacity_kg || 30000,
      tipo_rodado: vehicle.type || 'TRUCK',
      tipo_carroceria: 'FECHADA',
      tipo_proprietario: 'PROPRIO',
    });

    // Insert documentos
    if (documentos.length > 0) {
      await supabaseClient.from('mdfe_documentos').insert(
        documentos.map((doc: any) => ({
          mdfe_id: mdfe.id,
          tipo_documento: doc.tipo,
          chave_acesso: doc.chave,
          numero_documento: doc.numero,
          serie_documento: doc.serie,
          valor: doc.valor,
        }))
      );
    }

    // Update config ultimo_numero
    await supabaseClient
      .from('mdfe_config')
      .update({ ultimo_numero_mdfe: nextNumero })
      .eq('id', config.id);

    // Log operation
    await supabaseClient.from('mdfe_logs').insert({
      mdfe_id: mdfe.id,
      user_id: profile.id,
      tipo_operacao: 'EMISSAO',
      sucesso: true,
      observacao: `MDFe emitido em modo ${modo}`,
    });

    // Generate DACTE
    try {
      await supabaseClient.functions.invoke('mdfe-gerar-dacte', {
        body: { mdfe_id: mdfe.id },
      });
    } catch (dacteError) {
      console.error('[MDFe Emitir] Erro ao gerar DACTE:', dacteError);
    }

    // If not contingency mode, transmit to SEFAZ automatically
    let transmissaoResult = null;
    if (modo !== 'CONTINGENCIA') {
      console.log(`[MDFe Emitir] Transmitindo MDFe para SEFAZ...`);
      try {
        const transmissaoResponse = await supabaseClient.functions.invoke('mdfe-transmitir', {
          body: { mdfe_id: mdfe.id },
        });
        transmissaoResult = transmissaoResponse.data;
        console.log(`[MDFe Emitir] Resultado transmissão:`, transmissaoResult);
      } catch (transmissaoError) {
        console.error('[MDFe Emitir] Erro na transmissão:', transmissaoError);
        transmissaoResult = { error: transmissaoError.message };
      }
    }

    console.log(`[MDFe Emitir] MDFe ${mdfe.id} emitido com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        mdfe_id: mdfe.id,
        chave_acesso: transmissaoResult?.chave || chaveAcesso,
        numero: nextNumero,
        serie: config.serie_mdfe || '1',
        status: transmissaoResult?.status || mdfe.status,
        protocolo: transmissaoResult?.protocolo,
        transmissao: transmissaoResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[MDFe Emitir] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function checkCompanyOwnership(supabase: any, profileId: string, companyId: string): Promise<boolean> {
  const { data } = await supabase
    .from('transport_companies')
    .select('id')
    .eq('id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle();

  return !!data;
}

async function getCityFromAddress(supabase: any, address: string, cityName: string) {
  // Try to find city in database
  const { data: city } = await supabase
    .from('cities')
    .select('ibge_code, name, state')
    .ilike('name', `%${cityName}%`)
    .limit(1)
    .maybeSingle();

  if (city) {
    return {
      codigo: city.ibge_code || '5103403',
      nome: city.name,
      uf: city.state,
    };
  }

  // Default to Cuiabá
  return {
    codigo: '5103403',
    nome: 'Cuiabá',
    uf: 'MT',
  };
}
