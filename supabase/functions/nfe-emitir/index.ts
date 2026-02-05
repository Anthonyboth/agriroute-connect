import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
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

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function safeUpper(v: string) {
  return (v || "").trim().toUpperCase();
}

function isValidIbgeCode(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return /^[0-9]{7}$/.test(s);
}

async function lookupCityIbgeCode(
  supabase: any,
  cityName: string,
  uf: string,
): Promise<string | null> {
  const city = String(cityName || "").trim();
  const state = safeUpper(String(uf || ""));

  if (!city || state.length !== 2) return null;

  // 1) tentativa exata (case-insensitive)
  const exact = await supabase
    .from("cities")
    .select("ibge_code")
    .eq("state", state)
    .ilike("name", city)
    .limit(1)
    .maybeSingle();

  if (exact?.data?.ibge_code && isValidIbgeCode(exact.data.ibge_code)) {
    return String(exact.data.ibge_code);
  }

  // 2) fallback por contains (para variações de escrita)
  const contains = await supabase
    .from("cities")
    .select("ibge_code")
    .eq("state", state)
    .ilike("name", `%${city}%`)
    .limit(1)
    .maybeSingle();

  if (contains?.data?.ibge_code && isValidIbgeCode(contains.data.ibge_code)) {
    return String(contains.data.ibge_code);
  }

  return null;
}

function mapTaxRegime(regime: string): string {
  switch (regime) {
    case "simples_nacional":
    case "mei":
      return "1";
    case "simples_nacional_excesso":
      return "2";
    case "lucro_presumido":
    case "lucro_real":
      return "3";
    default:
      return "1";
  }
}

async function parseJsonOrText(resp: Response): Promise<{ ok: boolean; data: any; raw: string }> {
  const raw = await resp.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }
  return { ok: resp.ok, data, raw };
}

function focusFriendlyMessage(focusData: any, httpStatus?: number) {
  // ✅ Primeiro tentar extrair erros detalhados (array de erros Focus)
  if (focusData?.erros && Array.isArray(focusData.erros) && focusData.erros.length > 0) {
    const detailedErrors = focusData.erros
      .map((e: any) => `${e.campo || 'Campo desconhecido'}: ${e.mensagem}`)
      .join('; ');
    return `Erro de validação: ${detailedErrors}`;
  }

  const msg = String(
    focusData?.mensagem_sefaz || focusData?.mensagem || focusData?.error || focusData?.raw || "",
  ).trim();

  if (msg) return msg;

  if (httpStatus) {
    if (httpStatus === 401 || httpStatus === 403) return "Falha de autenticação com o provedor fiscal.";
    if (httpStatus === 404) return "Recurso não encontrado no provedor fiscal.";
    if (httpStatus >= 400 && httpStatus < 500) return "Dados fiscais inválidos. Verifique os campos e tente novamente.";
    if (httpStatus >= 500) return "Provedor fiscal indisponível no momento. Tente novamente.";
  }

  return "Não foi possível processar a NF-e. Verifique os dados e tente novamente.";
}

