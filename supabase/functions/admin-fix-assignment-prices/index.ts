import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Verificar autenticação e permissão de admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "ADMIN") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { freight_id, hours = 24 } = await req.json();

    console.log(`[ADMIN-FIX-PRICES] Starting price fix - freight_id: ${freight_id}, hours: ${hours}`);

    // Buscar assignments problemáticos
    let query = supabase
      .from("freight_assignments")
      .select(`
        id,
        freight_id,
        agreed_price,
        freights!inner (
          id,
          price,
          required_trucks
        )
      `);

    if (freight_id) {
      query = query.eq("freight_id", freight_id);
    } else {
      // Buscar assignments das últimas N horas
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);
      query = query.gte("created_at", cutoffDate.toISOString());
    }

    const { data: assignments, error: fetchError } = await query;

    if (fetchError) {
      console.error("[ADMIN-FIX-PRICES] Error fetching assignments:", fetchError);
      throw fetchError;
    }

    console.log(`[ADMIN-FIX-PRICES] Found ${assignments?.length || 0} assignments to analyze`);

    const fixes: any[] = [];
    const skipped: any[] = [];

    for (const assignment of assignments || []) {
      const freight = Array.isArray(assignment.freights) 
        ? assignment.freights[0] 
        : assignment.freights;

      if (!freight) continue;

      // Calcular o preço que foi usado (dividido)
      const incorrectPrice = freight.price / freight.required_trucks;
      const correctPrice = freight.price;

      // Tolerância de 1 centavo para comparação
      const tolerance = 0.01;
      const isDivided = Math.abs(assignment.agreed_price - incorrectPrice) < tolerance;

      if (isDivided && assignment.agreed_price < correctPrice) {
        // Este assignment tem o bug - corrigir
        const { error: updateError } = await supabase
          .from("freight_assignments")
          .update({ 
            agreed_price: correctPrice,
            metadata: {
              ...(assignment.metadata || {}),
              price_corrected_at: new Date().toISOString(),
              original_agreed_price: assignment.agreed_price
            }
          })
          .eq("id", assignment.id);

        if (updateError) {
          console.error(`[ADMIN-FIX-PRICES] Error fixing assignment ${assignment.id}:`, updateError);
          skipped.push({
            assignment_id: assignment.id,
            freight_id: assignment.freight_id,
            reason: updateError.message
          });
        } else {
          fixes.push({
            assignment_id: assignment.id,
            freight_id: assignment.freight_id,
            old_price: assignment.agreed_price,
            new_price: correctPrice,
            difference: correctPrice - assignment.agreed_price
          });
          console.log(`[ADMIN-FIX-PRICES] Fixed assignment ${assignment.id}: ${assignment.agreed_price} -> ${correctPrice}`);
        }
      } else {
        skipped.push({
          assignment_id: assignment.id,
          freight_id: assignment.freight_id,
          reason: "Price already correct or not divided"
        });
      }
    }

    console.log(`[ADMIN-FIX-PRICES] Completed - Fixed: ${fixes.length}, Skipped: ${skipped.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_analyzed: assignments?.length || 0,
          fixed: fixes.length,
          skipped: skipped.length
        },
        fixes,
        skipped
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ADMIN-FIX-PRICES] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
