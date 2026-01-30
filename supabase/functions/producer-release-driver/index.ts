import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { validateInput, uuidSchema } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  freight_id: uuidSchema,
  driver_id: uuidSchema,
  reason: z.string().trim().max(500).optional(),
});

type Json = Record<string, unknown>;

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

    const body = validateInput(BodySchema, await req.json());
    const freightId = body.freight_id;
    const driverId = body.driver_id;
    const reason = body.reason || "Motorista liberado pelo produtor";

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

    const callerRole = String((caller as any).role || "").toUpperCase();
    const callerProfileId = String((caller as any).id);
    const isAdmin = callerRole === "ADMIN";
    const isProducer = callerRole === "PRODUTOR";

    if (!isAdmin && !isProducer) {
      return new Response(JSON.stringify({ success: false, error: "NOT_AUTHORIZED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Freight must belong to producer (unless admin)
    const { data: freight, error: freightErr } = await supabase
      .from("freights")
      .select("id, producer_id, status, driver_id, drivers_assigned, required_trucks, accepted_trucks, metadata")
      .eq("id", freightId)
      .single();

    if (freightErr || !freight) {
      return new Response(JSON.stringify({ success: false, error: "FREIGHT_NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin && String((freight as any).producer_id) !== callerProfileId) {
      return new Response(JSON.stringify({ success: false, error: "NOT_OWNER" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Find current assignment status for this driver
    const { data: assignment } = await supabase
      .from("freight_assignments")
      .select("id, status, metadata")
      .eq("freight_id", freightId)
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const assignmentStatus = String((assignment as any)?.status || "").toUpperCase();

    // ✅ Multi-carreta: o status global do frete pode ficar OPEN mesmo com motoristas em progresso.
    // Por isso, além do freight_assignments, checamos driver_trip_progress como fonte de verdade.
    const { data: tripProgressRow } = await supabase
      .from("driver_trip_progress")
      .select("current_status")
      .eq("freight_id", freightId)
      .eq("driver_id", driverId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tripStatus = String((tripProgressRow as any)?.current_status || "").toUpperCase();
    const freightStatus = String((freight as any).status || "").toUpperCase();

    const canRelease =
      ["ACCEPTED", "LOADING"].includes(assignmentStatus) ||
      ["ACCEPTED", "LOADING"].includes(tripStatus) ||
      (!assignment && ["ACCEPTED", "LOADING"].includes(freightStatus));

    if (!canRelease) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "INVALID_STATUS",
          message:
            "Só é possível liberar o motorista quando a atribuição está em ACCEPTED ou LOADING (antes de CARREGADO/EM TRÂNSITO).",
          debug: { freight_status: (freight as any).status, assignment_status: (assignment as any)?.status, trip_status: (tripProgressRow as any)?.current_status },
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4) Mark assignment as CANCELLED (producer-side release)
    if (assignment?.id) {
      const { error: asgUpdErr } = await supabase
        .from("freight_assignments")
        .update({
          status: "CANCELLED",
          notes: reason,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(assignment as any).metadata,
            released_by: callerProfileId,
            released_at: new Date().toISOString(),
            released_reason: reason,
          },
        })
        .eq("id", assignment.id);

      if (asgUpdErr) {
        return new Response(JSON.stringify({ success: false, error: "ASSIGNMENT_UPDATE_FAILED", details: asgUpdErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5) Remove trip progress row for this driver+freight (defense-in-depth)
    await supabase
      .from("driver_trip_progress")
      .delete()
      .eq("freight_id", freightId)
      .eq("driver_id", driverId);

    // 6) Update freight to reopen
    const requiredTrucks = Number((freight as any).required_trucks ?? 1);
    const acceptedTrucks = Number((freight as any).accepted_trucks ?? 0);

    const existingDriversAssigned = Array.isArray((freight as any).drivers_assigned)
      ? ((freight as any).drivers_assigned as string[])
      : [];
    const newDriversAssigned = existingDriversAssigned.filter((id) => id !== driverId);

    const newAcceptedTrucks = Math.max(0, acceptedTrucks - 1);

    const freightUpdate: Record<string, unknown> = {
      status: "OPEN",
      updated_at: new Date().toISOString(),
      metadata: {
        ...(((freight as any).metadata as Json | null) ?? {}),
        last_driver_release: {
          driver_id: driverId,
          released_by: callerProfileId,
          reason,
          at: new Date().toISOString(),
        },
      },
    };

    // Single truck: clear legacy driver_id
    if (requiredTrucks <= 1) {
      freightUpdate.driver_id = null;
      freightUpdate.accepted_trucks = 0;
      freightUpdate.drivers_assigned = [];
    } else {
      // Multi-truck: update counters + assigned list
      freightUpdate.accepted_trucks = newAcceptedTrucks;
      freightUpdate.drivers_assigned = newDriversAssigned;
      // driver_id can remain null in multi-truck; ensure not pointing to released driver
      if (String((freight as any).driver_id || "") === driverId) {
        freightUpdate.driver_id = null;
      }
    }

    const { error: freightUpdErr } = await supabase
      .from("freights")
      .update(freightUpdate)
      .eq("id", freightId);

    if (freightUpdErr) {
      return new Response(JSON.stringify({ success: false, error: "FREIGHT_UPDATE_FAILED", details: freightUpdErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7) Cancel/close any accepted proposal for this driver on this freight
    await supabase
      .from("freight_proposals")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("freight_id", freightId)
      .eq("driver_id", driverId)
      .eq("status", "ACCEPTED");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Motorista liberado e frete reaberto",
        freight_id: freightId,
        driver_id: driverId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[producer-release-driver] error:", err);
    return new Response(JSON.stringify({ success: false, error: "INTERNAL_ERROR", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
