import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Find driver profile id
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile || (profile.role !== "MOTORISTA" && profile.role !== "MOTORISTA_AFILIADO")) {
      return new Response(JSON.stringify({ error: "Driver profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driverId: string = profile.id as string;

    // Fetch driver proposals (bypasses RLS with service role)
    const { data: proposals, error: propErr } = await supabase
      .from("freight_proposals")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (propErr) throw propErr;

    const freightIds = Array.from(
      new Set((proposals ?? []).map((p: any) => p.freight_id).filter(Boolean))
    );

    // Fetch freights for these proposals
    let freights: any[] = [];
    if (freightIds.length > 0) {
      const { data: freightsData, error: freErr } = await supabase
        .from("freights")
        .select(
          `*, producer:profiles!freights_producer_id_fkey(id,full_name,contact_phone,role)`
        )
        .in("id", freightIds);
      if (freErr) {
        console.error("driver-proposals: error fetching freights with embeds", freErr);
        // Fallback: fetch basic freight data without embeds
        const { data: basicFreights } = await supabase
          .from("freights")
          .select("*")
          .in("id", freightIds);
        freights = basicFreights ?? [];
      } else {
        freights = freightsData ?? [];
      }
    }

    const freightById = new Map((freights ?? []).map((f: any) => [f.id, f]));

    const enrichedProposals = (proposals ?? []).map((p: any) => ({
      ...p,
      freight: freightById.get(p.freight_id) || null,
    }));

    // Compute ongoing freights from accepted proposals or by driver_id
    const acceptedFreightIds = new Set(
      enrichedProposals.filter((p: any) => p.status === "ACCEPTED").map((p: any) => p.freight_id)
    );

    let ongoingFreights = (freights ?? []).filter((f: any) => acceptedFreightIds.has(f.id));

    // Fallback: also include freights where driver_id = driverId (covers manual assignments)
    const { data: driverFreights, error: dfErr } = await supabase
      .from("freights")
      .select(`*, producer:profiles!freights_producer_id_fkey(id,full_name,contact_phone,role)`)
      .eq("driver_id", driverId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (dfErr) {
      console.error("driver-proposals: error fetching driver freights", dfErr);
    }

    // CRITICAL: Include freights via freight_assignments (transportadora scenarios)
    const { data: assignmentData, error: assignErr } = await supabase
      .from("freight_assignments")
      .select(`
        freight:freights!inner(*, producer:profiles!freights_producer_id_fkey(id,full_name,contact_phone,role)),
        status,
        agreed_price,
        accepted_at
      `)
      .eq("driver_id", driverId)
      .in("status", ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"])
      .order("accepted_at", { ascending: false })
      .limit(100);

    if (assignErr) {
      console.error("driver-proposals: error fetching assignment freights", assignErr);
    }

    // Extract freights from assignments and use agreed_price as price if available
    const assignmentFreights = (assignmentData ?? []).map((a: any) => {
      const freight = a.freight;
      if (a.agreed_price) {
        freight.price = a.agreed_price;
      }
      return freight;
    });

    const mergedOngoing = [...ongoingFreights, ...(driverFreights ?? []), ...(assignmentFreights ?? [])];
    // Deduplicate by id and keep the freshest
    const seen = new Set<string>();
    ongoingFreights = mergedOngoing.filter((f: any) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    return new Response(
      JSON.stringify({ success: true, proposals: enrichedProposals, ongoingFreights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("driver-proposals error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
