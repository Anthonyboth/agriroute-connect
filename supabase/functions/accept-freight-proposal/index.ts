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

function normalizeBrazilStateUF(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Already UF
  if (raw.length === 2) return raw.toUpperCase();

  // Remove accents for matching
  const key = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const map: Record<string, string> = {
    'acre': 'AC',
    'alagoas': 'AL',
    'amapa': 'AP',
    'amazonas': 'AM',
    'bahia': 'BA',
    'ceara': 'CE',
    'distrito federal': 'DF',
    'espirito santo': 'ES',
    'goias': 'GO',
    'maranhao': 'MA',
    'mato grosso': 'MT',
    'mato grosso do sul': 'MS',
    'minas gerais': 'MG',
    'para': 'PA',
    'paraiba': 'PB',
    'parana': 'PR',
    'pernambuco': 'PE',
    'piaui': 'PI',
    'rio de janeiro': 'RJ',
    'rio grande do norte': 'RN',
    'rio grande do sul': 'RS',
    'rondonia': 'RO',
    'roraima': 'RR',
    'santa catarina': 'SC',
    'sao paulo': 'SP',
    'sergipe': 'SE',
    'tocantins': 'TO'
  };

  return map[key] ?? null;
}

/**
 * Calcula uma data de coleta segura (sempre no futuro)
 * Retorna no formato YYYY-MM-DD para evitar problemas de timezone
 */
