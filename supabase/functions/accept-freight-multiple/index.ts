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
    const { freight_id, num_trucks = 1 } = await req.json();
    
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

    // 1. Buscar perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const isTransportCompany = profile?.role === 'TRANSPORTADORA';

    // 2. Buscar frete
    const { data: freight } = await supabase
      .from("freights")
      .select("*")
      .eq("id", freight_id)
      .single();

    if (!freight || freight.status !== "OPEN") {
      return new Response(
        JSON.stringify({ error: "Freight not available" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar vagas disponíveis
    const availableSlots = freight.required_trucks - freight.accepted_trucks;
    if (availableSlots < num_trucks) {
      return new Response(
        JSON.stringify({ error: `Only ${availableSlots} slots available` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. ÚNICA VALIDAÇÃO: Motorista individual só pode aceitar 1 carreta
    if (!isTransportCompany && num_trucks > 1) {
      return new Response(
        JSON.stringify({ error: "Individual drivers can only accept 1 truck per freight" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verificar se motorista já tem assignment ativo para esse frete
    const { data: activeAssignments } = await supabase
      .from("freight_assignments")
      .select("id, status")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .in("status", ["ACCEPTED", "IN_TRANSIT", "LOADING", "LOADED"]);

    if (activeAssignments && activeAssignments.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Você já tem uma carreta em andamento para este frete. Complete a entrega atual primeiro." 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Verificar se tem DELIVERED sem avaliação
    const { data: deliveredAssignments } = await supabase
      .from("freight_assignments")
      .select("id")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .eq("status", "DELIVERED");

    let isReAcceptance = false;
    if (deliveredAssignments && deliveredAssignments.length > 0) {
      // Verificar se já avaliou o produtor
      const { data: rating } = await supabase
        .from("freight_ratings")
        .select("id")
        .eq("freight_id", freight_id)
        .eq("rater_id", profile.id)
        .eq("rating_type", "DRIVER_TO_PRODUCER")
        .maybeSingle();

      if (!rating) {
        return new Response(
          JSON.stringify({ 
            error: "Complete a avaliação da entrega anterior antes de aceitar novamente este frete." 
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      isReAcceptance = true;
      console.log(`✅ Re-aceitação permitida: Motorista ${profile.id} já completou e avaliou`);
    }

    // 5. Buscar company_id se transportadora
    let company_id = null;
    if (isTransportCompany) {
      const { data: company } = await supabase
        .from("transport_companies")
        .select("id")
        .eq("profile_id", profile.id)
        .single();
      company_id = company?.id;
    }

    // 6. Criar assignments
    const assignments = [];
    const pricePerTruck = freight.price; // Cada carreta recebe o valor integral
    
    for (let i = 0; i < num_trucks; i++) {
      const { data: assignment, error } = await supabase
        .from("freight_assignments")
        .insert({
          freight_id,
          driver_id: profile.id,
          company_id,
          agreed_price: pricePerTruck,
          pricing_type: 'FIXED',
          status: 'ACCEPTED'
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating assignment:", error);
        // Rollback
        if (assignments.length > 0) {
          await supabase
            .from("freight_assignments")
            .delete()
            .in("id", assignments.map(a => a.id));
        }
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      assignments.push(assignment);
    }

    // 7. Notificar produtor (com mensagem especial para re-aceitações)
    const remainingSlots = availableSlots - num_trucks;
    await supabase.from("notifications").insert({
      user_id: freight.producer_id,
      title: isReAcceptance 
        ? `🌟 Motorista retornou para mais ${num_trucks} carreta(s)!`
        : (isTransportCompany 
            ? `Transportadora aceitou ${num_trucks} carretas! 🚚`
            : "Motorista aceitou seu frete! 🎉"),
      message: isReAcceptance
        ? `Um motorista que já completou com sucesso uma entrega aceitou mais ${num_trucks} carreta(s). ${remainingSlots} vaga(s) restante(s).`
        : (remainingSlots > 0
            ? `${num_trucks} carreta(s) aceita(s). ${remainingSlots} vaga(s) restante(s).`
            : "Todas as carretas foram preenchidas!"),
      type: "freight_accepted",
      data: { 
        freight_id, 
        num_trucks, 
        is_company: isTransportCompany,
        is_re_acceptance: isReAcceptance 
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignments,
        remaining_slots: remainingSlots
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in accept-freight-multiple:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
