import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    // Verificar se é admin
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (profile?.role !== "ADMIN") {
      throw new Error("Only admins can use this function");
    }

    // Buscar adiantamentos pendentes com valores suspeitos
    // Heurística: requested_amount < 10000 (R$ 100) e notes contém "percentage"
    const { data: advances, error: fetchError } = await supabaseClient
      .from("freight_advances")
      .select(`
        id,
        requested_amount,
        notes,
        freight_id,
        status,
        freights!inner(price)
      `)
      .eq("status", "PENDING")
      .lt("requested_amount", 10000);

    if (fetchError) throw fetchError;

    const fixed = [];
    const skipped = [];

    for (const advance of advances || []) {
      // Verificar se é um adiantamento por porcentagem com valor errado
      const isPercentage = advance.notes?.includes("percentage");
      const freightPrice = advance.freights?.price || 0;
      
      if (isPercentage && freightPrice > 10000) {
        // Valor parece estar em reais quando deveria estar em centavos
        // Ou foi dividido por 100 erroneamente
        const possibleCorrection = advance.requested_amount * 100;
        
        // Validar se a correção faz sentido (não pode ser maior que o preço do frete)
        if (possibleCorrection <= freightPrice && possibleCorrection >= 100) {
          const { error: updateError } = await supabaseClient
            .from("freight_advances")
            .update({ 
              requested_amount: possibleCorrection,
              notes: `${advance.notes || ''} | FIXED: multiplied by 100 on ${new Date().toISOString()}`
            })
            .eq("id", advance.id);

          if (updateError) {
            console.error(`Failed to fix advance ${advance.id}:`, updateError);
            skipped.push({ id: advance.id, reason: updateError.message });
          } else {
            fixed.push({
              id: advance.id,
              oldAmount: advance.requested_amount,
              newAmount: possibleCorrection,
              oldAmountInReais: advance.requested_amount / 100,
              newAmountInReais: possibleCorrection / 100
            });
            console.log(`Fixed advance ${advance.id}: R$ ${advance.requested_amount / 100} -> R$ ${possibleCorrection / 100}`);
          }
        } else {
          skipped.push({ id: advance.id, reason: "Correction would be invalid" });
        }
      } else {
        skipped.push({ id: advance.id, reason: "Not a percentage advance or value seems correct" });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      fixed: fixed.length,
      skipped: skipped.length,
      details: { fixed, skipped }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in admin-fix-advance-amounts:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
