import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-FREIGHT-ADVANCE] ${step}${detailsStr}`);
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

    const { freight_id, advance_amount, advance_percentage } = await req.json();
    if (!freight_id || (!advance_amount && !advance_percentage)) {
      throw new Error("freight_id and either advance_amount or advance_percentage are required");
    }

    // Verificar se o frete existe e pertence ao usuário
    const { data: freight, error: freightError } = await supabaseClient
      .from("freights")
      .select("id, price, producer_id, driver_id")
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      throw new Error("Freight not found");
    }

    // Verificar se o usuário tem permissão (é o produtor ou motorista do frete)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.id !== freight.producer_id && profile.id !== freight.driver_id)) {
      throw new Error("Unauthorized to create advance for this freight");
    }

    // Calcular o valor do adiantamento
    const calculatedAmount = advance_amount || Math.round((freight.price * advance_percentage) / 100);
    
    logStep("Calculated advance amount", { calculatedAmount, freightPrice: freight.price });

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

    // Criar sessão de checkout para o adiantamento
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: { 
              name: `Adiantamento de Frete - ${freight.id.substring(0, 8)}`,
              description: `Adiantamento para o frete no valor de R$ ${(freight.price / 100).toFixed(2)}`
            },
            unit_amount: calculatedAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com/payment/success?session_id={CHECKOUT_SESSION_ID}&type=freight_advance&freight_id=${freight_id}`,
      cancel_url: `https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com/payment/cancel?type=freight_advance&freight_id=${freight_id}`,
      metadata: {
        freight_id: freight_id,
        requested_amount: calculatedAmount.toString(),
        user_id: user.id,
        type: "freight_advance"
      }
    });

    // Registrar o adiantamento no banco
    const { data: advanceRecord, error: advanceError } = await supabaseClient
      .from("freight_advances")
      .insert({
        freight_id,
        driver_id: profile.id,
        requested_amount: calculatedAmount,
        stripe_payment_intent_id: session.id,
        status: "PENDING",
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (advanceError || !advanceRecord) {
      logStep("Error creating advance record", { error: advanceError });
      throw new Error("Failed to create advance record");
    }

    // Update metadata with advance_id
    await stripe.checkout.sessions.update(session.id, {
      metadata: {
        ...session.metadata,
        advance_id: advanceRecord.id
      }
    });

    logStep("Advance session created successfully", { 
      sessionId: session.id, 
      amount: calculatedAmount 
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-freight-advance", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});