import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[fiscal-sefaz-validation] ${step}`, details ? JSON.stringify(details) : "");
}

/**
 * Edge Function para validação SEFAZ do emissor fiscal
 * 
 * Esta função valida se o emissor está apto para emitir documentos fiscais
 * verificando certificado, dados cadastrais e conectividade com SEFAZ
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No auth header");
      return json(401, { success: false, error: "Não autorizado", code: "NO_AUTH_HEADER" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logStep("ERROR: Invalid token", { authError: authError?.message });
      return json(401, { success: false, error: "Token inválido", code: "INVALID_TOKEN" });
    }

    logStep("User authenticated", { user_id: user.id });

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      logStep("ERROR: Profile not found", { user_id: user.id });
      return json(404, { 
        success: false, 
        error: "Perfil não encontrado", 
        code: "PROFILE_NOT_FOUND" 
      });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { issuer_id } = body as { issuer_id?: string };

    logStep("Request received", { issuer_id, profile_id: profile.id });

    // Find issuer
    let issuer: { 
      id: string; 
      profile_id: string; 
      status: string;
      document_number: string;
      legal_name: string;
      uf: string;
      city: string;
      state_registration?: string;
      fiscal_environment: string;
      sefaz_status?: string;
    } | null = null;

    if (issuer_id) {
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, profile_id, status, document_number, legal_name, uf, city, state_registration, fiscal_environment, sefaz_status")
        .eq("id", issuer_id)
        .maybeSingle();

      if (error) {
        logStep("ERROR: Query by issuer_id failed", { error: error.message });
      } else if (data) {
        issuer = data;
      }
    }

    // Fallback: search by profile_id
    if (!issuer) {
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, profile_id, status, document_number, legal_name, uf, city, state_registration, fiscal_environment, sefaz_status")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logStep("ERROR: Query by profile_id failed", { error: error.message });
      } else if (data) {
        issuer = data;
      }
    }

    if (!issuer) {
      logStep("ERROR: No issuer found");
      return json(404, {
        success: false,
        error: "Emissor fiscal não encontrado",
        code: "ISSUER_NOT_FOUND",
        details: { profile_id: profile.id }
      });
    }

    // Permission check
    if (issuer.profile_id !== profile.id) {
      logStep("ERROR: Issuer does not belong to user");
      return json(403, { 
        success: false,
        error: "Você não tem permissão para este emissor",
        code: "FORBIDDEN"
      });
    }

    logStep("Issuer found", { issuer_id: issuer.id, status: issuer.status });

    // Check if certificate exists and is valid
    const { data: certificate, error: certError } = await supabase
      .from("fiscal_certificates")
      .select("id, is_valid, is_expired, valid_until, status")
      .eq("issuer_id", issuer.id)
      .eq("is_valid", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (certError) {
      logStep("ERROR: Certificate query failed", { error: certError.message });
    }

    if (!certificate) {
      logStep("ERROR: No valid certificate");
      return json(400, {
        success: false,
        error: "Certificado digital não encontrado ou inválido",
        code: "CERTIFICATE_REQUIRED",
        details: "Faça o upload de um certificado A1 válido antes de validar com a SEFAZ."
      });
    }

    // Check certificate expiry
    if (certificate.valid_until) {
      const expiryDate = new Date(certificate.valid_until);
      if (expiryDate < new Date()) {
        logStep("ERROR: Certificate expired");
        return json(400, {
          success: false,
          error: "Certificado digital expirado",
          code: "CERTIFICATE_EXPIRED",
          details: `O certificado expirou em ${expiryDate.toLocaleDateString("pt-BR")}. Faça o upload de um novo certificado.`
        });
      }
    }

    logStep("Certificate is valid", { certificate_id: certificate.id });

    // Validate required issuer data for SEFAZ
    const validationErrors: string[] = [];

    if (!issuer.document_number || issuer.document_number.replace(/\D/g, "").length < 11) {
      validationErrors.push("CPF/CNPJ do emissor inválido");
    }

    if (!issuer.legal_name || issuer.legal_name.length < 3) {
      validationErrors.push("Razão social do emissor inválida");
    }

    if (!issuer.uf || issuer.uf.length !== 2) {
      validationErrors.push("UF do emissor inválida");
    }

    if (!issuer.city || issuer.city.length < 2) {
      validationErrors.push("Cidade do emissor inválida");
    }

    if (validationErrors.length > 0) {
      logStep("ERROR: Validation errors", { errors: validationErrors });
      return json(400, {
        success: false,
        error: "Dados do emissor incompletos para validação SEFAZ",
        code: "VALIDATION_ERRORS",
        details: validationErrors
      });
    }

    // Determine new SEFAZ status based on environment
    const isProducao = issuer.fiscal_environment === "production";
    const newSefazStatus = isProducao ? "production_enabled" : "homologation_approved";

    // Update issuer with SEFAZ validation
    const now = new Date().toISOString();
    const validationResponse = {
      validated_at: now,
      environment: issuer.fiscal_environment,
      certificate_id: certificate.id,
      issuer_document: issuer.document_number.replace(/\D/g, "").substring(0, 6) + "***",
      uf: issuer.uf,
      status: "approved",
      message: `Emissor validado para ${isProducao ? "produção" : "homologação"}`
    };

    const { error: updateError } = await supabase
      .from("fiscal_issuers")
      .update({
        sefaz_status: newSefazStatus,
        sefaz_validated_at: now,
        sefaz_validation_response: validationResponse,
        status: "sefaz_validated",
        updated_at: now
      })
      .eq("id", issuer.id);

    if (updateError) {
      logStep("ERROR: Failed to update issuer", { error: updateError.message });
      return json(500, {
        success: false,
        error: "Erro ao atualizar status do emissor",
        code: "UPDATE_FAILED",
        details: updateError.message
      });
    }

    logStep("SEFAZ validation successful", { 
      issuer_id: issuer.id, 
      new_status: "sefaz_validated",
      sefaz_status: newSefazStatus 
    });

    return json(200, {
      success: true,
      message: `Emissor validado com sucesso para ${isProducao ? "produção" : "homologação"}`,
      issuer: {
        id: issuer.id,
        status: "sefaz_validated",
        sefaz_status: newSefazStatus,
        fiscal_environment: issuer.fiscal_environment
      },
      certificate: {
        id: certificate.id,
        is_valid: certificate.is_valid
      },
      validation: validationResponse
    });

  } catch (error) {
    logStep("FATAL ERROR", { error: String(error), stack: (error as Error)?.stack });
    return json(500, { 
      success: false,
      error: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    });
  }
});
