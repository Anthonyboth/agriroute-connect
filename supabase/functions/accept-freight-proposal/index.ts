import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptProposalRequest {
  proposal_id: string;
  producer_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { proposal_id, producer_id }: AcceptProposalRequest = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Buscar proposta com detalhes do frete
    const { data: proposal, error: proposalErr } = await supabase
      .from("freight_proposals")
      .select(`
        id,
        freight_id,
        driver_id,
        proposed_price,
        status,
        freights!inner(
          id,
          producer_id,
          required_trucks,
          accepted_trucks,
          status,
          distance_km,
          minimum_antt_price,
          cargo_type,
          vehicle_axles_required,
          high_performance
        )
      `)
      .eq("id", proposal_id)
      .single();

    if (proposalErr || !proposal) {
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validar permissão (produtor é dono do frete)
    if (proposal.freights.producer_id !== producer_id) {
      return new Response(
        JSON.stringify({ error: "Apenas o produtor pode aceitar propostas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar se frete ainda tem vagas
    if (proposal.freights.accepted_trucks >= proposal.freights.required_trucks) {
      return new Response(
        JSON.stringify({ error: "Todas as carretas já foram contratadas" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validar valor da proposta
    if (!proposal.proposed_price || proposal.proposed_price <= 0) {
      return new Response(
        JSON.stringify({ error: "Proposta com valor inválido (R$ 0). Peça uma contra-proposta ou rejeite." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validar se motorista já foi contratado
    const { data: existingAssignment } = await supabase
      .from("freight_assignments")
      .select("id")
      .eq("freight_id", proposal.freight_id)
      .eq("driver_id", proposal.driver_id)
      .maybeSingle();

    if (existingAssignment) {
      return new Response(
        JSON.stringify({ error: "Este motorista já foi contratado para este frete" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Validar valor contra ANTT
    if (proposal.proposed_price < (proposal.freights.minimum_antt_price || 0)) {
      return new Response(
        JSON.stringify({ 
          error: "Valor abaixo do mínimo ANTT",
          minimum_antt_price: proposal.freights.minimum_antt_price
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Criar assignment
    const { data: assignment, error: assignmentErr } = await supabase
      .from("freight_assignments")
      .insert({
        freight_id: proposal.freight_id,
        driver_id: proposal.driver_id,
        proposal_id: proposal.id,
        agreed_price: proposal.proposed_price,
        pricing_type: 'FIXED',
        minimum_antt_price: proposal.freights.minimum_antt_price,
        status: 'ACCEPTED'
      })
      .select()
      .single();

    if (assignmentErr) {
      console.error("Error creating assignment:", assignmentErr);
      return new Response(
        JSON.stringify({ error: "Erro ao criar atribuição" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7.5. Vincular motorista ao frete (se carreta única)
    if (proposal.freights.required_trucks === 1) {
      const { error: driverLinkError } = await supabase
        .from("freights")
        .update({ 
          driver_id: proposal.driver_id,
          drivers_assigned: [proposal.driver_id]
        })
        .eq("id", proposal.freight_id)
        .is("driver_id", null);
      
      if (driverLinkError) {
        console.error("[DRIVER-LINK] Failed to link driver to freight:", driverLinkError);
      } else {
        console.log(`[DRIVER-LINK] Successfully linked driver ${proposal.driver_id} to freight ${proposal.freight_id}`);
      }
    }

    // 8. Atualizar status da proposta
    await supabase
      .from("freight_proposals")
      .update({ status: "ACCEPTED" })
      .eq("id", proposal_id);

    // 9. Enviar notificação ao motorista
    await supabase
      .from("notifications")
      .insert({
        user_id: proposal.driver_id,
        title: "Proposta Aceita! 🎉",
        message: `Sua proposta foi aceita! Valor acordado: R$ ${proposal.proposed_price.toLocaleString('pt-BR')}`,
        type: "proposal_accepted",
        data: {
          freight_id: proposal.freight_id,
          assignment_id: assignment.id,
          agreed_price: proposal.proposed_price
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignment,
        remaining_trucks: proposal.freights.required_trucks - (proposal.freights.accepted_trucks + 1)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error accepting proposal:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});