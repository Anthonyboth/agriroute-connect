import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema } from '../_shared/validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(token);
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json()
    const validated = validateInput(WithdrawFreightSchema, body)
    const freightId = validated.freight_id

    // Find driver profile id for this user
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile || profile.role !== "MOTORISTA") {
      return new Response(JSON.stringify({ error: "Driver profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driverId: string = profile.id as string;

    // Call hardened SQL function
    const { data: result, error: rpcError } = await supabase.rpc('process_freight_withdrawal', {
      freight_id_param: freightId,
      driver_profile_id: driverId
    });

    if (rpcError) {
      console.error('withdraw-freight RPC error:', rpcError);
      return new Response(JSON.stringify({ error: 'RPC_ERROR', details: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse result from function
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
          message = 'Não é possível desistir do frete neste status (somente ACCEPTED ou LOADING são permitidos)';
          statusCode = 409;
          break;
        case 'HAS_CHECKINS':
          message = 'Não é possível desistir do frete após o primeiro check-in.';
          statusCode = 409;
          break;
        default:
          message = errCode;
      }

      return new Response(JSON.stringify({ error: errCode, message }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: res.message || 'Desistência processada com sucesso' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("withdraw-freight error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});