import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESPOND-EXTERNAL-PAYMENT] ${step}${detailsStr}`);
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

    const { external_payment_id, accept, confirmation_doc } = await req.json();
    if (!external_payment_id) throw new Error("external_payment_id is required");
    if (typeof accept !== "boolean") throw new Error("accept must be true or false");

    // Buscar proposta de pagamento
    const { data: externalPayment, error: paymentError } = await supabaseClient
      .from("external_payments")
      .select(`
        *,
        driver:profiles!external_payments_driver_id_fkey(id, user_id),
        producer:profiles!external_payments_producer_id_fkey(id, user_id)
      `)
      .eq("id", external_payment_id)
      .single();

    if (paymentError || !externalPayment) {
      throw new Error("External payment proposal not found");
    }

    // Verificar se o usuário é o motorista
    if (externalPayment.driver?.user_id !== user.id) {
      throw new Error("Unauthorized to respond to this payment proposal");
    }

    if (externalPayment.status !== 'proposed') {
      throw new Error("Payment proposal has already been responded to");
    }

    logStep("External payment verified", { paymentId: external_payment_id, accept });

    const newStatus = accept ? 'accepted' : 'rejected';
    const updateData: any = {
      status: newStatus,
      accepted_by_driver: accept,
    };

    if (accept) {
      updateData.accepted_at = new Date().toISOString();
      if (confirmation_doc) {
        updateData.confirmation_doc = confirmation_doc;
        updateData.confirmed_at = new Date().toISOString();
        updateData.status = 'confirmed';
      }
    }

    // Atualizar proposta
    const { error: updateError } = await supabaseClient
      .from("external_payments")
      .update(updateData)
      .eq("id", external_payment_id);

    if (updateError) {
      logStep("Error updating external payment", { error: updateError });
      throw new Error("Failed to update external payment proposal");
    }

    // Notificar produtor
    const notificationTitle = accept ? 
      (confirmation_doc ? "Pagamento Externo Confirmado" : "Pagamento Externo Aceito") :
      "Pagamento Externo Rejeitado";
    
    const notificationMessage = accept ?
      (confirmation_doc ? 
        `O motorista confirmou o recebimento do pagamento externo de R$ ${externalPayment.amount.toFixed(2)} com comprovante.` :
        `O motorista aceitou sua proposta de pagamento externo de R$ ${externalPayment.amount.toFixed(2)}. Aguarde o comprovante.`) :
      `O motorista rejeitou sua proposta de pagamento externo de R$ ${externalPayment.amount.toFixed(2)}.`;

    await supabaseClient
      .from("notifications")
      .insert({
        user_id: externalPayment.producer_id,
        title: notificationTitle,
        message: notificationMessage,
        type: "external_payment_response",
        data: {
          external_payment_id: external_payment_id,
          freight_id: externalPayment.freight_id,
          amount: externalPayment.amount,
          status: updateData.status
        }
      });

    // Se foi confirmado com comprovante, criar entrada na tabela payments
    if (accept && confirmation_doc) {
      await supabaseClient
        .from("payments")
        .insert({
          freight_id: externalPayment.freight_id,
          producer_id: externalPayment.producer_id,
          driver_id: externalPayment.driver_id,
          amount_total: externalPayment.amount,
          amount_paid: externalPayment.amount,
          payment_method: 'externo',
          payment_status: 'external'
        });

      logStep("Payment record created for confirmed external payment");
    }

    logStep("External payment response processed", { 
      paymentId: external_payment_id,
      status: updateData.status
    });

    return new Response(JSON.stringify({
      external_payment_id: external_payment_id,
      status: updateData.status,
      message: accept ? "Payment proposal accepted" : "Payment proposal rejected"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in respond-external-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});