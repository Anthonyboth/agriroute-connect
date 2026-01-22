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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) return json(404, { error: "Perfil não encontrado" });

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

    // =========================================================
    // ✅ Buscar emissor com fallback seguro (perfil_id)
    // =========================================================
    let issuer: { id: string; perfil_id: string; status?: string } | null = null;

    if (issuer_id) {
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, perfil_id, status")
        .eq("id", issuer_id)
        .maybeSingle();

      if (error) {
        console.error("[fiscal-certificate-upload] issuer by id error:", error);
      }
      issuer = data ?? null;
    }

    // ✅ Fallback: se não achou por ID, tenta pelo perfil logado
    if (!issuer) {
      const { data, error } = await supabase
        .from("fiscal_issuers")
        .select("id, perfil_id, status")
        .eq("perfil_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[fiscal-certificate-upload] issuer by perfil_id error:", error);
      }
      issuer = data ?? null;
    }

    if (!issuer) {
      // Aqui a mensagem já te diz o que está errado
      return json(404, {
        error: "Emissor fiscal não encontrado",
        details: {
          received_issuer_id: issuer_id ?? null,
          profile_id: profile.id,
          hint: "Verifique se o front está enviando fiscal_issuers.id (e não profiles.id) e se está no mesmo projeto Supabase (Preview vs Produção).",
        },
      });
    }

    if (issuer.perfil_id !== profile.id) {
      return json(403, { error: "Você não tem permissão para este emissor" });
    }

    // =========================================================
    // Decode base64 certificate
    // =========================================================
    let certificateBytes: Uint8Array;
    try {
      const binaryString = atob(certificate_base64);
      certificateBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) certificateBytes[i] = binaryString.charCodeAt(i);
    } catch {
      return json(400, { error: "Formato de certificado inválido" });
    }

    if (certificateBytes.length > 10 * 1024 * 1024) {
      return json(400, { error: "Certificado muito grande. Máximo: 10MB" });
    }

    const looksPkcs12 = certificateBytes[0] === 0x30 || (certificateBytes.length > 4 && certificateBytes[0] === 0x00);

    if (!looksPkcs12 && certificateBytes.length < 100) {
      return json(400, { error: "Arquivo não parece ser um certificado válido" });
    }

    // Storage path
    const timestamp = Date.now();
    const safeFileName = (file_name || "certificate.pfx").replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `certificates/${issuer.id}/${timestamp}_${safeFileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("fiscal-certificates")
      .upload(storagePath, certificateBytes, {
        contentType: "application/x-pkcs12",
        upsert: false,
      });

    if (uploadError) {
      console.error("[fiscal-certificate-upload] storage error:", uploadError);
      return json(500, { error: "Erro ao armazenar certificado", details: uploadError.message });
    }

    // Validity (simulado)
    const now = new Date();
    const validFrom = new Date().toISOString();
    const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();

    // Revoke previous valid certs
    await supabase
      .from("fiscal_certificates")
      .update({ is_valid: false, status: "revoked" })
      .eq("issuer_id", issuer.id)
      .eq("is_valid", true);

    // Create certificate record
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
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (certError) {
      console.error("[fiscal-certificate-upload] cert insert error:", certError);
      await supabase.storage.from("fiscal-certificates").remove([storagePath]);
      return json(500, { error: "Erro ao registrar certificado", details: certError.message });
    }

    // ✅ Update issuer status to match frontend enum (lowercase)
    const { error: updateError } = await supabase
      .from("fiscal_issuers")
      .update({
        status: "certificate_uploaded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", issuer.id);

    if (updateError) {
      console.error("[fiscal-certificate-upload] issuer update error:", updateError);
      // Não falha a request, mas avisamos o front
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
        issuer: { id: issuer.id, status: issuer.status ?? null },
      });
    }

    return json(201, {
      success: true,
      message: "Certificado enviado com sucesso",
      issuer: { id: issuer.id, status: "certificate_uploaded" },
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
    console.error("[fiscal-certificate-upload] Unexpected error:", error);
    return json(500, { error: "Erro interno do servidor" });
  }
});
