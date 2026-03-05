import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema } from '../_shared/validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WithdrawFreightSchema = z.object({
  freight_id: uuidSchema
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ✅ User-scoped client — preserves auth.uid() inside RPC/RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ✅ Validate JWT via getUser (service role for reliable verification)
    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      console.error('[withdraw-freight] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log('[withdraw-freight] Authenticated user:', userId);

    const body = await req.json();
    const validated = validateInput(WithdrawFreightSchema, body);
    const freightId = validated.freight_id;

    // ✅ Reuse adminClient for profile lookup (multi-role safe)

    const { data: profiles, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", userId);

    if (profileErr || !profiles || profiles.length === 0) {
      console.error('[withdraw-freight] Profile lookup failed:', profileErr?.message);
      return new Response(JSON.stringify({ error: "Driver profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ Multi-role: find MOTORISTA profile
    const driverProfile = profiles.find(p => p.role === 'MOTORISTA') || profiles.find(p => p.role === 'MOTORISTA_AFILIADO');
    if (!driverProfile) {
      return new Response(JSON.stringify({ error: "Driver profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driverId = driverProfile.id;
    console.log('[withdraw-freight] Driver profile:', driverId, 'Freight:', freightId);

    // ✅ Call RPC with USER client so auth.uid() is set inside the function
    const { data: result, error: rpcError } = await userClient.rpc('process_freight_withdrawal', {
      freight_id_param: freightId,
      driver_profile_id: driverId
    });

    if (rpcError) {
      console.error('[withdraw-freight] RPC error:', rpcError);
      return new Response(JSON.stringify({ error: 'RPC_ERROR', details: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = result as any;
    if (!res || !res.success) {
      const errCode = res?.error || 'UNKNOWN_ERROR';
      let statusCode = 409;
      let message = 'Erro ao processar desistência';

      switch (errCode) {
        case 'NOT_OWNER_OR_NOT_FOUND':
          message = 'Frete não encontrado ou não pertence ao motorista';
          statusCode = 404;
          break;
        case 'INVALID_STATUS':
          message = 'Não é possível desistir do frete neste status (somente ACCEPTED ou LOADING)';
          statusCode = 409;
          break;
        case 'HAS_CHECKINS':
          message = 'Não é possível desistir do frete após o primeiro check-in.';
          statusCode = 409;
          break;
        case 'NOT_AUTHENTICATED':
          message = 'Sessão expirada. Faça login novamente.';
          statusCode = 401;
          break;
        case 'ACCESS_DENIED':
          message = 'Acesso negado.';
          statusCode = 403;
          break;
        default:
          message = errCode;
      }

      console.error('[withdraw-freight] Business error:', errCode);
      return new Response(JSON.stringify({ error: errCode, message }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('[withdraw-freight] Success for freight:', freightId);
    return new Response(JSON.stringify({ success: true, message: res.message || 'Desistência processada com sucesso' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[withdraw-freight] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
