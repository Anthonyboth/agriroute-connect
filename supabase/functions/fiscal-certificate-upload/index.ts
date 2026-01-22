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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Profile do usuário logado
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const validation = UploadCertificateSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: "Dados inválidos",
          details: validation.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { issuer_id, certificate_base64, certificate_password, file_name } = validation.data;

    /**
     * ✅ AQUI ESTÁ A CORREÇÃO:
     * Sua coluna é `perfil_id` (não `profile_id`)
     */
    const { data: issuer, error: issuerError } = await supabase
      .from("fiscal_issuers")
      .select("id, perfil_id, status")
      .eq("id", issuer_id)
      .single();

    if (issuerError || !issuer) {
      return new Response(JSON.stringify({ error: "Emissor fiscal não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ conferir dono
    if ((issuer as any).perfil_id !== profile.id) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para este emissor" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64
    let certificateBytes: Uint8Array;
    try {
      const binaryString = atob(certificate_base64);
      certificateBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        certificateBytes[i] = binaryString.charCodeAt(i);
      }
    } catch {
      return new Response(JSON.stringify({ error: "Formato de certificado inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (certificateBytes.length > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Certificado muito grande. Máximo: 10MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValidFormat = certificateBytes[0] === 0x30 || (certificateBytes.length > 4 && certificateBytes[0] === 0x00);

    if (!isValidFormat && certificateBytes.length < 100) {
      return new Response(JSON.stringify({ error: "Arquivo não parece ser um certificado válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamp = Date.now();
    const safeFileName = (file_name || "certificate.pfx").replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `certificates/${issuer_id}/${timestamp}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("fiscal-certificates")
      .upload(storagePath, certificateBytes, {
        contentType: "application/x-pkcs12",
        upsert: false,
      });

    if (uploadError) {
      console.error("[fiscal-certificate-upload] Storage error:", uploadError);
      return new Response(JSON.stringify({ error: "Erro ao armazenar certificado", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simulado (ideal seria parsear PKCS12)
    const now = new Date();
    const validFrom = now.toISOString();
    const validUntil = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();

    // desativar anteriores
    await supabase
      .from("fiscal_certificates")
      .update({ is_valid: false, status: "revoked" })
      .eq("issuer_id", issuer_id)
      .eq("is_valid", true);

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
      console.error("[fiscal-certificate-upload] Certificate record error:", certError);
      await supabase.storage.from("fiscal-certificates").remove([storagePath]);

      return new Response(JSON.stringify({ error: "Erro ao registrar certificado", details: certError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ status do issuer (mantém o seu padrão atual)
    const { error: updateError } = await supabase
      .from("fiscal_issuers")
      .update({
        status: "CERTIFICATE_UPLOADED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", issuer_id);

    if (updateError) {
      console.error("[fiscal-certificate-upload] Issuer update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        certificate: {
          id: certificate.id,
          certificate_type: certificate.certificate_type,
          valid_from: certificate.valid_from,
          valid_until: certificate.valid_until,
          is_valid: certificate.is_valid,
          status: certificate.status,
        },
        message: "Certificado enviado com sucesso",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[fiscal-certificate-upload] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor", details: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
