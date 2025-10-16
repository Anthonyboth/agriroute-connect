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
    console.log("[CHECK-FREIGHT-REQUESTER] Function started");
    
    const { freight_id } = await req.json();
    
    if (!freight_id) {
      return new Response(
        JSON.stringify({ error: "freight_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      console.log("[CHECK-FREIGHT-REQUESTER] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CHECK-FREIGHT-REQUESTER] Checking freight ${freight_id} for user ${user.id}`);

    // Buscar frete com produtor
    const { data: freight, error: freightError } = await supabase
      .from("freights")
      .select(`
        id,
        status,
        producer_id,
        producer:profiles!producer_id (
          id,
          user_id,
          full_name,
          status
        )
      `)
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      console.error(`[CHECK-FREIGHT-REQUESTER] Freight not found - ${freightError?.message}`);
      return new Response(
        JSON.stringify({ error: "Frete não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const producer = freight.producer as any;
    
    // Verificar se o produtor tem cadastro (user_id preenchido)
    const hasRegistration = producer?.user_id != null;
    
    console.log(`[CHECK-FREIGHT-REQUESTER] Producer check - {${JSON.stringify({
      freight_id,
      producer_id: freight.producer_id,
      has_user_id: !!producer?.user_id,
      has_registration: hasRegistration
    })}}`);

    if (!hasRegistration) {
      // Produtor sem cadastro: mover frete para histórico
      console.log(`[CHECK-FREIGHT-REQUESTER] Producer without registration - moving to history`);
      
      const { error: updateError } = await supabase
        .from("freights")
        .update({
          status: "CANCELLED",
          metadata: {
            history_only: true,
            cancellation_reason: "REQUESTER_WITHOUT_REGISTRATION",
            flagged_by: "check-freight-requester",
            flagged_at: new Date().toISOString()
          }
        })
        .eq("id", freight_id);

      if (updateError) {
        console.error(`[CHECK-FREIGHT-REQUESTER] Failed to update freight - ${updateError.message}`);
        return new Response(
          JSON.stringify({ error: "Erro ao processar verificação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[CHECK-FREIGHT-REQUESTER] Freight ${freight_id} moved to history`);

      return new Response(
        JSON.stringify({
          has_registration: false,
          action: "history",
          updated_status: "CANCELLED",
          reason: "O solicitante não possui cadastro completo"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Produtor com cadastro: tudo OK
    console.log(`[CHECK-FREIGHT-REQUESTER] Producer has valid registration`);
    
    return new Response(
      JSON.stringify({
        has_registration: true,
        action: "keep_active",
        producer_status: producer.status
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[CHECK-FREIGHT-REQUESTER] Fatal error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro inesperado",
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
