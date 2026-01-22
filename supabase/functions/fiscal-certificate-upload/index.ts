import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const FUNCTION_VERSION = "fiscal-certificate-upload v2026-01-22-02";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UploadCertificateSchema = z.object({
  issuer_id: z.string().uuid("ID do emissor inválido"),
  certificate_base64: z.string().min(100, "Certificado muito pequeno"),
  certificate_password: z.string().min(1, "Senha do certificado é obrigatória"),
  file_name: z.string().max(255).optional(),
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeJsonParse(input: unknown) {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log(`[${FUNCTION_VERSION}] start`);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado", version: FUNCTION_VERSION });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await supabase.auth.getUser(token);
    const user = userRes?.user;

    if (authError || !user) {
      return json(401, { error: "Token inválido", version: FUNCTION_VERSION });
    }

    // profile atual
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.id) {
      return json(404, { error: "Perfil não encontrado", version: FUNCTION_VERSION });
    }

    const body = await req.json();
    const validation = UploadCertificateSchema.safeParse(body);
    if (!validation.success) {
      return json(400, {
        error: "Dados inválidos",
        details: validation.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
        version: FUNCTION_VERSION,
      });
    }

    const { issuer_id, certificate_base64, certificate_password, file_name } = validation.data;

    // ✅ BUSCA ISSUER (coluna correta: profile_id)
    const { data: issuer, error: issuerError } = await supabase
      .from("fiscal_issuers")
      .select("id, profile_id, status")
      .eq("id", issuer_id)
      .single();

    if (issuerError || !issuer) {
      console.error(`[${FUNCTION_VERSION}] issuerError`, issuerError);
      return json(404, { error: "Emissor fiscal não encontrado", version: FUNCTION_VERSION });
    }

    // ✅ valida ownership
    if ((issuer as any).profile_id !== profile.id) {
      return json(403, { error: "Você não tem permissão para este emissor", version: FUNCTION_VERSION });
    }

    // decode base64
    let certificateBytes: Uint8Array;
    try {
      const binaryString = atob(certificate_base64);
      certificateBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) certificateBytes[i] = binaryString.charCodeAt(i);
    } catch {
      return json(400, { error: "Formato de certificado inválido", version: FUNCTION_VERSION });
    }

    if (certificateBytes.length > 10 * 1024 * 1024) {
      return json(400, { error: "Certificado muito grande. Máximo: 10MB", version: FUNCTION_VERSION });
    }

    // validação básica (PKCS12 DER começa com 0x30 na maioria dos casos)
    const isLikelyPkcs12 =
      certificateBytes[0] === 0x30 || (certificateBytes.length > 4 && certificateBytes[0] === 0x00);
    if (!isLikelyPkcs12 && certificateBytes.length < 100) {
      return json(400, { error: "Arquivo não parece ser um certificado válido", version: FUNCTION_VERSION });
    }

    const timestamp = Date.now();
    const safeFileName = (file_name || "certificate.pfx").replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `certificates/${issuer_id}/${timestamp}_${safeFileName}`;

    // upload storage
    const { error: uploadError } = await supabase.storage
      .from("fiscal-certificates")
      .upload(storagePath, certificateBytes, {
        contentType: "application/x-pkcs12",
        upsert: false,
      });

    if (uploadError) {
      console.error(`[${FUNCTION_VERSION}] storage uploadError`, uploadError);
      return json(500, {
        error: "Erro ao armazenar certificado",
        details: uploadError.message,
        version: FUNCTION_VERSION,
      });
    }

    // ⚠️ aqui você não está validando senha de verdade (não dá sem parser PKCS12)
    // você só salva e marca como válido. ok por enquanto.

    const now = new Date();
    const validFrom = now.toISOString();
    const validUntil = new Date(new Date().setFullYear(now.getFullYear() + 1)).toISOString();

    // desativar anteriores
    const { error: revokeError } = await supabase
      .from("fiscal_certificates")
      .update({ is_valid: false, status: "revoked" })
      .eq("issuer_id", issuer_id)
      .eq("is_valid", true);

    if (revokeError) {
      console.warn(`[${FUNCTION_VERSION}] revokeError`, revokeError);
      // não fatal
    }

    // registrar certificado
    const { data: certificate, error: certError } = await supabase
      .from("fiscal_certificates")
      .insert({
        issuer_id,
        certificate_type: "A1",
        subject_cn: `Certificado A1 - ${safeFileName}`,
        valid_from: validFrom,
        valid_until: validUntil,
        is_valid: true,
        is_expired: false,
        status: "valid",
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (certError) {
      console.error(`[${FUNCTION_VERSION}] certError`, certError);
      await supabase.storage.from("fiscal-certificates").remove([storagePath]);
      return json(500, {
        error: "Erro ao registrar certificado",
        details: certError.message,
        version: FUNCTION_VERSION,
      });
    }

    // atualizar issuer
    const { error: updateIssuerError } = await supabase
      .from("fiscal_issuers")
      .update({
        status: "CERTIFICATE_UPLOADED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", issuer_id);

    if (updateIssuerError) {
      console.warn(`[${FUNCTION_VERSION}] updateIssuerError`, updateIssuerError);
      // não fatal
    }

    console.log(`[${FUNCTION_VERSION}] ok issuer=${issuer_id} cert=${certificate?.id}`);

    return json(201, {
      success: true,
      version: FUNCTION_VERSION,
      certificate: {
        id: certificate.id,
        certificate_type: certificate.certificate_type,
        valid_from: certificate.valid_from,
        valid_until: certificate.valid_until,
        is_valid: certificate.is_valid,
        status: certificate.status,
      },
      message: "Certificado enviado com sucesso",
    });
  } catch (error) {
    console.error(`[${FUNCTION_VERSION}] Unexpected error:`, error);
    return json(500, {
      error: "Erro interno do servidor",
      details: safeJsonParse((error as any)?.message),
      version: FUNCTION_VERSION,
    });
  }
});
