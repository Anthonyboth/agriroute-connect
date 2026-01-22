import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) return json(401, { error: "Token inválido" });

    // perfil do usuário logado
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) return json(404, { error: "Perfil não encontrado" });

    // validar payload
    const body = await req.json();
    const validation = UploadCertificateSchema.safeParse(body);

    if (!validation.success) {
      return json(400, {
        error: "Dados inválidos",
        details: validation.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const { issuer_id, certificate_base64, certificate_password, file_name } = validation.data;

    /**
     * ✅ BLINDADO:
     * Não referenciamos perfil_id/profile_id no SQL (porque pode variar por ambiente).
     * Buscamos por ID e depois checamos o dono lendo o campo que existir.
     */
    const { data: issuer, error: issuerError } = await supabase
      .from("fiscal_issuers")
      .select("*")
      .eq("id", issuer_id)
      .single();

    if (issuerError || !issuer) return json(404, { error: "Emissor fiscal não encontrado" });

    const ownerId = (issuer as any).perfil_id ?? (issuer as any).profile_id ?? (issuer as any).profileId ?? null;

    if (!ownerId) {
      return json(500, {
        error: "Schema inconsistente: emissor fiscal sem campo de vínculo de perfil (perfil_id/profile_id).",
      });
    }

    if (ownerId !== profile.id) {
      return json(403, { error: "Você não tem permissão para este emissor" });
    }

    // decode base64
    let certificateBytes: Uint8Array;
    try {
      const binaryString = atob(certificate_base64);
      certificateBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        certificateBytes[i] = binaryString.charCodeAt(i);
      }
    } catch {
      return json(400, { error: "Formato de certificado inválido (base64)" });
    }

    if (certificateBytes.length > 10 * 1024 * 1024) {
      return json(400, { error: "Certificado muito grande. Máximo: 10MB" });
    }

    // validação simples (PKCS12 costuma iniciar com 0x30)
    const looksPkcs12 = certificateBytes[0] === 0x30 || certificateBytes[0] === 0x00;
    if (!looksPkcs12 && certificateBytes.length < 100) {
      return json(400, { error: "Arquivo não parece ser um certificado válido (.pfx/.p12)" });
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
      console.error("[fiscal-certificate-upload] Storage error:", uploadError);
      return json(500, { error: "Erro ao armazenar certificado", details: uploadError.message });
    }

    // (simulado) datas
    const now = new Date();
    const validFrom = new Date().toISOString();
    const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();

    // desativar anteriores
    await supabase
      .from("fiscal_certificates")
      .update({ is_valid: false, status: "revoked" })
      .eq("issuer_id", issuer_id)
      .eq("is_valid", true);

    // registrar
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
      console.error("[fiscal-certificate-upload] DB insert error:", certError);

      // rollback storage
      await supabase.storage.from("fiscal-certificates").remove([storagePath]);

      return json(500, { error: "Erro ao registrar certificado", details: certError.message });
    }

    // atualizar status do issuer (não depende de coluna perfil_id/profile_id)
    const { error: updateError } = await supabase
      .from("fiscal_issuers")
      .update({
        status: "CERTIFICATE_UPLOADED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", issuer_id);

    if (updateError) {
      console.error("[fiscal-certificate-upload] Issuer update error:", updateError);
      // não fatal
    }

    return json(201, {
      success: true,
      message: "Certificado enviado com sucesso",
      certificate: {
        id: certificate.id,
        certificate_type: certificate.certificate_type,
        valid_from: certificate.valid_from,
        valid_until: certificate.valid_until,
        is_valid: certificate.is_valid,
        status: certificate.status,
      },
    });
  } catch (error: any) {
    console.error("[fiscal-certificate-upload] Unexpected error:", error);
    return json(500, { error: "Erro interno do servidor", details: error?.message });
  }
});
