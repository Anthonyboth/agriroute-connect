import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
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

type EmissionRow = {
  id: string;
  status: string;
  internal_ref: string | null;
  focus_nfe_ref: string | null;
  fiscal_environment: string | null;
  emission_paid: boolean | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FOCUS_NFE_TOKEN = Deno.env.get("FOCUS_NFE_TOKEN");
    if (!FOCUS_NFE_TOKEN) {
      return jsonResponse(500, {
        success: false,
        code: "CONFIG_MISSING",
        message: "Token do provedor fiscal não configurado.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth (mantém controle por usuário, mas usa service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { success: false, code: "UNAUTHORIZED", message: "Não autorizado." });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return jsonResponse(401, { success: false, code: "INVALID_TOKEN", message: "Token inválido." });
    }

    // Body (opcional)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const emission_id: string | undefined = body?.emission_id;
    const internal_ref: string | undefined = body?.internal_ref;
    const limit: number = Number(body?.limit || 20);

    // Buscar emissões a atualizar
    let emissions: EmissionRow[] = [];

    if (emission_id || internal_ref) {
      const query = supabase
        .from("nfe_emissions")
        .select("id,status,internal_ref,focus_nfe_ref,fiscal_environment,emission_paid")
        .limit(1);

      const { data, error } = emission_id
        ? await query.eq("id", emission_id).maybeSingle()
        : await query.eq("internal_ref", internal_ref).maybeSingle();

      if (error) {
        console.error("[nfe-update-status] Erro buscando emissão:", error);
        return jsonResponse(500, { success: false, code: "DB_ERROR", message: "Erro ao buscar emissão." });
      }
      if (!data) {
        return jsonResponse(404, {
          success: false,
          code: "NOT_FOUND",
          message: "Emissão não encontrada.",
        });
      }

      emissions = [data as EmissionRow];
    } else {
      const { data, error } = await supabase
        .from("nfe_emissions")
        .select("id,status,internal_ref,focus_nfe_ref,fiscal_environment,emission_paid")
        .eq("status", "processing")
        .order("created_at", { ascending: true })
        .limit(Math.min(Math.max(limit, 1), 50));

      if (error) {
        console.error("[nfe-update-status] Erro listando pendentes:", error);
        return jsonResponse(500, { success: false, code: "DB_ERROR", message: "Erro ao listar emissões pendentes." });
      }

      emissions = (data || []) as EmissionRow[];
    }

    if (emissions.length === 0) {
      return jsonResponse(200, {
        success: true,
        message: "Nenhuma emissão pendente para atualizar.",
        updated: 0,
        results: [],
      });
    }

    const results: any[] = [];

    for (const em of emissions) {
      const ref = em.focus_nfe_ref || em.internal_ref;

      if (!ref) {
        // registro inconsistente
        await supabase
          .from("nfe_emissions")
          .update({
            status: "rejected",
            error_message: "Referência interna ausente para consulta do provedor fiscal.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", em.id);

        await supabase.rpc("release_emission_credit", { p_emission_id: em.id });

        results.push({
          emission_id: em.id,
          status: "rejected",
          message: "Referência ausente. Crédito liberado.",
        });
        continue;
      }

      const isProducao = em.fiscal_environment === "production";
      const focusBase = isProducao ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";
      const focusGetUrl = `${focusBase}/v2/nfe/${encodeURIComponent(ref)}`;

      let focusResp: Response;
      let parsed: { ok: boolean; data: any; raw: string };

      try {
        focusResp = await fetch(focusGetUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${btoa(`${FOCUS_NFE_TOKEN}:`)}`,
            "Content-Type": "application/json",
          },
        });
        parsed = await parseFocusResponse(focusResp);
      } catch (err) {
        console.error("[nfe-update-status] Falha comunicação Focus:", err);
        results.push({
          emission_id: em.id,
          status: em.status,
          message: "Falha ao consultar o provedor fiscal. Tente novamente.",
        });
        continue;
      }

      const focusData = parsed.data;

      if (!parsed.ok) {
        const msg =
          asString(focusData?.mensagem_sefaz) ||
          asString(focusData?.mensagem) ||
          asString(focusData?.error) ||
          `Erro ao consultar provedor fiscal (HTTP ${focusResp.status}).`;

        // mantém processing, mas registra erro para diagnóstico
        await supabase
          .from("nfe_emissions")
          .update({
            focus_nfe_response: focusData,
            error_message: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", em.id);

        results.push({
          emission_id: em.id,
          status: em.status,
          message: msg,
        });
        continue;
      }

      const focusStatus = asString(focusData?.status);
      let newStatus: "authorized" | "processing" | "rejected" | "canceled" = "processing";
      let errorMessage: string | null = null;

      if (focusStatus === "autorizado") {
        newStatus = "authorized";
      } else if (focusStatus === "cancelado") {
        newStatus = "canceled";
      } else if (focusStatus === "erro_autorizacao" || focusStatus === "rejeitado" || focusStatus === "denegado") {
        newStatus = "rejected";
        errorMessage =
          asString(focusData?.mensagem_sefaz) || asString(focusData?.mensagem) || "NF-e não autorizada pela SEFAZ.";
      } else if (focusStatus === "processando_autorizacao") {
        newStatus = "processing";
      } else {
        // status desconhecido: deixa processing, mas registra retorno
        newStatus = "processing";
      }

      // Update DB
      await supabase
        .from("nfe_emissions")
        .update({
          status: newStatus,
          focus_nfe_ref: ref,
          focus_nfe_response: focusData,
          access_key: focusData?.chave_nfe || null,
          number: focusData?.numero ? Number(focusData.numero) : null,
          series: focusData?.serie ? Number(focusData.serie) : 1,
          sefaz_status_code: focusData?.status_sefaz || null,
          sefaz_status_message: focusData?.mensagem_sefaz || null,
          error_message: errorMessage,
          xml_url: focusData?.caminho_xml_nota_fiscal || null,
          danfe_url: focusData?.caminho_danfe || null,
          authorization_date: newStatus === "authorized" ? new Date().toISOString() : null,
          emission_paid: newStatus === "authorized",
          updated_at: new Date().toISOString(),
        })
        .eq("id", em.id);

      // Credits
      if (newStatus === "authorized" && !em.emission_paid) {
        await supabase.rpc("confirm_emission_credit", { p_emission_id: em.id });
      } else if (newStatus === "rejected") {
        await supabase.rpc("release_emission_credit", { p_emission_id: em.id });
      }

      results.push({
        emission_id: em.id,
        status: newStatus,
        focus_status: focusStatus,
        numero: focusData?.numero || null,
        chave: focusData?.chave_nfe || null,
        danfe_url: focusData?.caminho_danfe || null,
        xml_url: focusData?.caminho_xml_nota_fiscal || null,
        message:
          newStatus === "authorized"
            ? "NF-e autorizada pela SEFAZ."
            : newStatus === "processing"
              ? "NF-e ainda em processamento."
              : newStatus === "canceled"
                ? "NF-e cancelada."
                : errorMessage || "NF-e não autorizada.",
      });
    }

    return jsonResponse(200, {
      success: true,
      updated: results.length,
      results,
      message: "Atualização concluída.",
    });
  } catch (error) {
    console.error("[nfe-update-status] Erro inesperado:", error);
    return jsonResponse(500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Erro interno do servidor.",
    });
  }
});
