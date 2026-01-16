import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "PROFILE_NOT_FOUND"
  | "INVALID_PAYLOAD"
  | "ISSUER_NOT_FOUND"
  | "FORBIDDEN"
  | "ISSUER_BLOCKED"
  | "INSUFFICIENT_BALANCE"
  | "INVALID_ISSUER_DOCUMENT"
  | "INVALID_RECIPIENT_DOCUMENT"
  | "EMISSION_RECORD_FAILED"
  | "FOCUS_REQUEST_FAILED"
  | "FOCUS_COMMUNICATION_FAILED"
  | "INTERNAL_ERROR";

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

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function mapTaxRegime(regime: string): string {
  // Focus:
  // 1 – Simples Nacional
  // 2 – Simples Nacional – excesso sublimite
  // 3 – Regime Normal
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

async function parseFocusResponse(resp: Response): Promise<{ ok: boolean; data: any; raw: string }> {
  const raw = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }
  return { ok: resp.ok, data, raw };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FOCUS_NFE_TOKEN = Deno.env.get("FOCUS_NFE_TOKEN");
    if (!FOCUS_NFE_TOKEN) {
      console.error("[nfe-emitir] FOCUS_NFE_TOKEN não configurado");
      return jsonResponse(500, {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Configuração fiscal indisponível. Contate o suporte.",
      });
    }

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

    const user = userData.user;

    // Profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse(404, {
        success: false,
        code: "PROFILE_NOT_FOUND",
        message: "Perfil não encontrado.",
      });
    }

    // Payload
    let payload: NFePayload;
    try {
      payload = (await req.json()) as NFePayload;
    } catch {
      return jsonResponse(400, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Dados inválidos. Verifique o formulário e tente novamente.",
      });
    }

    const { issuer_id, freight_id, destinatario, itens, valores, informacoes_adicionais } = payload;

    if (!issuer_id) {
      return jsonResponse(400, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "issuer_id é obrigatório.",
      });
    }

    if (!destinatario?.cnpj_cpf || !destinatario?.razao_social) {
      return jsonResponse(400, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Dados do destinatário são obrigatórios.",
      });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return jsonResponse(400, {
        success: false,
        code: "INVALID_PAYLOAD",
        message: "Pelo menos um item é obrigatório.",
      });
    }

    // Load issuer
    const { data: issuer, error: issuerError } = await supabase
      .from("fiscal_issuers")
      .select("*")
      .eq("id", issuer_id)
      .single();

    if (issuerError || !issuer) {
      console.error("[nfe-emitir] Issuer não encontrado:", issuerError);
      return jsonResponse(404, {
        success: false,
        code: "ISSUER_NOT_FOUND",
        message: "Emissor fiscal não encontrado.",
      });
    }

    // Ownership
    if (issuer.profile_id !== profile.id) {
      return jsonResponse(403, {
        success: false,
        code: "FORBIDDEN",
        message: "Você não tem permissão para emitir por este emissor.",
      });
    }

    // Issuer status
    if (issuer.status === "blocked" || issuer.status === "suspended") {
      return jsonResponse(403, {
        success: false,
        code: "ISSUER_BLOCKED",
        message: "Emissor fiscal bloqueado ou suspenso.",
      });
    }

    // Wallet
    const { data: wallet, error: walletError } = await supabase
      .from("fiscal_wallet")
      .select("available_balance, reserved_balance")
      .eq("issuer_id", issuer_id)
      .maybeSingle();

    if (walletError) console.error("[nfe-emitir] Erro carteira fiscal:", walletError);

    if (!wallet || wallet.available_balance < 1) {
      return jsonResponse(402, {
        success: false,
        code: "INSUFFICIENT_BALANCE",
        message: "Saldo insuficiente de emissões. Adquira mais créditos.",
      });
    }

    // Documents sanitization
    const issuerDoc = onlyDigits(asString(issuer.document_number));
    const recipientDoc = onlyDigits(destinatario.cnpj_cpf);

    const isIssuerCPF = issuerDoc.length === 11;
    const isIssuerCNPJ = issuerDoc.length === 14;

    if (!isIssuerCPF && !isIssuerCNPJ) {
      return jsonResponse(400, {
        success: false,
        code: "INVALID_ISSUER_DOCUMENT",
        message: "CPF/CNPJ do emissor inválido. Verifique o cadastro do emissor fiscal.",
      });
    }

    const isRecipientCPF = recipientDoc.length === 11;
    const isRecipientCNPJ = recipientDoc.length === 14;

    if (!isRecipientCPF && !isRecipientCNPJ) {
      return jsonResponse(400, {
        success: false,
        code: "INVALID_RECIPIENT_DOCUMENT",
        message: "CPF/CNPJ do destinatário inválido. Verifique o dado informado.",
      });
    }

    // Environment + Focus URL
    const internalRef = `NFE-${issuer_id.substring(0, 8)}-${Date.now()}`;

    const isProducao = issuer.fiscal_environment === "production";
    const focusUrl = isProducao ? "https://api.focusnfe.com.br/v2/nfe" : "https://homologacao.focusnfe.com.br/v2/nfe";

    console.log(`[nfe-emitir] Emitindo. Ambiente=${isProducao ? "PRODUÇÃO" : "HOMOLOGAÇÃO"} ref=${internalRef}`);

    // City IBGE code (recipient)
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

    // Build Focus payload (minimal but valid)
    const issuerCep = onlyDigits(asString(issuer.address_zip_code));
    const recipientCep = onlyDigits(asString(destinatario.endereco?.cep));
    const recipientPhone = onlyDigits(asString(destinatario.telefone));

    const nfePayload: Record<string, unknown> = {
      natureza_operacao: "VENDA DE MERCADORIA",
      forma_pagamento: "0",
      tipo_documento: "1",
      finalidade_emissao: "1",
      consumidor_final: isRecipientCPF ? "1" : "0",

      // Emitente
      cpf_emitente: isIssuerCPF ? issuerDoc : undefined,
      cnpj_emitente: isIssuerCNPJ ? issuerDoc : undefined,
      inscricao_estadual_emitente: asString(issuer.state_registration, ""),
      nome_emitente: asString(issuer.legal_name, ""),
      nome_fantasia_emitente: asString(issuer.trade_name || issuer.legal_name, ""),
      logradouro_emitente: asString(issuer.address_street, ""),
      numero_emitente: asString(issuer.address_number, "SN"),
      bairro_emitente: asString(issuer.address_neighborhood, ""),
      municipio_emitente: asString(issuer.city, ""),
      codigo_municipio_emitente: asString(issuer.city_ibge_code, ""),
      uf_emitente: safeUpper(asString(issuer.uf, "")),
      cep_emitente: issuerCep,

      regime_tributario: mapTaxRegime(asString(issuer.tax_regime, "simples_nacional")),

      // Destinatário
      cpf_destinatario: isRecipientCPF ? recipientDoc : undefined,
      cnpj_destinatario: isRecipientCNPJ ? recipientDoc : undefined,
      nome_destinatario: asString(destinatario.razao_social, ""),
      inscricao_estadual_destinatario: asString(destinatario.ie, ""),
      email_destinatario: asString(destinatario.email, ""),
      telefone_destinatario: recipientPhone,
      logradouro_destinatario: asString(destinatario.endereco?.logradouro, ""),
      numero_destinatario: asString(destinatario.endereco?.numero, "SN"),
      bairro_destinatario: asString(destinatario.endereco?.bairro, ""),
      municipio_destinatario: destMunicipio,
      codigo_municipio_destinatario: destCodigoMunicipio,
      uf_destinatario: destUf,
      cep_destinatario: recipientCep,

      // Itens
      items: itens.map((item, index) => {
        const ncm = onlyDigits(item.ncm || "99999999");
        const cfop = onlyDigits(item.cfop || "5102") || "5102";
        const unidade = (item.unidade || "UN").toUpperCase();

        return {
          numero_item: index + 1,
          codigo_produto: String(index + 1).padStart(5, "0"),
          descricao: item.descricao,
          codigo_ncm: ncm,
          cfop,
          unidade_comercial: unidade,
          quantidade_comercial: item.quantidade,
          valor_unitario_comercial: item.valor_unitario,
          valor_bruto: item.quantidade * item.valor_unitario,

          unidade_tributavel: unidade,
          quantidade_tributavel: item.quantidade,
          valor_unitario_tributavel: item.valor_unitario,

          icms_origem: "0",
          icms_situacao_tributaria: "102",
          pis_situacao_tributaria: "07",
          cofins_situacao_tributaria: "07",
        };
      }),

      // Totais
      valor_produtos: valores.total,
      valor_frete: valores.frete || 0,
      valor_desconto: valores.desconto || 0,
      valor_total: valores.total + (valores.frete || 0) - (valores.desconto || 0),

      // Frete
      modalidade_frete: "9",

      // Info adicionais
      informacoes_complementares: asString(informacoes_adicionais, ""),
    };

    // Normalize stored addresses/items for DB
    const issuerAddress = {
      logradouro: asString(issuer.address_street, ""),
      numero: asString(issuer.address_number, "SN"),
      bairro: asString(issuer.address_neighborhood, ""),
      municipio: asString(issuer.city, ""),
      codigo_municipio: asString(issuer.city_ibge_code, ""),
      uf: safeUpper(asString(issuer.uf, "")),
      cep: issuerCep,
    };

    const recipientAddress = destinatario.endereco
      ? {
          logradouro: asString(destinatario.endereco.logradouro, ""),
          numero: asString(destinatario.endereco.numero, "SN"),
          bairro: asString(destinatario.endereco.bairro, ""),
          municipio: asString(destinatario.endereco.municipio, ""),
          uf: safeUpper(asString(destinatario.endereco.uf, destUf)),
          cep: recipientCep,
        }
      : null;

    const emissionItems = itens.map((item, index) => ({
      numero_item: index + 1,
      descricao: item.descricao,
      ncm: onlyDigits(item.ncm || "99999999"),
      cfop: onlyDigits(item.cfop || "5102") || "5102",
      unidade: (item.unidade || "UN").toUpperCase(),
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.quantidade * item.valor_unitario,
    }));

    // Create emission record BEFORE sending to Focus
    const { data: emission, error: emissionError } = await supabase
      .from("nfe_emissions")
      .insert({
        issuer_id,
        freight_id: freight_id || null,
        internal_ref: internalRef,
        model: "55",
        operation_nature: nfePayload.natureza_operacao,
        cfop: emissionItems?.[0]?.cfop || "5102",
        issuer_document: issuerDoc,
        issuer_name: asString(issuer.legal_name, ""),
        issuer_ie: asString(issuer.state_registration, "") || null,
        issuer_address: issuerAddress,
        recipient_document_type: isRecipientCPF ? "CPF" : "CNPJ",
        recipient_document: recipientDoc,
        recipient_name: asString(destinatario.razao_social, ""),
        recipient_ie: asString(destinatario.ie, "") || null,
        recipient_email: asString(destinatario.email, "") || null,
        recipient_phone: recipientPhone || null,
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

    // Reserve credit
    await supabase.rpc("reserve_emission_credit", { p_issuer_id: issuer_id, p_emission_id: emission.id });

    // Send to Focus
    let focusResp: Response;
    let focusParsed: { ok: boolean; data: any; raw: string };

    try {
      focusResp = await fetch(`${focusUrl}?ref=${encodeURIComponent(internalRef)}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${FOCUS_NFE_TOKEN}:`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nfePayload),
      });

      focusParsed = await parseFocusResponse(focusResp);
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
        message: "Falha na comunicação com o provedor fiscal. Tente novamente em instantes.",
      });
    }

    const focusData = focusParsed.data;

    // If Focus returned HTTP error, treat as rejection and show message
    if (!focusParsed.ok) {
      const msg =
        asString(focusData?.mensagem_sefaz) ||
        asString(focusData?.mensagem) ||
        asString(focusData?.error) ||
        "Não foi possível enviar a NF-e. Verifique os dados e tente novamente.";

      console.error("[nfe-emitir] Focus retornou erro HTTP:", focusResp.status, focusParsed.raw?.slice(0, 400));

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

      return jsonResponse(422, {
        success: false,
        code: "FOCUS_REQUEST_FAILED",
        message: msg,
        emission_id: emission.id,
        internal_ref: internalRef,
        ambiente: isProducao ? "producao" : "homologacao",
      });
    }

    // Map Focus status to internal status
    let newStatus: "authorized" | "processing" | "rejected" | "canceled" = "processing";
    let errorMessage: string | null = null;

    const focusStatus = asString(focusData?.status);

    if (focusStatus === "autorizado") {
      newStatus = "authorized";
    } else if (focusStatus === "cancelado") {
      newStatus = "canceled";
    } else if (focusStatus === "erro_autorizacao" || focusStatus === "rejeitado") {
      newStatus = "rejected";
      errorMessage =
        asString(focusData?.mensagem_sefaz) || asString(focusData?.mensagem) || "Erro na autorização da NF-e.";
    } else if (focusStatus === "processando_autorizacao") {
      newStatus = "processing";
    } else {
      // unknown Focus status -> keep processing
      newStatus = "processing";
    }

    // Update DB record
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

    // Confirm / release credit
    if (newStatus === "authorized") {
      await supabase.rpc("confirm_emission_credit", { p_emission_id: emission.id });
    } else if (newStatus === "rejected") {
      await supabase.rpc("release_emission_credit", { p_emission_id: emission.id });
    }

    const userMessage =
      newStatus === "authorized"
        ? "NF-e autorizada com sucesso!"
        : newStatus === "processing"
          ? "NF-e enviada para autorização. Aguarde a confirmação."
          : newStatus === "canceled"
            ? "NF-e cancelada."
            : errorMessage || "Não foi possível autorizar a NF-e.";

    // Return response
    return jsonResponse(200, {
      success: newStatus === "authorized" || newStatus === "processing",
      code: newStatus === "rejected" ? "FOCUS_REQUEST_FAILED" : null,
      message: userMessage,
      emission_id: emission.id,
      internal_ref: internalRef,
      status: newStatus,
      numero: focusData?.numero || null,
      chave: focusData?.chave_nfe || null,
      danfe_url: focusData?.caminho_danfe || null,
      xml_url: focusData?.caminho_xml_nota_fiscal || null,
      ambiente: isProducao ? "producao" : "homologacao",
    });
  } catch (error: any) {
    console.error("[nfe-emitir] Erro:", error);
    return jsonResponse(500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Erro interno ao processar NF-e. Tente novamente.",
    });
  }
});
