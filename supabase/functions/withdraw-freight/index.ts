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

    // Fetch freight to ensure it belongs to this driver and is eligible
    const { data: freight, error: freightErr } = await supabase
      .from("freights")
      .select("id, status, driver_id")
      .eq("id", freightId)
      .single();

    if (freightErr || !freight) {
      return new Response(JSON.stringify({ error: "Freight not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (freight.driver_id !== driverId || !(freight.status === "ACCEPTED" || freight.status === "LOADING")) {
      return new Response(JSON.stringify({ error: "Freight not eligible for withdrawal" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block if there are check-ins by this driver for this freight
    const { count: checkinsCount, error: checkinsErr } = await supabase
      .from("freight_checkins")
      .select("id", { count: "exact", head: true })
      .eq("freight_id", freightId)
      .eq("user_id", driverId);

    if (checkinsErr) {
      console.error("withdraw-freight: error counting checkins", checkinsErr);
    }

    if ((checkinsCount || 0) > 0) {
      return new Response(
        JSON.stringify({ error: "HAS_CHECKINS" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update freight to OPEN and remove driver
    const { data: updatedFreight, error: updateFreightErr } = await supabase
      .from("freights")
      .update({ status: "OPEN", driver_id: null, updated_at: new Date().toISOString() })
      .eq("id", freightId)
      .eq("driver_id", driverId)
      .select("*")
      .single();

    if (updateFreightErr || !updatedFreight) {
      return new Response(JSON.stringify({ error: "Failed to update freight" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark proposals as CANCELLED to keep history
    await supabase
      .from("freight_proposals")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("freight_id", freightId)
      .eq("driver_id", driverId);

    return new Response(JSON.stringify({ success: true, freight: updatedFreight }), {
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
