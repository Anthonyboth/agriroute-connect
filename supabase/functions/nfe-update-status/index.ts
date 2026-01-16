import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function mapFocusStatusToInternalStatus(focusStatus?: string): "processing" | "authorized" | "rejected" | "canceled" {
  switch (focusStatus) {
    case "autorizado":
      return "authorized";
    case "cancelado":
      return "canceled";
    case "erro_autorizacao":
    case "rejeitado":
      return "rejected";
    case "processando_autorizacao":
    case "processando_cancelamento":
    case "processando":
    case "enviado":
    default:
      return "processing";
  }
}

function pickSefazMessage(focusData: any): string {
  return (
    focusData?.mensagem_sefaz || focusData?.mensagem || focusData?.erro || "Sem mensagem detalhada do provedor fiscal."
  );
}

function pickSefazCode(focusData: any): string | null {
  return focusData?.status_sefaz || focusData?.codigo || focusData?.codigo_erro || focusData?.code || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ===== ENV =====
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const focusToken = Deno.env.get("FOCUS_NFE_TOKEN");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, {
        success: false,
        message: "Configuração do Supabase ausente (SUPABASE_URL / SERVICE_ROLE_KEY).",
      });
    }
    if (!focusToken) {
      return json(500, {
        success: false,
        message: "Token da Focus NFe não configurado (FOCUS_NFE_TOKEN).",
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ===== AUTH =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { success: false, message: "Não autorizado: header Authorization ausente." });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !userData?.user) {
      return json(401, { success: false, message: "Não autorizado: token inválido." });
    }

    // ===== BODY =====
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const emission_id = typeof body?.emission_id === "string" ? body.emission_id : null;
    const internal_ref = typeof body?.internal_ref === "string" ? body.internal_ref : null;

    if (!emission_id && !internal_ref) {
      return json(400, {
        success: false,
        message: "Informe emission_id ou internal_ref.",
        results: [],
      });
    }

    // ===== PROFILE (para checar permissão) =====
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return json(404, {
        success: false,
        message: "Perfil não encontrado.",
        results: [],
      });
    }

    // ===== FETCH EMISSION =====
    let emissionQuery = supabase.from("nfe_emissions").select("*");

    if (emission_id) emissionQuery = emissionQuery.eq("id", emission_id);
    if (internal_ref) emissionQuery = emissionQuery.eq("internal_ref", internal_ref);

    const { data: emission, error: emissionError } = await emissionQuery.maybeSingle();

    if (emissionError) {
      console.error("[nfe-update-status] Erro ao buscar emissão:", emissionError);
      return json(500, {
        success: false,
        message: "Erro ao buscar emissão no banco.",
        results: [],
      });
    }

    if (!emission) {
      return json(404, {
        success: false,
        message: "Emissão não encontrada.",
        results: [],
      });
    }

    // ===== PERMISSION =====
    // A emissão foi criada com created_by = profile.id no seu nfe-emitir.
    if (emission.created_by && emission.created_by !== profile.id) {
      return json(403, {
        success: false,
        message: "Você não tem permissão para consultar esta emissão.",
        results: [],
      });
    }

    // ===== DETERMINE ENV / REF =====
    const fiscalEnv = emission.fiscal_environment === "production" ? "production" : "homologation";
    const focusBase =
      fiscalEnv === "production" ? "https://api.focusnfe.com.br/v2/nfe" : "https://homologacao.focusnfe.com.br/v2/nfe";

    const ref = emission.focus_nfe_ref || emission.internal_ref;
    if (!ref) {
      return json(400, {
        success: false,
        message: "Emissão sem referência interna (internal_ref) para consulta.",
        results: [
          {
            emission_id: emission.id,
            status: emission.status ?? "processing",
            message: "Emissão sem referência para consulta no provedor fiscal.",
            danfe_url: emission.danfe_url ?? null,
            xml_url: emission.xml_url ?? null,
          },
        ],
      });
    }

    // ===== CALL FOCUS (GET status) =====
    let focusResponse: Response;
    let focusData: any = null;

    try {
      focusResponse = await fetch(`${focusBase}/${encodeURIComponent(ref)}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(focusToken + ":")}`,
          "Content-Type": "application/json",
        },
      });

      // Focus costuma devolver JSON mesmo em erro
      try {
        focusData = await focusResponse.json();
      } catch {
        focusData = null;
      }
    } catch (err) {
      console.error("[nfe-update-status] Falha na comunicação com Focus:", err);
      return json(200, {
        success: false,
        message: "Falha na comunicação com o provedor fiscal (Focus NFe).",
        results: [
          {
            emission_id: emission.id,
            status: emission.status ?? "processing",
            message: "Não foi possível consultar a Focus NFe agora. Tente novamente em instantes.",
            danfe_url: emission.danfe_url ?? null,
            xml_url: emission.xml_url ?? null,
          },
        ],
      });
    }

    // Se Focus respondeu erro HTTP, ainda assim devolvemos 200 para o front e colocamos motivo em português.
    if (!focusResponse.ok) {
      const msg = pickSefazMessage(focusData) || `Erro HTTP ${focusResponse.status} ao consultar o provedor fiscal.`;
      return json(200, {
        success: false,
        message: "Consulta ao provedor fiscal retornou erro.",
        results: [
          {
            emission_id: emission.id,
            status: emission.status ?? "processing",
            message: msg,
            sefaz_code: pickSefazCode(focusData),
            danfe_url: emission.danfe_url ?? null,
            xml_url: emission.xml_url ?? null,
          },
        ],
      });
    }

    // ===== MAP + UPDATE DB =====
    const newStatus = mapFocusStatusToInternalStatus(focusData?.status);
    const sefazMsg = pickSefazMessage(focusData);
    const sefazCode = pickSefazCode(focusData);

    const updatePatch: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      focus_nfe_response: focusData,
      access_key: focusData?.chave_nfe ?? emission.access_key ?? null,
      number: focusData?.numero ? Number(focusData.numero) : (emission.number ?? null),
      series: focusData?.serie ? Number(focusData.serie) : (emission.series ?? null),
      sefaz_status_code: focusData?.status_sefaz ?? emission.sefaz_status_code ?? null,
      sefaz_status_message: focusData?.mensagem_sefaz ?? emission.sefaz_status_message ?? null,
      sefaz_protocol: focusData?.protocolo ?? emission.sefaz_protocol ?? null,
      danfe_url: focusData?.caminho_danfe ?? emission.danfe_url ?? null,
      xml_url: focusData?.caminho_xml_nota_fiscal ?? emission.xml_url ?? null,
      error_message: newStatus === "rejected" ? sefazMsg : null,
      error_code: newStatus === "rejected" ? sefazCode : null,
      authorization_date:
        newStatus === "authorized"
          ? (emission.authorization_date ?? new Date().toISOString())
          : (emission.authorization_date ?? null),
      emission_paid: newStatus === "authorized" ? true : (emission.emission_paid ?? false),
    };

    const { error: dbUpErr } = await supabase.from("nfe_emissions").update(updatePatch).eq("id", emission.id);

    if (dbUpErr) {
      console.error("[nfe-update-status] Erro ao atualizar nfe_emissions:", dbUpErr);
      // Mesmo que falhe atualizar o banco, devolvemos o status para a UI não ficar “cega”
      return json(200, {
        success: false,
        message: "A consulta foi feita, mas houve erro ao atualizar o banco. Verifique logs.",
        results: [
          {
            emission_id: emission.id,
            status: newStatus,
            message: sefazMsg,
            sefaz_code: sefazCode,
            danfe_url: focusData?.caminho_danfe ?? emission.danfe_url ?? null,
            xml_url: focusData?.caminho_xml_nota_fiscal ?? emission.xml_url ?? null,
          },
        ],
      });
    }

    // ===== CREDIT FINALIZATION (se existir RPCs) =====
    // Não quebra se não existir, mas tenta.
    try {
      if (newStatus === "authorized") {
        await supabase.rpc("confirm_emission_credit", { p_emission_id: emission.id });
      } else if (newStatus === "rejected") {
        await supabase.rpc("release_emission_credit", { p_emission_id: emission.id });
      }
    } catch (e) {
      console.warn("[nfe-update-status] RPC de crédito falhou (ignorado):", e);
    }

    // ===== RESPONSE (results[]) =====
    return json(200, {
      success: true,
      message:
        newStatus === "authorized"
          ? "NF-e autorizada pela SEFAZ."
          : newStatus === "rejected"
            ? "NF-e rejeitada pela SEFAZ."
            : newStatus === "canceled"
              ? "NF-e cancelada."
              : "NF-e ainda em processamento.",
      results: [
        {
          emission_id: emission.id,
          internal_ref: emission.internal_ref,
          status: newStatus,
          sefaz_code: sefazCode,
          message: sefazMsg,
          danfe_url: focusData?.caminho_danfe ?? emission.danfe_url ?? null,
          xml_url: focusData?.caminho_xml_nota_fiscal ?? emission.xml_url ?? null,
          access_key: focusData?.chave_nfe ?? emission.access_key ?? null,
          numero: focusData?.numero ?? emission.number ?? null,
          serie: focusData?.serie ?? emission.series ?? null,
          ambiente: fiscalEnv === "production" ? "producao" : "homologacao",
        },
      ],
    });
  } catch (error) {
    console.error("[nfe-update-status] Unexpected error:", error);
    return json(200, {
      success: false,
      message: "Erro interno ao consultar status da NF-e.",
      results: [],
    });
  }
});
