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
  recalculated_accepted_trucks: number;
  fixed_partial_booking_status: number;
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
      recalculated_accepted_trucks: 0,
      fixed_partial_booking_status: 0,
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

    // 4. Calcular distâncias faltantes usando função batch
    try {
      console.log("[AUTO-HEAL] Step 4: Calculating missing distances...");
      
      // Invocar função de cálculo de distâncias em batch
      const { data: distanceResult, error: distanceError } = await supabase.functions.invoke(
        'calculate-freight-distances',
        { body: {} }
      );
      
      if (distanceError) {
        report.errors.push(`Distance calculation error: ${distanceError.message}`);
      } else if (distanceResult) {
        report.routes_calculated = distanceResult.calculated || 0;
        
        if (distanceResult.failed > 0) {
          report.errors.push(`${distanceResult.failed} distance calculations failed`);
        }
        
        if (distanceResult.skipped > 0) {
          report.errors.push(`${distanceResult.skipped} freights skipped (missing coordinates)`);
        }
        
        report.details.push({
          type: "DISTANCE_CALCULATION",
          calculated: distanceResult.calculated,
          failed: distanceResult.failed,
          skipped: distanceResult.skipped,
          total: distanceResult.total,
          details: distanceResult.details || []
        });
      }

      console.log(`[AUTO-HEAL] Calculated ${report.routes_calculated} distances`);
    } catch (error: any) {
      report.errors.push(`Distance calculation failed: ${error.message}`);
    }

    // ================================================
    // 5. RECALCULAR ACCEPTED_TRUCKS PARA TODOS OS FRETES
    // ================================================
    
    console.log("[AUTO-HEAL] Step 5: Recalculating accepted_trucks...");
    
    try {
      // Usar a função RPC que já existe
      const { data: recalcData, error: recalcError } = await supabase.rpc(
        'fix_freight_status_for_partial_bookings'
      );

      if (recalcError) {
        report.errors.push(`Error recalculating: ${recalcError.message}`);
      } else {
        const count = Array.isArray(recalcData) ? recalcData.length : 0;
        report.recalculated_accepted_trucks = count;
        report.details.push({
          type: "ACCEPTED_TRUCKS_RECALCULATED",
          count: count,
          description: "Recalculated accepted_trucks for all freights based on actual assignments"
        });
        
        if (count > 0) {
          report.details.push({
            type: "FREIGHTS_FIXED",
            freights: recalcData
          });
        }
      }
    } catch (err: any) {
      report.errors.push(`Exception recalculating accepted_trucks: ${err.message}`);
    }

    // ================================================
    // 6. AJUSTAR STATUS DE FRETES PARCIALMENTE PREENCHIDOS
    // ================================================
    
    console.log("[AUTO-HEAL] Step 6: Fixing partial booking status...");
    
    try {
      // Buscar fretes com múltiplas carretas parcialmente preenchidos
      const { data: partialFreights, error: partialError } = await supabase
        .from("freights")
        .select("id, status, required_trucks, accepted_trucks")
        .gt("required_trucks", 1)
        .in("status", ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT"]);

      if (partialError) {
        report.errors.push(`Error fetching partial freights: ${partialError.message}`);
      } else if (partialFreights && partialFreights.length > 0) {
        for (const freight of partialFreights) {
          const accepted = freight.accepted_trucks || 0;
          const required = freight.required_trucks || 1;
          
          // Se não preencheu todas as vagas, deve estar OPEN
          if (accepted < required) {
            const { error: statusError } = await supabase
              .from("freights")
              .update({ 
                status: "OPEN",
                updated_at: new Date().toISOString()
              })
              .eq("id", freight.id);

            if (statusError) {
              report.errors.push(`Error fixing status for ${freight.id}: ${statusError.message}`);
            } else {
              report.fixed_partial_booking_status++;
              report.details.push({
                type: "PARTIAL_BOOKING_STATUS_FIXED",
                freight_id: freight.id,
                old_status: freight.status,
                new_status: "OPEN",
                accepted_trucks: accepted,
                required_trucks: required,
                reason: `Partial booking (${accepted}/${required} carretas)`
              });
            }
          }
        }
      }
      
      console.log(`[AUTO-HEAL] Fixed ${report.fixed_partial_booking_status} partial booking statuses`);
    } catch (err: any) {
      report.errors.push(`Exception fixing partial booking status: ${err.message}`);
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
