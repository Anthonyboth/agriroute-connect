import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  console.warn('⚠️ DEPRECATED: accept-freight edge function está obsoleta para múltiplas carretas. Use accept-freight-multiple.');
  
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

    console.warn('⚠️ DEPRECATED: accept-freight edge function está obsoleta para múltiplas carretas. Use accept-freight-multiple.');
    
    const body = await req.json().catch(() => ({}));
    const freightId: string | undefined = body.freight_id;
    // ✅ Captura localização best-effort do aceite
    const locationData = body.location ?? {};
    
    if (!freightId) {
      return new Response(
        JSON.stringify({ error: "freight_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é frete de múltiplas carretas
    const { data: freightCheck, error: checkError } = await supabase
      .from('freights')
      .select('required_trucks')
      .eq('id', freightId)
      .maybeSingle();
    
    if (!checkError && freightCheck && freightCheck.required_trucks > 1) {
      console.error('Tentativa de usar accept-freight para múltiplas carretas:', freightId);
      return new Response(
        JSON.stringify({ 
          error: 'Esta função não suporta fretes com múltiplas carretas. Use accept-freight-multiple.',
          required_trucks: freightCheck.required_trucks
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

// ✅ FASE 1 - CRÍTICO: Validar location_enabled e tracking_consents no backend
const { data: profile, error: profileErr } = await supabase
  .from("profiles")
  .select("id, role, location_enabled, status")
  .eq("user_id", user.id)
  .single();

if (profileErr || !profile || profile.role !== "MOTORISTA") {
  return new Response(JSON.stringify({ error: "Driver profile not found" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ✅ NOVO: Validar location_enabled
if (!profile.location_enabled) {
  return new Response(
    JSON.stringify({ 
      error: "Location must be enabled to accept freights",
      code: "LOCATION_DISABLED"
    }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ✅ NOVO: Validar status de aprovação
if (profile.status !== 'APPROVED') {
  return new Response(
    JSON.stringify({ 
      error: "Profile must be approved to accept freights",
      code: "PROFILE_NOT_APPROVED"
    }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// ✅ NOVO: Verificar consentimento de tracking
const { data: consent } = await supabase
  .from("tracking_consents")
  .select("consent_given")
  .eq("freight_id", freightId)
  .eq("user_id", user.id)
  .maybeSingle();

if (!consent?.consent_given) {
  return new Response(
    JSON.stringify({ 
      error: "Tracking consent required",
      code: "CONSENT_REQUIRED"
    }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

    const driverId: string = profile.id as string;

    // ✅ VALIDAÇÃO: Motorista autônomo só pode ter 1 frete em andamento
    const { data: activeFreights, error: activeFreightsError } = await supabase
      .from("freights")
      .select("id, status, cargo_type")
      .eq("driver_id", driverId)
      .in("status", ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT"]);

    if (activeFreightsError) {
      console.error("Error checking active freights:", activeFreightsError);
      return new Response(
        JSON.stringify({ 
          error: "Unable to verify active freights",
          details: "Please try again in a moment"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Regra atualizada: motoristas podem ter múltiplos fretes ativos
    // (ex: frete rural + pacotes + PET simultaneamente)
    console.log(`[VALIDATION] Driver has ${activeFreights?.length || 0} active freight(s) - multiple allowed`);

    // Fetch freight
    const { data: freight, error: freightFetchErr } = await supabase
      .from("freights")
      .select("id, status, driver_id, price, pricing_type, service_type, origin_address, destination_address, pickup_date, delivery_date, cargo_type, distance_km, minimum_antt_price")
      .eq("id", freightId)
      .single();
    if (freightFetchErr || !freight) {
      return new Response(JSON.stringify({ error: "Freight not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (freight.status !== "OPEN" || freight.driver_id) {
      return new Response(JSON.stringify({ error: "Freight no longer available" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept freight (guard with OPEN to avoid race)
    const { data: updatedFreight, error: updateErr } = await supabase
      .from("freights")
      .update({
        status: "ACCEPTED",
        driver_id: driverId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", freightId)
      .eq("status", "OPEN")
      .select("*")
      .single();

    if (updateErr || !updatedFreight) {
      return new Response(JSON.stringify({ error: "Failed to accept freight" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync proposal
    const { data: existingProposal } = await supabase
      .from("freight_proposals")
      .select("id, status")
      .eq("freight_id", freightId)
      .eq("driver_id", driverId)
      .maybeSingle();

    if (existingProposal && existingProposal.status === "PENDING") {
      await supabase
        .from("freight_proposals")
        .update({ status: "ACCEPTED", message: "Aceito o frete pelo valor anunciado." })
        .eq("id", existingProposal.id);
    } else if (!existingProposal) {
      await supabase
        .from("freight_proposals")
        .insert({
          freight_id: freightId,
          driver_id: driverId,
          proposed_price: freight.price,
          status: "ACCEPTED",
          message: "Aceito o frete pelo valor anunciado.",
        });
    }

    // ✅ PREÇO FECHADO: salvar snapshot imutável do preço acordado
    try {
      const agreedPricingType = freight.pricing_type ?? 'FIXED';
      const agreedUnitRate = freight.price ?? 0;
      
      await supabase
        .from("freight_agreed_prices")
        .insert({
          freight_id: freightId,
          agreed_pricing_type: agreedPricingType,
          agreed_unit_rate: agreedUnitRate,
          agreed_by_user_id: user.id,
          agreed_by_role: 'MOTORISTA',
          agreed_location_lat: locationData.lat ?? null,
          agreed_location_lng: locationData.lng ?? null,
          agreed_location_accuracy_m: locationData.accuracy ?? null,
          agreed_location_source: locationData.source ?? 'unknown',
          agreed_location_error: locationData.error ?? null,
          metadata: {
            original_price: freight.price,
            original_pricing_type: freight.pricing_type,
            distance_km: freight.distance_km,
            minimum_antt_price: freight.minimum_antt_price,
          },
        });
      console.log(`[AGREED_PRICE] Snapshot saved for freight ${freightId}`);
    } catch (agreedErr) {
      // Best effort: don't block the accept if snapshot fails
      console.error("[AGREED_PRICE] Failed to save snapshot:", agreedErr);
    }

    return new Response(
      JSON.stringify({ success: true, freight: updatedFreight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("accept-freight error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
