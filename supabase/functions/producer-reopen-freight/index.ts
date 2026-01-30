import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  freight_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "METHOD_NOT_ALLOWED" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "MISSING_AUTH" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    const user = userRes?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "INVALID_TOKEN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await req.json());
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: "INVALID_BODY", details: String(e) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const freightId = body.freight_id;

    console.log(`[producer-reopen-freight] User ${user.id} reopening freight ${freightId}`);

    // 1) Caller profile (must be producer/admin)
    const { data: caller, error: callerErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ success: false, error: "PROFILE_NOT_FOUND" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRole = String(caller.role || "").toUpperCase();
    const callerProfileId = String(caller.id);
    const isAdmin = callerRole === "ADMIN";
    const isProducer = callerRole === "PRODUTOR";

    if (!isAdmin && !isProducer) {
      return new Response(JSON.stringify({ success: false, error: "NOT_AUTHORIZED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Get freight details
    const { data: freight, error: freightErr } = await supabase
      .from("freights")
      .select("id, producer_id, status, required_trucks, accepted_trucks, metadata")
      .eq("id", freightId)
      .single();

    if (freightErr || !freight) {
      return new Response(JSON.stringify({ success: false, error: "FREIGHT_NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Check ownership (unless admin)
    if (!isAdmin && String(freight.producer_id) !== callerProfileId) {
      return new Response(JSON.stringify({ success: false, error: "NOT_OWNER" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Only allow reopening if it's cancelled
    const currentStatus = String(freight.status || "").toUpperCase();
    if (currentStatus !== "CANCELLED") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_STATUS",
          message: `O frete não está cancelado (status atual: ${currentStatus}). Apenas fretes cancelados podem ser reabertos.`,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5) Reopen freight: set status to OPEN, reset driver assignments
    const freightUpdate: Record<string, unknown> = {
      status: "OPEN",
      driver_id: null,
      drivers_assigned: [],
      accepted_trucks: 0,
      updated_at: new Date().toISOString(),
      metadata: {
        ...((freight.metadata as Record<string, unknown>) ?? {}),
        reopened_by: callerProfileId,
        reopened_at: new Date().toISOString(),
        reopened_reason: "Frete reaberto pelo produtor após cancelamento",
      },
    };

    const { error: updateErr } = await supabase
      .from("freights")
      .update(freightUpdate)
      .eq("id", freightId);

    if (updateErr) {
      console.error("[producer-reopen-freight] Update error:", updateErr);
      return new Response(JSON.stringify({ success: false, error: "UPDATE_FAILED", details: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Cancel any old assignments for this freight
    await supabase
      .from("freight_assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("freight_id", freightId)
      .neq("status", "CANCELLED");

    // 7) Cancel any old proposals for this freight
    await supabase
      .from("freight_proposals")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("freight_id", freightId)
      .neq("status", "CANCELLED");

    // 8) Delete driver trip progress for this freight
    await supabase
      .from("driver_trip_progress")
      .delete()
      .eq("freight_id", freightId);

    // 9) Insert status history
    await supabase.from("freight_status_history").insert({
      freight_id: freightId,
      status: "OPEN",
      changed_by: callerProfileId,
      notes: "Frete reaberto manualmente pelo produtor",
    });

    console.log(`[producer-reopen-freight] ✅ Freight ${freightId} reopened successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Frete reaberto com sucesso! Agora está disponível para novos motoristas.",
        freight_id: freightId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[producer-reopen-freight] Error:", err);
    return new Response(JSON.stringify({ success: false, error: "INTERNAL_ERROR", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
