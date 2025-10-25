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

  const requestStartTime = Date.now();
  console.log('[ACCEPT-PROPOSAL] Request started');

  try {
    const { proposal_id, producer_id }: AcceptProposalRequest = await req.json();
    console.log('[ACCEPT-PROPOSAL] Request data:', { proposal_id, producer_id });
    
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
      console.error('[ACCEPT-PROPOSAL] Proposal not found:', { proposal_id, proposalErr });
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cast freights to single object (Supabase returns array for joins)
    const freight = Array.isArray(proposal.freights) ? proposal.freights[0] : proposal.freights;

    console.log('[ACCEPT-PROPOSAL] Proposal found:', {
      proposal_id: proposal.id,
      freight_id: proposal.freight_id,
      driver_id: proposal.driver_id,
      proposed_price: proposal.proposed_price,
      freight_status: freight.status,
      required_trucks: freight.required_trucks,
      accepted_trucks: freight.accepted_trucks
    });

    // 2. Validar permissão (produtor é dono do frete)
    if (freight.producer_id !== producer_id) {
      return new Response(
        JSON.stringify({ error: "Apenas o produtor pode aceitar propostas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar se frete ainda tem vagas
    if (freight.accepted_trucks >= freight.required_trucks) {
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

    // 5. Validar se motorista já tem algum frete EM ANDAMENTO
    const { data: activeFreights, count } = await supabase
      .from("freight_assignments")
      .select("id, freight_id, status", { count: 'exact' })
      .eq("driver_id", proposal.driver_id)
      .in("status", ["ACCEPTED", "IN_PROGRESS", "LOADING", "LOADED", "IN_TRANSIT"]);

    if (count && count > 0) {
      console.log('[VALIDATION-FAILED] Driver has active freight(s):', {
        driver_id: proposal.driver_id,
        active_count: count,
        active_freights: activeFreights?.map(f => ({ id: f.freight_id, status: f.status }))
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Você já tem um frete em andamento. Conclua-o antes de aceitar outro.",
          active_freight_count: count
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[VALIDATION-PASSED] Driver has no active freights, can accept proposal');

    // 6. Validar valor contra ANTT
    if (proposal.proposed_price < (freight.minimum_antt_price || 0)) {
      return new Response(
        JSON.stringify({ 
          error: "Valor abaixo do mínimo ANTT",
          minimum_antt_price: freight.minimum_antt_price
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
        minimum_antt_price: freight.minimum_antt_price,
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
    if (freight.required_trucks === 1) {
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

    const responseTime = Date.now() - requestStartTime;
    console.log('[ACCEPT-PROPOSAL] Success! Response time:', responseTime + 'ms');
    console.log('[ACCEPT-PROPOSAL] Assignment created:', {
      assignment_id: assignment.id,
      freight_id: proposal.freight_id,
      driver_id: proposal.driver_id,
      agreed_price: assignment.agreed_price,
      remaining_trucks: proposal.freights.required_trucks - (proposal.freights.accepted_trucks + 1)
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignment: {
          id: assignment.id,
          freight_id: assignment.freight_id,
          driver_id: assignment.driver_id,
          agreed_price: assignment.agreed_price,
          status: assignment.status
        },
        freight: {
          id: proposal.freight_id,
          required_trucks: freight.required_trucks,
          accepted_trucks: freight.accepted_trucks + 1,
          remaining_trucks: freight.required_trucks - (freight.accepted_trucks + 1)
        },
        message: freight.required_trucks - (freight.accepted_trucks + 1) > 0
          ? `Proposta aceita! Ainda faltam ${freight.required_trucks - (freight.accepted_trucks + 1)} carretas.`
          : 'Proposta aceita! Todas as carretas foram contratadas.'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const responseTime = Date.now() - requestStartTime;
    console.error("[ACCEPT-PROPOSAL] Error after", responseTime + "ms:", error);
    console.error("[ACCEPT-PROPOSAL] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: "Erro ao aceitar proposta", 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});