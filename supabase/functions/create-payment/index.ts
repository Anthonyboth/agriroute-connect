import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT] ${step}${detailsStr}`);
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

    const { freight_id, payment_method } = await req.json();
    if (!freight_id) throw new Error("freight_id is required");
    if (!payment_method || !['pix', 'boleto', 'cartao'].includes(payment_method)) {
      throw new Error("payment_method must be pix, boleto, or cartao");
    }

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
      throw new Error("Unauthorized to pay for this freight");
    }

    if (!freight.driver_id) {
      throw new Error("Freight must have an assigned driver");
    }

    logStep("Freight verified", { freightId: freight.id, price: freight.price, status: freight.status });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    // Buscar ou criar cliente Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ 
        email: user.email,
        metadata: {
          user_id: user.id,
          profile_id: freight.producer_id
        }
      });
      customerId = customer.id;
    }

    // Verificar pagamentos existentes para este frete
    const { data: existingPayments } = await supabaseClient
      .from("payments")
      .select("amount_total, amount_paid")
      .eq("freight_id", freight_id)
      .in("payment_status", ["succeeded", "external"]);

    const totalPaid = existingPayments?.reduce((sum, payment) => sum + (payment.amount_paid || payment.amount_total), 0) || 0;
    const remainingAmount = freight.price - totalPaid;

    if (remainingAmount <= 0) {
      throw new Error("Freight already fully paid");
    }

    // Registrar pagamento no banco PRIMEIRO
    const { data: paymentRecord, error: paymentError } = await supabaseClient
      .from("payments")
      .insert({
        freight_id,
        producer_id: freight.producer_id,
        driver_id: freight.driver_id,
        amount_total: remainingAmount,
        payment_method,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (paymentError || !paymentRecord) {
      logStep("Error creating payment record", { error: paymentError });
      throw new Error("Failed to create payment record");
    }

    let stripeResponse;

    if (payment_method === 'cartao') {
      // Checkout Session para cartão
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { 
                name: `Pagamento de Frete - ${freight.id.substring(0, 8)}`,
                description: `Valor do frete: R$ ${freight.price.toFixed(2)}`
              },
              unit_amount: Math.round(remainingAmount * 100), // Converter para centavos
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${Deno.env.get("FRONTEND_URL") || "https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com"}/payment/success?session_id={CHECKOUT_SESSION_ID}&payment_id=${paymentRecord.id}`,
        cancel_url: `${Deno.env.get("FRONTEND_URL") || "https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com"}/payment/cancel?payment_id=${paymentRecord.id}`,
        metadata: {
          payment_id: paymentRecord.id,
          freight_id: freight_id,
          payment_method: payment_method,
          user_id: user.id,
          type: "freight_payment"
        }
      });

      // Atualizar com session_id
      await supabaseClient
        .from("payments")
        .update({ stripe_session_id: session.id })
        .eq("id", paymentRecord.id);

      stripeResponse = { url: session.url, session_id: session.id };

    } else {
      // Payment Intent para PIX e Boleto
      const paymentIntent = await stripe.paymentIntents.create({
        customer: customerId,
        amount: Math.round(remainingAmount * 100), // Converter para centavos
        currency: 'brl',
        payment_method_types: payment_method === 'pix' ? ['pix'] : ['boleto'],
        metadata: {
          payment_id: paymentRecord.id,
          freight_id: freight_id,
          payment_method: payment_method,
          user_id: user.id,
          type: "freight_payment"
        }
      });

      // Atualizar com payment_intent_id
      await supabaseClient
        .from("payments")
        .update({ stripe_payment_id: paymentIntent.id })
        .eq("id", paymentRecord.id);

      stripeResponse = { 
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      };
    }

    logStep("Payment created successfully", { 
      paymentId: paymentRecord.id,
      method: payment_method,
      amount: remainingAmount 
    });

    return new Response(JSON.stringify({
      payment_id: paymentRecord.id,
      ...stripeResponse
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});