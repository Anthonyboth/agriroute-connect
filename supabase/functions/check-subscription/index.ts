import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found");
      
      // Update user subscription status in database
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: null,
          status: 'INACTIVE',
          current_period_end: null,
          stripe_subscription_id: null,
          stripe_customer_id: null
        });

      return new Response(JSON.stringify({ 
        subscribed: false,
        subscription_tier: 'FREE',
        subscription_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let tier = 'FREE';
    let subscriptionEnd = null;
    let planId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const priceId = subscription.items.data[0].price.id;
      
      // Map price IDs to tiers and plan IDs
      const priceTierMap: { [key: string]: { tier: string; planId: number } } = {
        'price_1SAAD5Fk9MPYZBVd7qBtf20e': { tier: 'BASIC', planId: 1 },
        'price_1SAADbFk9MPYZBVd6iBM29aR': { tier: 'PREMIUM', planId: 2 },
        'price_1SAADsFk9MPYZBVdZRGSnlkt': { tier: 'ENTERPRISE', planId: 3 }
      };

      const planInfo = priceTierMap[priceId];
      if (planInfo) {
        tier = planInfo.tier;
        planId = planInfo.planId;
      }

      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        tier,
        planId
      });

      // Update user subscription status in database
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: planId,
          status: 'ACTIVE',
          current_period_end: subscriptionEnd,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId
        });
    } else {
      logStep("No active subscription found");
      
      // Update user subscription status in database
      await supabaseClient
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: null,
          status: 'INACTIVE',
          current_period_end: null,
          stripe_subscription_id: null,
          stripe_customer_id: customerId
        });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: tier,
      subscription_end: subscriptionEnd,
      plan_id: planId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});