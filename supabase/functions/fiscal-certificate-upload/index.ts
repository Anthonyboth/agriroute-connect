import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UploadCertificateSchema = z.object({
  issuer_id: z.string().uuid("ID do emissor inválido").optional(),
  certificate_base64: z.string().min(100, "Certificado muito pequeno"),
  certificate_password: z.string().min(1, "Senha do certificado é obrigatória"),
  file_name: z.string().max(255).optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[fiscal-certificate-upload] ${step}`, details ? JSON.stringify(details) : "");
}

function sanitizeDocumentNumber(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function normalizeBase64(input: string): string {
  // Aceita tanto base64 puro quanto data URL (data:...;base64,XXX)
  const trimmed = (input || "").trim();
  const maybeDataUrl = trimmed.includes(",") ? trimmed.split(",").pop()! : trimmed;
  // Remove whitespace/newlines que podem quebrar serviços externos
  return maybeDataUrl.replace(/\s+/g, "");
}

// ============================================
// FOCUS NFE INTEGRATION - CADASTRO DE EMPRESA COM CERTIFICADO
// ============================================
interface FiscalIssuer {
  id: string;
  document_number: string;
  legal_name: string;
  trade_name?: string;
  state_registration?: string;
  municipal_registration?: string;
  tax_regime: string;
  cnae_code?: string;
  uf: string;
  city: string;
  city_ibge_code?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_zip_code?: string;
  fiscal_environment: string;
  focus_company_id?: string;
}

function mapTaxRegimeToFocus(taxRegime: string): number {
  switch (taxRegime) {
    case "simples_nacional":
    case "mei":
      return 1; // Simples Nacional
    case "simples_nacional_excesso":
      return 2; // Simples Nacional - Excesso de sublimite
    case "lucro_presumido":
    case "lucro_real":
      return 3; // Regime Normal
    default:
      return 1;
  }
}

async function registerOrUpdateCompanyInFocusNfe(
  issuer: FiscalIssuer,
  certificateBase64: string,
  certificatePassword: string,
  focusToken: string
): Promise<{ success: boolean; error?: string; focusCompanyId?: string }> {
  const isProducao = issuer.fiscal_environment === "production";
  const focusBaseUrl = isProducao
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";

  const doc = sanitizeDocumentNumber(issuer.document_number);
  const normalizedCertBase64 = normalizeBase64(certificateBase64);
  // Remover espaços extras (muito comum em copy/paste). Não altera espaços internos.
  const normalizedPassword = (certificatePassword || "").trim();
  const token = (focusToken || "").trim();
  if (!token) {
    return { success: false, error: "FOCUS_NFE_TOKEN não configurado" };
  }

  logStep("Registering company in Focus NFe", {
    document: doc,
    environment: issuer.fiscal_environment,
    baseUrl: focusBaseUrl,
    hasExistingFocusId: !!issuer.focus_company_id,
  });

  // Build the company payload for Focus NFe
  const companyPayload: Record<string, unknown> = {
    nome: issuer.legal_name,
    nome_fantasia: issuer.trade_name || issuer.legal_name,
    inscricao_estadual: issuer.state_registration ? parseInt(issuer.state_registration.replace(/\D/g, ""), 10) || 0 : 0,
    inscricao_municipal: issuer.municipal_registration ? parseInt(issuer.municipal_registration.replace(/\D/g, ""), 10) || 0 : 0,
    regime_tributario: mapTaxRegimeToFocus(issuer.tax_regime),
    logradouro: issuer.address_street || "",
    // A API da Focus define `numero` como inteiro. Para "S/N" usamos 0.
    numero: issuer.address_number ? parseInt(String(issuer.address_number).replace(/\D/g, ""), 10) || 0 : 0,
    bairro: issuer.address_neighborhood || "",
    municipio: issuer.city,
    uf: issuer.uf,
    cep: issuer.address_zip_code ? parseInt(issuer.address_zip_code.replace(/\D/g, ""), 10) : 0,
    habilita_nfe: true,
    habilita_nfce: false,
    habilita_nfse: false,
    habilita_cte: true,
    habilita_mdfe: true,
    enviar_email_destinatario: true,
    // Certificado digital A1
    arquivo_certificado_base64: normalizedCertBase64,
    senha_certificado: normalizedPassword,
  };

  // Add CNPJ or CPF based on document length
  if (doc.length === 14) {
    companyPayload.cnpj = doc;
  } else {
    companyPayload.cpf = doc;
  }

  // Add optional fields
  if (issuer.address_complement) {
    companyPayload.complemento = issuer.address_complement;
  }

  const authHeader = `Basic ${btoa(`${token}:`)}`;

  try {
    // Try to update existing company or create new one
    let response: Response;
    let method: string;
    let url: string;

    // SEMPRE verificar se a empresa existe na Focus NFe primeiro (mesmo se temos focus_company_id salvo)
    // porque o registro pode ter sido deletado ou o ambiente pode ter mudado
    const existingCheckUrl = `${focusBaseUrl}/v2/empresas/${doc}`;
    
    logStep("Checking if company exists in Focus NFe", { checkUrl: existingCheckUrl });
    
    const checkResponse = await fetch(existingCheckUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (checkResponse.ok) {
      // Company exists, update it
      method = "PUT";
      url = existingCheckUrl;
      logStep("Company exists in Focus NFe, will update", { status: checkResponse.status });
    } else if (checkResponse.status === 404 || checkResponse.status === 422) {
      // Company doesn't exist (404) or invalid request for non-existent company (422)
      // Focus NFe returns 422 for non-existent companies in some cases
      logStep("Company not found in Focus NFe, will create new", { 
        status: checkResponse.status 
      });
      method = "POST";
      url = `${focusBaseUrl}/v2/empresas`;
    } else {
      const errorText = await checkResponse.text();
      logStep("ERROR: Failed to check existing company", { 
        status: checkResponse.status, 
        error: errorText 
      });
      const snippet = errorText?.slice(0, 300);
      return {
        success: false,
        error: `Erro ao verificar empresa na Focus NFe: ${checkResponse.status}${snippet ? ` - ${snippet}` : ""}`,
      };
    }

    logStep(`Sending ${method} request to Focus NFe`, { url });

    response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(companyPayload),
    });

    const responseText = await response.text();
    let responseData: unknown = null;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    logStep("Focus NFe response", { 
      status: response.status, 
      method,
      data: responseData 
    });

    if (!response.ok) {
      const errorData = responseData as Record<string, unknown>;
      const errorMessage = errorData?.mensagem || errorData?.codigo || 
        `HTTP ${response.status}: ${responseText.substring(0, 200)}`;
      
      logStep("ERROR: Focus NFe rejected request", { 
        status: response.status, 
        error: errorMessage,
        fullResponse: responseData
      });

      return {
        success: false,
        error: `Focus NFe (${response.status}): ${String(errorMessage)}`,
      };
    }

    // Extract the company ID from response
    const focusCompanyId = (responseData as Record<string, unknown>)?.cnpj ||
                           (responseData as Record<string, unknown>)?.cpf ||
                           doc;

    logStep("SUCCESS: Company registered/updated in Focus NFe", { 
      focusCompanyId,
      method 
    });

    return { 
      success: true, 
      focusCompanyId: String(focusCompanyId)
    };

  } catch (error) {
    logStep("ERROR: Exception calling Focus NFe API", { 
      error: String(error),
      stack: (error as Error)?.stack 
    });
    return { 
      success: false, 
      error: `Erro de comunicação com Focus NFe: ${String(error)}` 
    };
  }
}

// ============================================
// MAIN HANDLER
// ============================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No auth header");
      return json(401, { error: "Não autorizado", code: "NO_AUTH_HEADER" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const focusToken = Deno.env.get("FOCUS_NFE_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logStep("ERROR: Invalid token", { authError: authError?.message });
      return json(401, { error: "Token inválido", code: "INVALID_TOKEN" });
    }

    logStep("User authenticated", { user_id: user.id });

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      logStep("ERROR: Profile not found", { user_id: user.id, profileError: profileError?.message });
      return json(404, { 
        error: "Perfil não encontrado", 
        code: "PROFILE_NOT_FOUND",
        details: { user_id: user.id }
      });
    }

    logStep("Profile found", { profile_id: profile.id });

    // Parse and validate request body
    const body = await req.json();
    const validation = UploadCertificateSchema.safeParse(body);
    
    if (!validation.success) {
      logStep("ERROR: Validation failed", { errors: validation.error.errors });
      return json(400, {
        error: "Dados inválidos",
        code: "VALIDATION_ERROR",
        details: validation.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

     const { issuer_id, certificate_base64, certificate_password, file_name } = validation.data;
    logStep("Request validated", { issuer_id: issuer_id || "not provided", file_name });

    // =========================================================
    // Find issuer
    // =========================================================
    let issuer: FiscalIssuer | null = null;

    // First try by issuer_id
    if (issuer_id) {
      logStep("Searching issuer by ID", { issuer_id });
      
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, document_number, legal_name, trade_name, state_registration, municipal_registration, tax_regime, cnae_code, uf, city, city_ibge_code, address_street, address_number, address_complement, address_neighborhood, address_zip_code, fiscal_environment, focus_company_id, profile_id, status")
        .eq("id", issuer_id)
        .maybeSingle();

      if (error) {
        logStep("ERROR: Query by issuer_id failed", { error: error.message });
      } else if (data) {
        issuer = data;
        logStep("Issuer found by ID", { issuer_id: data.id, document_number: data.document_number });
      }
    }

    // Fallback: search by profile_id
    if (!issuer) {
      logStep("Fallback: searching issuer by profile_id", { profile_id: profile.id });
      
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, document_number, legal_name, trade_name, state_registration, municipal_registration, tax_regime, cnae_code, uf, city, city_ibge_code, address_street, address_number, address_complement, address_neighborhood, address_zip_code, fiscal_environment, focus_company_id, profile_id, status")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logStep("ERROR: Query by profile_id failed", { error: error.message });
      } else if (data) {
        issuer = data;
        logStep("Issuer found by profile_id", { issuer_id: data.id });
      }
    }

    if (!issuer) {
      logStep("ERROR: No issuer found", { 
        received_issuer_id: issuer_id || null, 
        profile_id: profile.id 
      });
      
      return json(404, {
        error: "Emissor fiscal não encontrado",
        code: "ISSUER_NOT_FOUND",
        details: {
          received_issuer_id: issuer_id || null,
          profile_id: profile.id,
          hint: "Certifique-se de ter completado o cadastro do emissor fiscal antes de enviar o certificado."
        }
      });
    }

    // Check ownership
    const issuerProfileId = (issuer as unknown as { profile_id: string }).profile_id;
    if (issuerProfileId !== profile.id) {
      logStep("ERROR: Issuer does not belong to user", { 
        issuer_profile_id: issuerProfileId, 
        user_profile_id: profile.id 
      });
      
      return json(403, { 
        error: "Você não tem permissão para este emissor",
        code: "FORBIDDEN",
      });
    }

    logStep("Authorization check passed");

    // =========================================================
    // Decode base64 certificate
    // =========================================================
    const normalizedCertificateBase64 = normalizeBase64(certificate_base64);
    const normalizedCertificatePassword = (certificate_password || "").trim();

    let certificateBytes: Uint8Array;
    try {
      const binaryString = atob(normalizedCertificateBase64);
      certificateBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        certificateBytes[i] = binaryString.charCodeAt(i);
      }
      logStep("Certificate decoded", { size_bytes: certificateBytes.length });
    } catch (decodeError) {
      logStep("ERROR: Certificate decode failed", { error: String(decodeError) });
      return json(400, { 
        error: "Formato de certificado inválido",
        code: "INVALID_CERTIFICATE_FORMAT",
        details: "O certificado não está em formato base64 válido."
      });
    }

    // Validate certificate size
    if (certificateBytes.length > 10 * 1024 * 1024) {
      logStep("ERROR: Certificate too large", { size_bytes: certificateBytes.length });
      return json(400, { 
        error: "Certificado muito grande. Máximo: 10MB",
        code: "CERTIFICATE_TOO_LARGE"
      });
    }

    // Basic PKCS12 format check
    const looksPkcs12 = certificateBytes[0] === 0x30 || (certificateBytes.length > 4 && certificateBytes[0] === 0x00);

    if (!looksPkcs12 && certificateBytes.length < 100) {
      logStep("ERROR: Does not look like PKCS12", { first_byte: certificateBytes[0] });
      return json(400, { 
        error: "Arquivo não parece ser um certificado válido",
        code: "INVALID_CERTIFICATE_TYPE",
        details: "O arquivo deve ser um certificado A1 no formato .pfx ou .p12"
      });
    }

    // =========================================================
    // ✅ NEW: Register/Update company in Focus NFe WITH certificate
    // =========================================================
    if (focusToken) {
      logStep("Registering certificate in Focus NFe...");
      
      const focusResult = await registerOrUpdateCompanyInFocusNfe(
        issuer,
        normalizedCertificateBase64,
        normalizedCertificatePassword,
        focusToken
      );

      if (!focusResult.success) {
        logStep("ERROR: Focus NFe registration failed", { error: focusResult.error });
        // Não mascarar a mensagem real da Focus — isso evita a sensação de "senha errada" quando não é.
        return json(422, {
          error: focusResult.error || "Falha ao registrar certificado na Focus NFe",
          code: "FOCUS_NFE_ERROR",
          details: {
            hint:
              "A Focus NFe rejeitou o cadastro/atualização da empresa com certificado. As causas mais comuns são: certificado A1 sem chave privada, senha com caractere invisível/whitespace, certificado não pertence ao CPF/CNPJ informado, ou token/ambiente incorretos.",
            focus_error: focusResult.error,
          },
        });
      }

      // Update issuer with Focus company ID if we got one
      if (focusResult.focusCompanyId) {
        await supabase
          .from("fiscal_issuers")
          .update({ focus_company_id: focusResult.focusCompanyId })
          .eq("id", issuer.id);
        
        logStep("Updated issuer with focus_company_id", { 
          focus_company_id: focusResult.focusCompanyId 
        });
      }

      logStep("SUCCESS: Certificate registered in Focus NFe");
    } else {
      logStep("WARNING: FOCUS_NFE_TOKEN not configured, skipping Focus NFe registration");
    }

    // =========================================================
    // Upload to storage (backup)
    // =========================================================
    const timestamp = Date.now();
    const safeFileName = (file_name || "certificate.pfx").replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `certificates/${issuer.id}/${timestamp}_${safeFileName}`;

    logStep("Uploading to storage", { path: storagePath });

    const { error: uploadError } = await supabase.storage
      .from("fiscal-certificates")
      .upload(storagePath, certificateBytes, {
        contentType: "application/x-pkcs12",
        upsert: false,
      });

    if (uploadError) {
      logStep("WARNING: Storage upload failed (non-critical)", { error: uploadError.message });
      // Don't fail the whole operation if local storage fails - Focus NFe already has the cert
    } else {
      logStep("Storage upload successful", { path: storagePath });
    }

    // =========================================================
    // Create certificate record
    // =========================================================
    const now = new Date();
    const validFrom = now.toISOString();
    const validUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

    // Revoke previous valid certificates
    const { error: revokeError } = await supabase
      .from("fiscal_certificates")
      .update({ is_valid: false, status: "revoked", updated_at: now.toISOString() })
      .eq("issuer_id", issuer.id)
      .eq("is_valid", true);

    if (revokeError) {
      logStep("WARNING: Failed to revoke old certificates", { error: revokeError.message });
    } else {
      logStep("Previous certificates revoked");
    }

    // Insert new certificate record
    const { data: certificate, error: certError } = await supabase
      .from("fiscal_certificates")
      .insert({
        issuer_id: issuer.id,
        certificate_type: "A1",
        subject_cn: `Certificado A1 - ${safeFileName}`,
        valid_from: validFrom,
        valid_until: validUntil,
        is_valid: true,
        is_expired: false,
        status: "valid",
        storage_path: uploadError ? null : storagePath,
        uploaded_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id, certificate_type, valid_from, valid_until, is_valid, status")
      .single();

    if (certError) {
      logStep("ERROR: Certificate insert failed", { error: certError.message });
      
      // Cleanup: remove uploaded file if we managed to upload
      if (!uploadError) {
        await supabase.storage.from("fiscal-certificates").remove([storagePath]);
      }
      
      return json(500, { 
        error: "Erro ao registrar certificado",
        code: "CERTIFICATE_INSERT_ERROR",
        details: certError.message
      });
    }

    logStep("Certificate record created", { certificate_id: certificate.id });

    // =========================================================
    // Update issuer status to ACTIVE (certificate + Focus NFe are ready)
    // =========================================================
    const newStatus = focusToken ? "active" : "certificate_uploaded";
    
    const { error: updateError } = await supabase
      .from("fiscal_issuers")
      .update({
        status: newStatus,
        updated_at: now.toISOString(),
      })
      .eq("id", issuer.id);

    if (updateError) {
      logStep("WARNING: Failed to update issuer status", { error: updateError.message });
    } else {
      logStep(`Issuer status updated to ${newStatus}`);
    }

    // =========================================================
    // Success response
    // =========================================================
    logStep("SUCCESS: Certificate upload complete", { 
      issuer_id: issuer.id, 
      certificate_id: certificate.id,
      focus_registered: !!focusToken
    });

    return json(201, {
      success: true,
      message: focusToken 
        ? "Certificado enviado e registrado na Focus NFe com sucesso!" 
        : "Certificado enviado com sucesso (Focus NFe não configurado)",
      issuer: { 
        id: issuer.id, 
        status: newStatus,
      },
      certificate: {
        id: certificate.id,
        certificate_type: certificate.certificate_type,
        valid_from: certificate.valid_from,
        valid_until: certificate.valid_until,
        is_valid: certificate.is_valid,
        status: certificate.status,
      },
      focus_nfe_registered: !!focusToken,
    });

  } catch (error) {
    logStep("FATAL ERROR", { error: String(error), stack: (error as Error)?.stack });
    return json(500, { 
      error: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    });
  }
});
