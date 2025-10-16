import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealReport {
  fixed_moto_prices: number;
  fixed_moto_proposals: number;
  flagged_per_km: number;
  routes_calculated: number;
  errors: string[];
  details: any[];
}

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
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const report: HealReport = {
      fixed_moto_prices: 0,
      fixed_moto_proposals: 0,
      flagged_per_km: 0,
      routes_calculated: 0,
      errors: [],
      details: []
    };

    console.log("[AUTO-HEAL] Starting automatic corrections...");

    // 1. Corrigir FRETE_MOTO com preço < R$10
    try {
      const { data: invalidMotoFreights, error: fetchError } = await supabase
        .from("freights")
        .select("id, price, service_type, status")
        .eq("service_type", "FRETE_MOTO")
        .or("price.is.null,price.lt.10")
        .in("status", ["OPEN", "IN_NEGOTIATION"]);

      if (fetchError) throw fetchError;

      if (invalidMotoFreights && invalidMotoFreights.length > 0) {
        for (const freight of invalidMotoFreights) {
          const { error: updateError } = await supabase
            .from("freights")
            .update({ 
              price: 10,
              metadata: {
                auto_corrected: true,
                original_price: freight.price,
                corrected_at: new Date().toISOString(),
                reason: "FRETE_MOTO minimum is R$10"
              }
            })
            .eq("id", freight.id);

          if (updateError) {
            report.errors.push(`Failed to fix freight ${freight.id}: ${updateError.message}`);
          } else {
            report.fixed_moto_prices++;
            report.details.push({
              type: "FREIGHT_MOTO_PRICE_FIX",
              freight_id: freight.id,
              old_price: freight.price,
              new_price: 10
            });
          }
        }
      }

      console.log(`[AUTO-HEAL] Fixed ${report.fixed_moto_prices} FRETE_MOTO prices`);
    } catch (error: any) {
      report.errors.push(`FRETE_MOTO correction failed: ${error.message}`);
    }

    // 2. Corrigir propostas de FRETE_MOTO com valor < R$10
    try {
      const { data: invalidProposals, error: fetchError } = await supabase
        .from("freight_proposals")
        .select("id, freight_id, proposed_price, freights!inner(service_type)")
        .eq("freights.service_type", "FRETE_MOTO")
        .lt("proposed_price", 10)
        .eq("status", "PENDING");

      if (fetchError) throw fetchError;

      if (invalidProposals && invalidProposals.length > 0) {
        for (const proposal of invalidProposals) {
          const { error: updateError } = await supabase
            .from("freight_proposals")
            .update({ 
              proposed_price: 10,
              metadata: {
                auto_corrected: true,
                original_price: proposal.proposed_price,
                corrected_at: new Date().toISOString(),
                reason: "FRETE_MOTO minimum is R$10"
              }
            })
            .eq("id", proposal.id);

          if (updateError) {
            report.errors.push(`Failed to fix proposal ${proposal.id}: ${updateError.message}`);
          } else {
            report.fixed_moto_proposals++;
            report.details.push({
              type: "PROPOSAL_MOTO_PRICE_FIX",
              proposal_id: proposal.id,
              freight_id: proposal.freight_id,
              old_price: proposal.proposed_price,
              new_price: 10
            });
          }
        }
      }

      console.log(`[AUTO-HEAL] Fixed ${report.fixed_moto_proposals} FRETE_MOTO proposals`);
    } catch (error: any) {
      report.errors.push(`FRETE_MOTO proposals correction failed: ${error.message}`);
    }

    // 3. Sinalizar propostas "por KM" quando distance_km é nula
    try {
      const { data: invalidPerKmProposals, error: fetchError } = await supabase
        .from("freight_proposals")
        .select("id, freight_id, proposed_price, pricing_type, freights!inner(distance_km)")
        .eq("pricing_type", "PER_KM")
        .is("freights.distance_km", null)
        .eq("status", "PENDING");

      if (fetchError) throw fetchError;

      if (invalidPerKmProposals && invalidPerKmProposals.length > 0) {
        for (const proposal of invalidPerKmProposals) {
          const { error: updateError } = await supabase
            .from("freight_proposals")
            .update({ 
              metadata: {
                invalid_per_km: true,
                reason: "no_distance",
                flagged_at: new Date().toISOString(),
                action_required: "Driver must resubmit as FIXED pricing"
              }
            })
            .eq("id", proposal.id);

          if (updateError) {
            report.errors.push(`Failed to flag proposal ${proposal.id}: ${updateError.message}`);
          } else {
            report.flagged_per_km++;
            report.details.push({
              type: "PER_KM_FLAGGED",
              proposal_id: proposal.id,
              freight_id: proposal.freight_id
            });
          }
        }
      }

      console.log(`[AUTO-HEAL] Flagged ${report.flagged_per_km} invalid PER_KM proposals`);
    } catch (error: any) {
      report.errors.push(`PER_KM flagging failed: ${error.message}`);
    }

    // 4. Calcular distâncias faltantes (limitado a 10 para evitar timeout)
    try {
      const { data: freightsWithoutDistance, error: fetchError } = await supabase
        .from("freights")
        .select("id, origin_lat, origin_lng, destination_lat, destination_lng")
        .is("distance_km", null)
        .not("origin_lat", "is", null)
        .not("destination_lat", "is", null)
        .in("status", ["OPEN", "IN_NEGOTIATION"])
        .limit(10);

      if (fetchError) throw fetchError;

      if (freightsWithoutDistance && freightsWithoutDistance.length > 0) {
        for (const freight of freightsWithoutDistance) {
          try {
            const { data: routeData, error: routeError } = await supabase.functions.invoke(
              "calculate-route",
              {
                body: {
                  origin: { lat: freight.origin_lat, lng: freight.origin_lng },
                  destination: { lat: freight.destination_lat, lng: freight.destination_lng }
                }
              }
            );

            if (routeError || !routeData?.distance_km) {
              // Marcar como necessitando distância manual
              await supabase
                .from("freights")
                .update({ 
                  metadata: {
                    needs_distance: true,
                    route_calculation_failed: true,
                    flagged_at: new Date().toISOString()
                  }
                })
                .eq("id", freight.id);
              
              report.errors.push(`Route calculation failed for freight ${freight.id}`);
            } else {
              await supabase
                .from("freights")
                .update({ 
                  distance_km: routeData.distance_km,
                  metadata: {
                    distance_auto_calculated: true,
                    calculated_at: new Date().toISOString()
                  }
                })
                .eq("id", freight.id);
              
              report.routes_calculated++;
              report.details.push({
                type: "DISTANCE_CALCULATED",
                freight_id: freight.id,
                distance_km: routeData.distance_km
              });
            }
          } catch (error: any) {
            report.errors.push(`Route calc error for freight ${freight.id}: ${error.message}`);
          }
        }
      }

      console.log(`[AUTO-HEAL] Calculated ${report.routes_calculated} distances`);
    } catch (error: any) {
      report.errors.push(`Distance calculation failed: ${error.message}`);
    }

    console.log("[AUTO-HEAL] Corrections complete", report);

    return new Response(
      JSON.stringify({ 
        success: true,
        report,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in admin-auto-heal:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