Deno.serve(async (req) => {
  // ✅ CORS Preflight com status 204
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ✅ Log inicial (sem token)
  const origin = req.headers.get("Origin");
  const authHeader = req.headers.get("Authorization");
  console.log("[nfe-emitir] Request", {
    method: req.method,
    origin,
    hasAuthorization: !!authHeader,
  });

  try {
    // Token Focus
    const FOCUS_NFE_TOKEN = Deno.env.get("FOCUS_NFE_TOKEN");
    if (!FOCUS_NFE_TOKEN) {
      console.error("[nfe-emitir] FOCUS_NFE_TOKEN não configurado");
      return jsonResponse(500, {
        success: false,
        code: "CONFIG_MISSING",
        message: "Configuração fiscal indisponível. Contate o suporte.",
      });
    }

    // Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { success: false, code: "UNAUTHORIZED", message: "Não autorizado." });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return jsonResponse(401, { success: false, code: "INVALID_TOKEN", message: "Token inválido." });
    }

    // Perfil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", userData.user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse(200, { success: false, code: "PROFILE_NOT_FOUND", message: "Perfil não encontrado." });
    }

    // Payload
    let payload: NFePayload;
    try {
      payload = (await req.json()) as NFePayload;
    } catch {
      // ✅ HTTP 200 para evitar exceção no SDK Supabase e blank screen
      return jsonResponse(200, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Dados inválidos. Verifique o formulário e tente novamente.",
      });
    }

    const { issuer_id, freight_id, destinatario, itens, valores, informacoes_adicionais } = payload;

    // ✅ Log do payload para debugging
    console.log("[nfe-emitir] Payload recebido:", JSON.stringify({
      issuer_id,
      freight_id,
      destinatario: destinatario ? {
        cnpj_cpf: destinatario.cnpj_cpf ? "***" : null,
        razao_social: destinatario.razao_social || null,
        endereco: destinatario.endereco ? "presente" : null,
      } : null,
      itens_count: Array.isArray(itens) ? itens.length : 0,
      valores,
    }));

    if (!issuer_id) {
      return jsonResponse(200, { success: false, code: "INVALID_PAYLOAD", message: "issuer_id é obrigatório." });
    }

    if (!destinatario?.cnpj_cpf || !destinatario?.razao_social) {
      console.log("[nfe-emitir] ❌ Destinatário inválido:", { 
        cnpj_cpf: destinatario?.cnpj_cpf || "VAZIO", 
        razao_social: destinatario?.razao_social || "VAZIO" 
      });
      return jsonResponse(200, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Dados do destinatário são obrigatórios (CNPJ/CPF e Razão Social).",
      });
    }

    // Validação de endereço do destinatário (obrigatório para NF-e)
    const endDest = destinatario.endereco;
    const missing: string[] = [];
    const logradouro = String(endDest?.logradouro || "").trim();
    const bairro = String(endDest?.bairro || "").trim();
    const municipio = String(endDest?.municipio || "").trim();
    const uf = safeUpper(String(endDest?.uf || ""));
    const cepDigits = onlyDigits(String(endDest?.cep || ""));

    if (!logradouro) missing.push("logradouro");
    if (!bairro) missing.push("bairro");
    if (!municipio) missing.push("município");
    if (uf.length !== 2) missing.push("UF");
    if (cepDigits.length !== 8) missing.push("CEP");

    if (missing.length > 0) {
      console.log("[nfe-emitir] ❌ Endereço incompleto:", missing);
      return jsonResponse(200, {
        success: false,
        code: "INVALID_RECIPIENT_ADDRESS",
        message: `Endereço do destinatário incompleto: ${missing.join(", ")}.`,
      });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return jsonResponse(200, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Pelo menos um item é obrigatório.",
      });
    }

    // Emissor
    const { data: issuer, error: issuerError } = await supabase
      .from("fiscal_issuers")
      .select("*")
      .eq("id", issuer_id)
      .single();

    if (issuerError || !issuer) {
      console.error("[nfe-emitir] Issuer não encontrado:", issuerError);
      return jsonResponse(200, { success: false, code: "ISSUER_NOT_FOUND", message: "Emissor fiscal não encontrado." });
    }

    if (issuer.profile_id !== profile.id) {
      return jsonResponse(200, { success: false, code: "FORBIDDEN", message: "Sem permissão para este emissor." });
    }

    if (issuer.status === "blocked" || issuer.status === "suspended") {
      return jsonResponse(200, {
        success: false,
        code: "ISSUER_BLOCKED",
        message: "Emissor fiscal bloqueado ou suspenso.",
      });
    }

    // ============================================================
    // VERIFICAÇÃO DE PAGAMENTO PIX (OBRIGATÓRIO ANTES DA EMISSÃO)
    // ============================================================
    // Calcular valor da taxa baseado no total da NF-e
    const totalNfe = valores.total || 0;
    const taxaCentavos = totalNfe <= 1000 ? 1000 : 2500; // R$ 10,00 ou R$ 25,00

    console.log(`[nfe-emitir] Verificando pagamento - Total NF-e: ${totalNfe}, Taxa: ${taxaCentavos} centavos`);

    // Verificar se existe pagamento PAGO para este issuer + documento
    const { data: paidTransactions } = await supabase
      .from('fiscal_wallet_transactions')
      .select('id, metadata')
      .eq('reference_type', 'pix_payment')
      .eq('transaction_type', 'pix_paid')
      .contains('metadata', { issuer_id: issuer_id, document_type: 'nfe' })
      .order('created_at', { ascending: false })
      .limit(10);

    // Verificar se algum pagamento corresponde a esta emissão ou é um crédito disponível
    let pagamentoValido = false;
    let paymentChargeId: string | null = null;

    if (paidTransactions && paidTransactions.length > 0) {
      for (const tx of paidTransactions) {
        const meta = tx.metadata as Record<string, unknown>;
        // Se o pagamento já está vinculado a outra emissão, pular
        if (meta?.used_for_emission) continue;
        
        // Pagamento disponível encontrado
        pagamentoValido = true;
        paymentChargeId = (meta?.charge_id as string) || null;
        
        // Marcar como usado (se tiver um ID de emissão para vincular)
        // Isso será feito após a emissão ser criada
        break;
      }
    }

    // ✅ DESATIVADO: Sistema legado de créditos - PAGAMENTO PIX OBRIGATÓRIO
    // O sistema de fiscal_wallet foi descontinuado. Agora apenas PIX é aceito.
    // const { data: wallet } = await supabase.from('fiscal_wallet')...

    // Se não tem pagamento PIX válido, retornar 200 com code PAYMENT_REQUIRED
    // (HTTP 200 evita exceção no SDK Supabase e blank screen)
    if (!pagamentoValido) {
      console.log(`[nfe-emitir] ❌ Pagamento PIX não encontrado - Retornando PAYMENT_REQUIRED`);
      return jsonResponse(200, {
        success: false,
        code: 'PAYMENT_REQUIRED',
        message: 'Pagamento via PIX obrigatório antes de emitir NF-e.',
        amount_centavos: taxaCentavos,
        document_type: 'nfe',
        issuer_id: issuer_id,
        valores: {
          total: totalNfe,
          taxa: taxaCentavos / 100,
        },
      });
    }

    console.log(`[nfe-emitir] ✅ Pagamento PIX válido encontrado`);
    // ============================================================

    // Documentos sanitizados (CORREÇÃO CRÍTICA)
    const issuerDoc = onlyDigits(String(issuer.document_number || ""));
    const destDoc = onlyDigits(String(destinatario.cnpj_cpf || ""));

    const isIssuerCPF = issuerDoc.length === 11;
    const isIssuerCNPJ = issuerDoc.length === 14;
    if (!isIssuerCPF && !isIssuerCNPJ) {
      return jsonResponse(200, {
        success: false,
        code: "INVALID_ISSUER_DOCUMENT",
        message: "CPF/CNPJ do emissor inválido. Verifique o cadastro do emissor fiscal.",
      });
    }

    const isDestCPF = destDoc.length === 11;
    const isDestCNPJ = destDoc.length === 14;
    if (!isDestCPF && !isDestCNPJ) {
      return jsonResponse(200, {
        success: false,
        code: "INVALID_RECIPIENT_DOCUMENT",
        message: "CPF/CNPJ do destinatário inválido. Verifique o dado informado.",
      });
    }

    // Ref
    const internalRef = `NFE-${issuer_id.substring(0, 8)}-${Date.now()}`;

    // Ambiente
    const isProducao = issuer.fiscal_environment === "production";
    const focusUrl = isProducao ? "https://api.focusnfe.com.br/v2/nfe" : "https://homologacao.focusnfe.com.br/v2/nfe";

    // IBGE destinatário (opcional)
    const destMunicipio = (destinatario.endereco?.municipio || "").trim();
    const destUf = safeUpper(destinatario.endereco?.uf || issuer.uf || "MT");

    let destCodigoMunicipio = "";
    if (destMunicipio) {
      const { data: cityData } = await supabase
        .from("cities")
        .select("ibge_code")
        .ilike("name", destMunicipio)
        .eq("state", destUf)
        .maybeSingle();

      destCodigoMunicipio = cityData?.ibge_code || "";
    }

    // ==============================
    // VALIDAÇÃO DO ENDEREÇO DO EMITENTE (OBRIGATÓRIO PARA NF-e)
    // ==============================
    const issuerLogradouro = String(issuer.address_street || "").trim();
    const issuerBairro = String(issuer.address_neighborhood || "").trim();
    const issuerMunicipio = String(issuer.city || "").trim();
    const issuerUf = safeUpper(String(issuer.uf || ""));
    const issuerCep = onlyDigits(String(issuer.address_zip_code || ""));

    const missingIssuer: string[] = [];
    if (!issuerLogradouro) missingIssuer.push("logradouro");
    if (!issuerBairro) missingIssuer.push("bairro");
    if (!issuerMunicipio) missingIssuer.push("município");
    if (issuerUf.length !== 2) missingIssuer.push("UF");
    if (issuerCep.length !== 8) missingIssuer.push("CEP");

    if (missingIssuer.length > 0) {
      console.error("[nfe-emitir] Endereço do emissor incompleto:", missingIssuer);
      return jsonResponse(200, {
        success: false,
        code: "INVALID_ISSUER_ADDRESS",
        message: `Endereço do emissor incompleto: ${missingIssuer.join(", ")}. Atualize o cadastro fiscal.`,
      });
    }

    // ==============================
    // CÓDIGO IBGE DO MUNICÍPIO DO EMITENTE (OBRIGATÓRIO: 7 dígitos)
    // Se estiver vazio no cadastro, tenta resolver automaticamente pela tabela `cities`.
    // ==============================
    let issuerCodigoMunicipio = String(issuer.city_ibge_code || "").trim();
    if (!isValidIbgeCode(issuerCodigoMunicipio)) {
      const resolved = await lookupCityIbgeCode(supabase, issuerMunicipio, issuerUf);

      if (!resolved) {
        console.error("[nfe-emitir] city_ibge_code ausente/ inválido e não foi possível resolver:", {
          issuer_id,
          issuerMunicipio,
          issuerUf,
          current: issuerCodigoMunicipio,
        });
        return jsonResponse(200, {
          success: false,
          code: "INVALID_ISSUER_CITY_IBGE",
          message:
            "Código IBGE do município do emissor está ausente/ inválido. Reabra o Cadastro Fiscal (Etapa 2) e preencha o CEP/Cidade para salvar o município corretamente.",
        });
      }

      issuerCodigoMunicipio = resolved;

      // Persistir para evitar futuras falhas
      const { error: persistError } = await supabase
        .from("fiscal_issuers")
        .update({ city_ibge_code: issuerCodigoMunicipio, updated_at: new Date().toISOString() })
        .eq("id", issuer_id);

      if (persistError) {
        console.warn("[nfe-emitir] Não foi possível persistir city_ibge_code, seguindo com valor resolvido:", persistError);
      }
    }

    // Payload Focus (CORRIGIDO)
    const dataEmissao = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    
    const nfePayload: Record<string, unknown> = {
      data_emissao: dataEmissao,
      natureza_operacao: "VENDA DE MERCADORIA",
      forma_pagamento: "0",
      tipo_documento: "1",
      finalidade_emissao: "1",
      consumidor_final: isDestCPF ? "1" : "0",

      // Emitente: CPF ou CNPJ (CORREÇÃO)
      cpf_emitente: isIssuerCPF ? issuerDoc : undefined,
      cnpj_emitente: isIssuerCNPJ ? issuerDoc : undefined,
      // IE: se vazia, usa "ISENTO" (padrão NF-e)
      inscricao_estadual_emitente: onlyDigits(String(issuer.state_registration || "")) || "ISENTO",
      nome_emitente: String(issuer.legal_name || ""),
      nome_fantasia_emitente: String(issuer.trade_name || issuer.legal_name || ""),
      logradouro_emitente: issuerLogradouro,
      numero_emitente: String(issuer.address_number || "SN").trim() || "SN",
      bairro_emitente: issuerBairro,
      municipio_emitente: issuerMunicipio,
      codigo_municipio_emitente: issuerCodigoMunicipio,
      uf_emitente: issuerUf,
      cep_emitente: issuerCep,
      regime_tributario: mapTaxRegime(String(issuer.tax_regime || "simples_nacional")),

      // Destinatário: CPF ou CNPJ (CORREÇÃO)
      cpf_destinatario: isDestCPF ? destDoc : undefined,
      cnpj_destinatario: isDestCNPJ ? destDoc : undefined,
      nome_destinatario: String(destinatario.razao_social || ""),
      // IE destinatário: se vazia, não enviar (ou "ISENTO" para pessoa jurídica)
      inscricao_estadual_destinatario: onlyDigits(String(destinatario.ie || "")) || (isDestCNPJ ? "ISENTO" : undefined),
      indicador_inscricao_estadual_destinatario: isDestCPF ? "9" : (onlyDigits(String(destinatario.ie || "")) ? "1" : "2"),
      email_destinatario: String(destinatario.email || "") || undefined,
      telefone_destinatario: onlyDigits(String(destinatario.telefone || "")) || undefined,
      // Endereço destinatário: todos os campos são OBRIGATÓRIOS para NF-e
      logradouro_destinatario: String(destinatario.endereco?.logradouro || "NAO INFORMADO"),
      numero_destinatario: String(destinatario.endereco?.numero || "SN"),
      bairro_destinatario: String(destinatario.endereco?.bairro || "CENTRO"),
      municipio_destinatario: destMunicipio || "NAO INFORMADO",
      codigo_municipio_destinatario: destCodigoMunicipio || "0000000",
      uf_destinatario: destUf || "XX",
      cep_destinatario: onlyDigits(String(destinatario.endereco?.cep || "")) || "00000000",

      // Itens: campos corretos Focus (CORREÇÃO)
      items: itens.map((item, index) => {
        const unidade = (item.unidade || "UN").toUpperCase();
        const cfop = onlyDigits(item.cfop || "5102") || "5102";
        const ncm = onlyDigits(item.ncm || "00000000") || "00000000";
        const valorTotal = item.quantidade * item.valor_unitario;

        return {
          numero_item: index + 1,
          codigo_produto: String(index + 1).padStart(5, "0"),
          descricao: item.descricao,

          // Focus usa "codigo_ncm"
          codigo_ncm: ncm,
          cfop,

          unidade_comercial: unidade,
          quantidade_comercial: item.quantidade,
          valor_unitario_comercial: item.valor_unitario,
          valor_bruto: valorTotal,

          unidade_tributavel: unidade,
          quantidade_tributavel: item.quantidade,
          valor_unitario_tributavel: item.valor_unitario,

          // Focus usa "icms_origem" (não "origem")
          icms_origem: "0",
          icms_situacao_tributaria: "102",

          // evita rejeições comuns em serviços simples
          pis_situacao_tributaria: "07",
          cofins_situacao_tributaria: "07",
        };
      }),

      valor_produtos: valores.total,
      valor_frete: valores.frete || 0,
      valor_desconto: valores.desconto || 0,
      valor_total: valores.total + (valores.frete || 0) - (valores.desconto || 0),

      modalidade_frete: "9",
      informacoes_complementares: String(informacoes_adicionais || ""),
    };

    // Dados para DB (sanitizados)
    const issuerAddress = {
      logradouro: String(issuer.address_street || ""),
      numero: String(issuer.address_number || "SN"),
      bairro: String(issuer.address_neighborhood || ""),
      municipio: String(issuer.city || ""),
      codigo_municipio: String(issuer.city_ibge_code || ""),
      uf: safeUpper(String(issuer.uf || "")),
      cep: onlyDigits(String(issuer.address_zip_code || "")),
    };

    const recipientAddress = destinatario.endereco
      ? {
          logradouro: String(destinatario.endereco.logradouro || ""),
          numero: String(destinatario.endereco.numero || "SN"),
          bairro: String(destinatario.endereco.bairro || ""),
          municipio: String(destinatario.endereco.municipio || ""),
          uf: safeUpper(String(destinatario.endereco.uf || destUf)),
          cep: onlyDigits(String(destinatario.endereco.cep || "")),
        }
      : null;

    const emissionItems = itens.map((item, index) => ({
      numero_item: index + 1,
      descricao: item.descricao,
      ncm: onlyDigits(item.ncm || "00000000") || "00000000",
      cfop: onlyDigits(item.cfop || "5102") || "5102",
      unidade: (item.unidade || "UN").toUpperCase(),
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.quantidade * item.valor_unitario,
    }));

    // Cria emissão
    const { data: emission, error: emissionError } = await supabase
      .from("nfe_emissions")
      .insert({
        issuer_id,
        freight_id: freight_id || null,
        internal_ref: internalRef,
        model: "55",
        operation_nature: String(nfePayload.natureza_operacao || "VENDA DE MERCADORIA"),
        cfop: emissionItems?.[0]?.cfop || "5102",
        issuer_document: issuerDoc,
        issuer_name: String(issuer.legal_name || ""),
        issuer_ie: String(issuer.state_registration || "") || null,
        issuer_address: issuerAddress,
        recipient_document_type: isDestCPF ? "CPF" : "CNPJ",
        recipient_document: destDoc,
        recipient_name: String(destinatario.razao_social || ""),
        recipient_ie: String(destinatario.ie || "") || null,
        recipient_email: String(destinatario.email || "") || null,
        recipient_phone: onlyDigits(String(destinatario.telefone || "")) || null,
        recipient_address: recipientAddress,
        items: emissionItems,
        totals: {
          total_produtos: valores.total,
          total_frete: valores.frete || 0,
          total_desconto: valores.desconto || 0,
          total_nota: valores.total + (valores.frete || 0) - (valores.desconto || 0),
        },
        fiscal_environment: issuer.fiscal_environment,
        status: "processing",
        emission_context: nfePayload,
        emission_cost: 100,
        created_by: profile.id,
      })
      .select()
      .single();

    if (emissionError || !emission) {
      console.error("[nfe-emitir] Erro ao criar emissão:", emissionError);
      return jsonResponse(500, {
        success: false,
        code: "EMISSION_RECORD_FAILED",
        message: "Não foi possível iniciar a emissão. Tente novamente.",
      });
    }

    // Reserva crédito
    await supabase.rpc("reserve_emission_credit", { p_issuer_id: issuer_id, p_emission_id: emission.id });

    // Envia para Focus
    let focusResp: Response;
    let parsed: { ok: boolean; data: any; raw: string };

    try {
      focusResp = await fetch(`${focusUrl}?ref=${encodeURIComponent(internalRef)}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${FOCUS_NFE_TOKEN}:`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nfePayload),
      });

      parsed = await parseJsonOrText(focusResp);
    } catch (err) {
      console.error("[nfe-emitir] Falha comunicação Focus:", err);

      await supabase
        .from("nfe_emissions")
        .update({
          status: "rejected",
          error_message: "Falha na comunicação com o provedor fiscal (Focus).",
          updated_at: new Date().toISOString(),
        })
        .eq("id", emission.id);

      await supabase.rpc("release_emission_credit", { p_emission_id: emission.id });

      return jsonResponse(502, {
        success: false,
        code: "FOCUS_COMMUNICATION_FAILED",
        message: "Falha na comunicação com o provedor fiscal. Tente novamente.",
      });
    }

    const focusData = parsed.data;

    // Se Focus retornou erro HTTP => rejeita e mostra motivo
    if (!parsed.ok) {
      const msg = focusFriendlyMessage(focusData, focusResp.status);

      console.error("[nfe-emitir] Focus erro HTTP:", focusResp.status, String(parsed.raw || "").slice(0, 400));

      await supabase
        .from("nfe_emissions")
        .update({
          status: "rejected",
          focus_nfe_ref: internalRef,
          focus_nfe_response: focusData,
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", emission.id);

      await supabase.rpc("release_emission_credit", { p_emission_id: emission.id });

      return jsonResponse(200, {
        success: false,
        code: "FOCUS_REQUEST_FAILED",
        message: msg,
        emission_id: emission.id,
        internal_ref: internalRef,
        ambiente: isProducao ? "producao" : "homologacao",
      });
    }

    // Mapeia status Focus -> status interno
    let newStatus: "authorized" | "processing" | "rejected" | "canceled" = "processing";
    let errorMessage: string | null = null;

    const focusStatus = String(focusData?.status || "");

    if (focusStatus === "autorizado") newStatus = "authorized";
    else if (focusStatus === "cancelado") newStatus = "canceled";
    else if (focusStatus === "erro_autorizacao" || focusStatus === "rejeitado" || focusStatus === "denegado") {
      newStatus = "rejected";
      errorMessage = focusFriendlyMessage(focusData);
    } else if (focusStatus === "processando_autorizacao") newStatus = "processing";
    else newStatus = "processing";

    // Atualiza emissão
    await supabase
      .from("nfe_emissions")
      .update({
        status: newStatus,
        focus_nfe_ref: internalRef,
        focus_nfe_response: focusData,
        access_key: focusData?.chave_nfe || null,
        number: focusData?.numero ? Number(focusData.numero) : null,
        series: focusData?.serie ? Number(focusData.serie) : 1,
        sefaz_status_code: focusData?.status_sefaz || null,
        sefaz_status_message: focusData?.mensagem_sefaz || null,
        sefaz_protocol: focusData?.protocolo || null,
        error_code: focusData?.codigo || focusData?.codigo_erro || null,
        error_message: errorMessage,
        xml_url: focusData?.caminho_xml_nota_fiscal || null,
        danfe_url: focusData?.caminho_danfe || null,
        authorization_date: newStatus === "authorized" ? new Date().toISOString() : null,
        emission_paid: newStatus === "authorized",
        updated_at: new Date().toISOString(),
      })
      .eq("id", emission.id);

    // Crédito
    if (newStatus === "authorized") {
      await supabase.rpc("confirm_emission_credit", { p_emission_id: emission.id });
    } else if (newStatus === "rejected") {
      await supabase.rpc("release_emission_credit", { p_emission_id: emission.id });
    }

    const message =
      newStatus === "authorized"
        ? "NF-e autorizada com sucesso!"
        : newStatus === "processing"
          ? "NF-e enviada para autorização. Aguarde a confirmação."
          : newStatus === "canceled"
            ? "NF-e cancelada."
            : errorMessage || "NF-e não autorizada.";

    return jsonResponse(200, {
      success: newStatus === "authorized" || newStatus === "processing",
      message,
      emission_id: emission.id,
      internal_ref: internalRef,
      status: newStatus,
      numero: focusData?.numero || null,
      chave: focusData?.chave_nfe || null,
      danfe_url: focusData?.caminho_danfe || null,
      xml_url: focusData?.caminho_xml_nota_fiscal || null,
      ambiente: isProducao ? "producao" : "homologacao",
    });
  } catch (error) {
    console.error("[nfe-emitir] Erro inesperado:", error);
    return jsonResponse(500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Erro interno ao processar NF-e. Tente novamente.",
    });
  }
});
