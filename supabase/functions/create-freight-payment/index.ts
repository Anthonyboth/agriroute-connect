import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-FREIGHT-PAYMENT] ${step}${detailsStr}`);
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

    const { freight_id, payment_method = "CREDIT_CARD" } = await req.json();
    if (!freight_id) {
      throw new Error("freight_id is required");
    }

    // Verificar se o frete existe
    const { data: freight, error: freightError } = await supabaseClient
      .from("freights")
      .select("id, price, producer_id, driver_id, status")
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      throw new Error("Freight not found");
    }

    // Verificar se o usuário tem permissão (é o produtor do frete)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.id !== freight.producer_id) {
      throw new Error("Unauthorized to pay for this freight");
    }

    logStep("Freight verified", { freightId: freight.id, price: freight.price });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Buscar ou criar cliente Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
    }

    // Verificar se já existe adiantamento para calcular valor restante
    const { data: advances } = await supabaseClient
      .from("freight_advances")
      .select("amount")
      .eq("freight_id", freight_id)
      .eq("status", "COMPLETED");

    const totalAdvances = advances?.reduce((sum, advance) => sum + advance.amount, 0) || 0;
    const remainingAmount = freight.price - totalAdvances;

    if (remainingAmount <= 0) {
      throw new Error("Freight already fully paid");
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: { 
              name: `Pagamento de Frete - ${freight.id.substring(0, 8)}`,
              description: totalAdvances > 0 ? 
                `Valor restante após adiantamentos de R$ ${(totalAdvances / 100).toFixed(2)}` :
                `Pagamento completo do frete`
            },
            unit_amount: remainingAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/freight-payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/freight/${freight_id}`,
      metadata: {
        freight_id: freight_id,
        payment_amount: remainingAmount.toString(),
        payment_method: payment_method,
        user_id: user.id
      }
    });

    // Registrar o pagamento no banco
    const { error: paymentError } = await supabaseClient
      .from("freight_payments")
      .insert({
        freight_id,
        payer_id: profile.id,
        amount: remainingAmount,
        payment_method,
        stripe_session_id: session.id,
        status: "PENDING"
      });

    if (paymentError) {
      logStep("Error creating payment record", { error: paymentError });
      throw new Error("Failed to create payment record");
    }

    logStep("Payment session created successfully", { 
      sessionId: session.id, 
      amount: remainingAmount 
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-freight-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});