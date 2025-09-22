import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Map category and plan type to Stripe price IDs
const categoryPlanToPrice: { [key: string]: string } = {
  'rodotrem_essential': 'price_1SAAMuFk9MPYZBVdjsn7F2wL',
  'rodotrem_professional': 'price_1SAANHFk9MPYZBVdAfHSWk3C',
  'carreta_essential': 'price_1SAANdFk9MPYZBVdT8yvL3FB',
  'prestador_essential': 'price_1SAANuFk9MPYZBVdnDgNQ1BH',
  // Fallback to existing prices for other categories
  'truck_essential': 'price_1SAAD5Fk9MPYZBVd7qBtf20e',
  'truck_professional': 'price_1SAADbFk9MPYZBVd6iBM29aR',
  'vuc_essential': 'price_1SAAD5Fk9MPYZBVd7qBtf20e',
  'vuc_professional': 'price_1SAADbFk9MPYZBVd6iBM29aR',
  'pickup_essential': 'price_1SAAD5Fk9MPYZBVd7qBtf20e',
  'pickup_professional': 'price_1SAADbFk9MPYZBVd6iBM29aR',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { category, planType } = await req.json();
    
    if (!category || !planType) {
      throw new Error("Category and planType are required");
    }

    const priceKey = `${category}_${planType}`;
    const priceId = categoryPlanToPrice[priceKey];
    
    if (!priceId) {
      throw new Error(`No price found for category: ${category}, planType: ${planType}`);
    }

    logStep("Selected category, plan and price", { category, planType, priceId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      logStep("No existing customer found, will create during checkout");
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/payment-success`,
      cancel_url: `${req.headers.get("origin")}/plans`,
      metadata: {
        user_id: user.id,
        category: category,
        plan_type: planType
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});