function getSafePickupDate(originalPickup: string | null): { date: string; wasAdjusted: boolean } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (!originalPickup) {
    return { 
      date: tomorrow.toISOString().split('T')[0], 
      wasAdjusted: true 
    };
  }
  
  // Parse a data original (formato YYYY-MM-DD ou ISO)
  const pickupDate = new Date(originalPickup);
  const pickupDateOnly = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate());
  
  if (pickupDateOnly < today) {
    // Data no passado, usar amanhã
    return { 
      date: tomorrow.toISOString().split('T')[0], 
      wasAdjusted: true 
    };
  }
  
  // Data válida, retornar no formato correto
  return { 
    date: pickupDateOnly.toISOString().split('T')[0], 
    wasAdjusted: false 
  };
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
          high_performance,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          pickup_date,
          delivery_date
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
      accepted_trucks: freight.accepted_trucks,
      original_pickup_date: freight.pickup_date
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

    // 5. Validar se motorista já tem algum frete EM ANDAMENTO (não bloqueia "ACCEPTED")
    const { data: activeFreights, count } = await supabase
      .from("freight_assignments")
      .select("id, freight_id, status", { count: 'exact' })
      .eq("driver_id", proposal.driver_id)
      .in("status", ["IN_PROGRESS", "LOADING", "LOADED", "IN_TRANSIT"]);

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

    // 6. Calcular pickup_date seguro (DEVE ser no futuro, formato YYYY-MM-DD)
    const { date: safePickupDate, wasAdjusted: pickupWasAdjusted } = getSafePickupDate(freight.pickup_date);
    
    console.log('[PICKUP-DATE-CALC]', { 
      original: freight.pickup_date, 
      safe: safePickupDate, 
      wasAdjusted: pickupWasAdjusted 
    });

    // 6.1 SE a data foi ajustada, ATUALIZAR O FRETE PRIMEIRO (antes de criar assignment)
    if (pickupWasAdjusted) {
      console.log('[PICKUP-DATE-FIX] Updating freight pickup_date BEFORE creating assignment');
      
      // Calcular delivery_date ajustada também
      let safeDeliveryDate = safePickupDate;
      if (freight.delivery_date) {
        const originalPickup = new Date(freight.pickup_date || safePickupDate);
        const originalDelivery = new Date(freight.delivery_date);
        const daysDiff = Math.ceil((originalDelivery.getTime() - originalPickup.getTime()) / (1000 * 60 * 60 * 24));
        
        const newDelivery = new Date(safePickupDate);
        newDelivery.setDate(newDelivery.getDate() + Math.max(0, daysDiff));
        safeDeliveryDate = newDelivery.toISOString().split('T')[0];
      }
      
      // Also normalize state fields (some older freights store full state name like "Mato Grosso",
      // and a DB trigger tries to upsert cities with a UF constraint.)
      const originUF = normalizeBrazilStateUF((freight as any)?.origin_state);
      const destinationUF = normalizeBrazilStateUF((freight as any)?.destination_state);

      const updatePayload: Record<string, unknown> = {
        pickup_date: safePickupDate,
        delivery_date: safeDeliveryDate,
      };

      // Only overwrite if we can confidently map to UF
      if (originUF) updatePayload.origin_state = originUF;
      if (destinationUF) updatePayload.destination_state = destinationUF;

      const { error: freightUpdateErr } = await supabase
        .from('freights')
        .update(updatePayload)
        .eq('id', proposal.freight_id);

      if (freightUpdateErr) {
        console.error('[PICKUP-DATE-FIX] Failed to update freight dates:', freightUpdateErr);
        // Continuar mesmo com erro, tentar assignment
      } else {
        console.log('[PICKUP-DATE-FIX] Freight dates updated successfully:', {
          pickup_date: safePickupDate,
          delivery_date: safeDeliveryDate,
          origin_state: originUF ?? (freight as any)?.origin_state,
          destination_state: destinationUF ?? (freight as any)?.destination_state
        });
      }
    }

    // 7. Validar ANTT (não-bloqueante, apenas informativo)
    const requiredTrucks = Math.max(1, Number(freight.required_trucks) || 1);
    const minAnttTotal = freight.minimum_antt_price ?? null;
    const minAnttPerTruck = minAnttTotal != null ? Number(minAnttTotal) / requiredTrucks : null;
    const belowAntt = minAnttPerTruck != null && proposal.proposed_price < minAnttPerTruck;
    
    console.log('[ANTT-CHECK] Validation (non-blocking):', {
      proposed_price: proposal.proposed_price,
      minimum_antt_price_total: minAnttTotal,
      required_trucks: requiredTrucks,
      minimum_antt_price_per_truck: minAnttPerTruck,
      below_antt_minimum: belowAntt
    });

    // 8. Criar ou atualizar assignment (idempotente)
    // Primeiro, verificar se já existe assignment para este (freight_id, driver_id)
    const { data: existingAssignment } = await supabase
      .from("freight_assignments")
      .select("id, status, agreed_price, minimum_antt_price")
      .eq("freight_id", proposal.freight_id)
      .eq("driver_id", proposal.driver_id)
      .single();

    let assignment;
    let isNewAssignment = false;

    if (existingAssignment) {
      console.log('[ASSIGNMENT] Existing assignment found, updating:', existingAssignment.id);
      
      // Atualizar assignment existente
      const { data: updatedAssignment, error: updateErr } = await supabase
        .from("freight_assignments")
        .update({
          status: 'ACCEPTED',
          proposal_id: proposal.id,
          agreed_price: proposal.proposed_price,
          pricing_type: 'FIXED',
          minimum_antt_price: minAnttPerTruck,
          pickup_date: safePickupDate // Usar formato YYYY-MM-DD
        })
        .eq("id", existingAssignment.id)
        .select()
        .single();

      if (updateErr) {
        console.error("[ASSIGNMENT-UPDATE] Error:", updateErr);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao atualizar atribuição',
            details: updateErr.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      assignment = updatedAssignment;
    } else {
      console.log('[ASSIGNMENT] No existing assignment, creating new one');
      
      // Criar novo assignment com data segura (formato YYYY-MM-DD)
      const { data: newAssignment, error: insertErr } = await supabase
        .from("freight_assignments")
        .insert({
          freight_id: proposal.freight_id,
          driver_id: proposal.driver_id,
          proposal_id: proposal.id,
          agreed_price: proposal.proposed_price,
          pricing_type: 'FIXED',
          minimum_antt_price: minAnttPerTruck,
          status: 'ACCEPTED',
          pickup_date: safePickupDate, // Usar formato YYYY-MM-DD
          notes: pickupWasAdjusted 
            ? `Data de coleta ajustada automaticamente para ${safePickupDate} (data original no passado)` 
            : null,
          metadata: {
            original_pickup_date: freight.pickup_date,
            pickup_was_adjusted: pickupWasAdjusted,
            accepted_via: 'accept-freight-proposal',
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (insertErr) {
        console.error("[ASSIGNMENT-INSERT] Error:", insertErr);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao criar atribuição',
            details: insertErr.message,
            hint: pickupWasAdjusted 
              ? 'A data de coleta estava no passado. Por favor, tente novamente.' 
              : undefined
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      assignment = newAssignment;
      isNewAssignment = true;

      // Incrementar accepted_trucks APENAS se for um novo assignment
      const { error: updateFreightErr } = await supabase
        .from("freights")
        .update({ accepted_trucks: freight.accepted_trucks + 1 })
        .eq("id", proposal.freight_id);

      if (updateFreightErr) {
        console.error("[FREIGHT-UPDATE] Error incrementing accepted_trucks:", updateFreightErr);
      }
    }

    // 9. Vincular motorista ao frete (se carreta única)
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

    // 10. Atualizar status da proposta
    await supabase
      .from("freight_proposals")
      .update({ status: "ACCEPTED" })
      .eq("id", proposal_id);

    // 11. Enviar notificação ao motorista
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
    
    // Calcular accepted_trucks correto (com ou sem incremento)
    const nextAcceptedTrucks = isNewAssignment ? freight.accepted_trucks + 1 : freight.accepted_trucks;
    const remainingTrucks = freight.required_trucks - nextAcceptedTrucks;
    
    console.log('[ACCEPT-PROPOSAL] Success! Response time:', responseTime + 'ms');
    console.log('[ACCEPT-PROPOSAL] Assignment details:', {
      assignment_id: assignment.id,
      freight_id: proposal.freight_id,
      driver_id: proposal.driver_id,
      agreed_price: assignment.agreed_price,
      is_new_assignment: isNewAssignment,
      accepted_trucks: nextAcceptedTrucks,
      remaining_trucks: remainingTrucks,
      pickup_date_used: safePickupDate,
      pickup_was_adjusted: pickupWasAdjusted
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignment: {
          id: assignment.id,
          freight_id: assignment.freight_id,
          driver_id: assignment.driver_id,
          agreed_price: assignment.agreed_price,
          status: assignment.status,
          pickup_date: safePickupDate
        },
        freight: {
          id: proposal.freight_id,
          required_trucks: freight.required_trucks,
          accepted_trucks: nextAcceptedTrucks,
          remaining_trucks: remainingTrucks
        },
        below_antt_minimum: belowAntt,
        minimum_antt_price_per_truck: minAnttPerTruck,
        minimum_antt_price_total: minAnttTotal,
        pickup_was_adjusted: pickupWasAdjusted,
        message: isNewAssignment 
          ? (remainingTrucks > 0
              ? `Proposta aceita! Ainda faltam ${remainingTrucks} carretas.`
              : 'Proposta aceita! Todas as carretas foram contratadas.')
          : 'Proposta já estava aceita. Sincronizado com sucesso.'
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
