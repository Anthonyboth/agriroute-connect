import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[APPROVE-FREIGHT-ADVANCE] ${step}${detailsStr}`);
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
    if (!user?.email) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { advance_id } = await req.json();
    if (!advance_id) {
      throw new Error("advance_id is required");
    }

    // Buscar o adiantamento e verificar se o usuário é o produtor
    const { data: advance, error: advanceError } = await supabaseClient
      .from("freight_advances")
      .select(`
        id,
        freight_id,
        driver_id,
        producer_id,
        requested_amount,
        status,
        freights!inner(id, price, producer_id)
      `)
      .eq("id", advance_id)
      .single();

    if (advanceError || !advance) {
      throw new Error("Advance request not found");
    }

    // Verificar se o usuário é o produtor do frete
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.id !== advance.producer_id) {
      throw new Error("Only the freight producer can approve advances");
    }

    if (advance.status !== "PENDING") {
      if (advance.status === "APPROVED" && advance.stripe_payment_intent_id) {
        // Se já foi aprovado e tem sessão de pagamento, retorna a URL existente
        try {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
            apiVersion: "2023-10-16" 
          });
          const session = await stripe.checkout.sessions.retrieve(advance.stripe_payment_intent_id);
          if (session.url) {
            logStep("Returning existing payment session", { sessionId: session.id });
            return new Response(JSON.stringify({ url: session.url }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        } catch (stripeError) {
          logStep("Could not retrieve existing session", { error: stripeError });
        }
      }
      throw new Error("Esta solicitação de adiantamento já foi processada");
    }

    logStep("Creating Stripe session", { 
      advanceId: advance.id,
      amount: advance.requested_amount,
      amountInReais: advance.requested_amount / 100
    });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Buscar ou criar cliente Stripe para o produtor
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
    }

    // Criar sessão de checkout para o produtor pagar o adiantamento
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: { 
              name: `Adiantamento de Frete - ${advance.freight_id.substring(0, 8)}`,
              description: `Pagamento de adiantamento para o motorista`
            },
            unit_amount: Math.round(advance.requested_amount), // Valor já está em centavos no banco
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com/payment/success?session_id={CHECKOUT_SESSION_ID}&type=freight_advance&advance_id=${advance_id}`,
      cancel_url: `https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com/payment/cancel?type=freight_advance&advance_id=${advance_id}`,
      metadata: {
        advance_id: advance_id,
        freight_id: advance.freight_id,
        requested_amount: advance.requested_amount.toString(),
        producer_id: profile.id,
        type: "freight_advance_payment"
      }
    });

    // Atualizar o adiantamento com o stripe_payment_intent_id
    const { error: updateError } = await supabaseClient
      .from("freight_advances")
      .update({
        stripe_payment_intent_id: session.id,
        status: "APPROVED"
      })
      .eq("id", advance_id);

    if (updateError) {
      logStep("Error updating advance record", { error: updateError });
      throw new Error("Failed to update advance record");
    }

    logStep("Advance payment session created successfully", { 
      sessionId: session.id, 
      amount: advance.requested_amount,
      amountInReais: advance.requested_amount / 100
    });

    // Enviar notificação para o motorista sobre aprovação do adiantamento
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          user_id: advance.driver_id,
          title: 'Adiantamento Aprovado',
          message: `Seu adiantamento de R$ ${(advance.requested_amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} foi aprovado! O valor será creditado em sua conta em breve.`,
          type: 'advance_approved',
          data: {
            advance_id: advance_id,
            amount: advance.requested_amount / 100, // Converter para reais
            checkout_url: session.url
          }
        }
      });
      logStep("Notification sent to driver successfully");
    } catch (notificationError) {
      logStep("Warning: Could not send notification to driver", { error: notificationError });
      // Não falhar se a notificação não for enviada
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in approve-freight-advance", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});