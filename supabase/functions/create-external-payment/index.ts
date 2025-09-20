import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EXTERNAL-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const { freight_id, amount, notes } = await req.json();
    if (!freight_id) throw new Error("freight_id is required");
    if (!amount || amount <= 0) throw new Error("amount must be greater than 0");

    // Buscar frete e verificar permissões
    const { data: freight, error: freightError } = await supabaseClient
      .from("freights")
      .select(`
        id, price, producer_id, driver_id, status,
        producer:profiles!freights_producer_id_fkey(id, user_id),
        driver:profiles!freights_driver_id_fkey(id, user_id)
      `)
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      throw new Error("Freight not found");
    }

    // Verificar se o usuário é o produtor
    if (freight.producer?.user_id !== user.id) {
      throw new Error("Unauthorized to propose payment for this freight");
    }

    if (!freight.driver_id) {
      throw new Error("Freight must have an assigned driver");
    }

    if (freight.status !== 'DELIVERED_PENDING_CONFIRMATION' && freight.status !== 'COMPLETED') {
      throw new Error("Freight must be delivered to propose external payment");
    }

    logStep("Freight verified", { freightId: freight.id, driverId: freight.driver_id });

    // Verificar se já existe proposta pendente
    const { data: existingProposal } = await supabaseClient
      .from("external_payments")
      .select("id")
      .eq("freight_id", freight_id)
      .in("status", ["proposed", "accepted"]);

    if (existingProposal && existingProposal.length > 0) {
      throw new Error("There is already a pending external payment proposal for this freight");
    }

    // Criar proposta de pagamento externo
    const { data: externalPayment, error: paymentError } = await supabaseClient
      .from("external_payments")
      .insert({
        freight_id,
        producer_id: freight.producer_id,
        driver_id: freight.driver_id,
        amount,
        notes,
        status: 'proposed'
      })
      .select()
      .single();

    if (paymentError || !externalPayment) {
      logStep("Error creating external payment proposal", { error: paymentError });
      throw new Error("Failed to create external payment proposal");
    }

    // Notificar motorista
    await supabaseClient
      .from("notifications")
      .insert({
        user_id: freight.driver_id,
        title: "Nova Proposta de Pagamento Externo",
        message: `O produtor propôs um pagamento externo de R$ ${amount.toFixed(2)} para o frete ${freight.id.substring(0, 8)}. Você precisa aceitar ou rejeitar esta proposta.`,
        type: "external_payment_proposal",
        data: {
          external_payment_id: externalPayment.id,
          freight_id: freight_id,
          amount: amount
        }
      });

    logStep("External payment proposal created", { 
      proposalId: externalPayment.id,
      amount: amount 
    });

    return new Response(JSON.stringify({
      external_payment_id: externalPayment.id,
      status: "proposed",
      message: "External payment proposal sent to driver"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-external-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});