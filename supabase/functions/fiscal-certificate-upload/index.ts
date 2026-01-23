import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No auth header");
      return json(401, { error: "Não autorizado", code: "NO_AUTH_HEADER" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    // ✅ CORREÇÃO: Buscar emissor usando profile_id (não perfil_id)
    // =========================================================
    let issuer: { id: string; profile_id: string; status: string } | null = null;

    // Primeiro tenta buscar pelo issuer_id fornecido
    if (issuer_id) {
      logStep("Searching issuer by ID", { issuer_id });
      
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, profile_id, status")
        .eq("id", issuer_id)
        .maybeSingle();

      if (error) {
        logStep("ERROR: Query by issuer_id failed", { error: error.message });
      } else if (data) {
        issuer = data;
        logStep("Issuer found by ID", { issuer_id: data.id, profile_id: data.profile_id, status: data.status });
      } else {
        logStep("Issuer not found by ID", { issuer_id });
      }
    }

    // Fallback: busca pelo profile_id do usuário logado
    if (!issuer) {
      logStep("Fallback: searching issuer by profile_id", { profile_id: profile.id });
      
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, profile_id, status")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logStep("ERROR: Query by profile_id failed", { error: error.message });
      } else if (data) {
        issuer = data;
        logStep("Issuer found by profile_id", { issuer_id: data.id, profile_id: data.profile_id, status: data.status });
      } else {
        logStep("No issuer found for profile", { profile_id: profile.id });
      }
    }

    // Se não encontrou emissor
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

    // Verifica se o emissor pertence ao perfil do usuário
    if (issuer.profile_id !== profile.id) {
      logStep("ERROR: Issuer does not belong to user", { 
        issuer_profile_id: issuer.profile_id, 
        user_profile_id: profile.id 
      });
      
      return json(403, { 
        error: "Você não tem permissão para este emissor",
        code: "FORBIDDEN",
        details: {
          issuer_id: issuer.id,
          hint: "O emissor fiscal pertence a outro usuário."
        }
      });
    }

    logStep("Authorization check passed");

    // =========================================================
    // Decode base64 certificate
    // =========================================================
    let certificateBytes: Uint8Array;
    try {
      const binaryString = atob(certificate_base64);
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
    // Upload to storage
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
      logStep("ERROR: Storage upload failed", { error: uploadError.message });
      return json(500, { 
        error: "Erro ao armazenar certificado",
        code: "STORAGE_UPLOAD_ERROR",
        details: uploadError.message
      });
    }

    logStep("Storage upload successful", { path: storagePath });

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
      // Continue anyway - not critical
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
        storage_path: storagePath,
        uploaded_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id, certificate_type, valid_from, valid_until, is_valid, status")
      .single();

    if (certError) {
      logStep("ERROR: Certificate insert failed", { error: certError.message });
      
      // Cleanup: remove uploaded file
      await supabase.storage.from("fiscal-certificates").remove([storagePath]);
      
      return json(500, { 
        error: "Erro ao registrar certificado",
        code: "CERTIFICATE_INSERT_ERROR",
        details: certError.message
      });
    }

    logStep("Certificate record created", { certificate_id: certificate.id });

    // =========================================================
    // Update issuer status
    // =========================================================
    const { error: updateError } = await supabase
      .from("fiscal_issuers")
      .update({
        status: "certificate_uploaded",
        updated_at: now.toISOString(),
      })
      .eq("id", issuer.id);

    if (updateError) {
      logStep("WARNING: Failed to update issuer status", { error: updateError.message });
      
      // Return partial success
      return json(201, {
        success: true,
        warning: "Certificado salvo, mas falhou ao atualizar status do emissor",
        warning_details: updateError.message,
        certificate: {
          id: certificate.id,
          certificate_type: certificate.certificate_type,
          valid_from: certificate.valid_from,
          valid_until: certificate.valid_until,
          is_valid: certificate.is_valid,
          status: certificate.status,
        },
        issuer: { 
          id: issuer.id, 
          status: issuer.status,
          profile_id: issuer.profile_id
        },
      });
    }

    logStep("Issuer status updated to certificate_uploaded");

    // =========================================================
    // Success response
    // =========================================================
    logStep("SUCCESS: Certificate upload complete", { 
      issuer_id: issuer.id, 
      certificate_id: certificate.id 
    });

    return json(201, {
      success: true,
      message: "Certificado enviado com sucesso",
      issuer: { 
        id: issuer.id, 
        status: "certificate_uploaded",
        profile_id: issuer.profile_id
      },
      certificate: {
        id: certificate.id,
        certificate_type: certificate.certificate_type,
        valid_from: certificate.valid_from,
        valid_until: certificate.valid_until,
        is_valid: certificate.is_valid,
        status: certificate.status,
      },
    });

  } catch (error) {
    logStep("FATAL ERROR", { error: String(error), stack: (error as Error)?.stack });
    return json(500, { 
      error: "Erro interno do servidor",
      code: "INTERNAL_ERROR"
    });
  }
});
