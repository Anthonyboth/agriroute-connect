import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// Map Stripe price IDs to plan info
const priceToCategory: { [key: string]: { category: string; planType: string } } = {
  // New pricing scheme
  'price_prestador_essential_69': { category: 'prestador', planType: 'essential' },
  'price_prestador_professional_119': { category: 'prestador', planType: 'professional' },
  'price_motorista_rural_essential_119': { category: 'motorista_rural', planType: 'essential' },
  'price_motorista_rural_professional_199': { category: 'motorista_rural', planType: 'professional' },
  'price_motorista_urbano_essential_69': { category: 'motorista_urbano', planType: 'essential' },
  'price_motorista_urbano_professional_119': { category: 'motorista_urbano', planType: 'professional' },
  'price_guincho_urbano_essential_69': { category: 'guincho_urbano', planType: 'essential' },
  'price_guincho_urbano_professional_119': { category: 'guincho_urbano', planType: 'professional' },
  
  // Legacy compatibility
  'price_1SAAMuFk9MPYZBVdjsn7F2wL': { category: 'rodotrem', planType: 'essential' },
  'price_1SAANHFk9MPYZBVdAfHSWk3C': { category: 'rodotrem', planType: 'professional' },
  'price_1SAANdFk9MPYZBVdT8yvL3FB': { category: 'carreta', planType: 'essential' },
  'price_1SAANuFk9MPYZBVdnDgNQ1BH': { category: 'prestador', planType: 'essential' },
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
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: "No authorization header provided",
        subscribed: false,
        subscription_tier: 'FREE'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    // Handle session expiration gracefully - return 401 instead of 500
    if (userError) {
      logStep("Auth error (session may have expired)", { error: userError.message });
      return new Response(JSON.stringify({ 
        error: "Session expired",
        code: "SESSION_EXPIRED",
        subscribed: false,
        subscription_tier: 'FREE'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ 
        error: "User not authenticated",
        subscribed: false,
        subscription_tier: 'FREE'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's profile to determine category
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    let userCategory = 'prestador'; // default

    // If user is a driver, check their vehicle type or role for category determination
    if (profile?.role === 'MOTORISTA') {
      const { data: vehicle } = await supabaseClient
        .from('vehicles')
        .select('vehicle_type')
        .eq('driver_id', profile.id)
        .single();

      if (vehicle?.vehicle_type) {
        // Map vehicle types to new categories
        const vehicleTypeMap: { [key: string]: string } = {
          'BITREM': 'motorista_rural',
          'CARRETA': 'motorista_rural', 
          'TRUCK': 'motorista_urbano',
          'TOCO': 'motorista_urbano',
          'VUC': 'motorista_urbano',
          'PICKUP': 'motorista_urbano'
        };
        userCategory = vehicleTypeMap[vehicle.vehicle_type] || 'motorista_urbano';
      } else {
        // Default to urban driver if no vehicle specified
        userCategory = 'motorista_urbano';
      }
    } else if (profile?.role === 'PRESTADOR_SERVICOS') {
      // Check if it's a towing service (guincho)
      const { data: serviceProvider } = await supabaseClient
        .from('service_providers')
        .select('service_types')
        .eq('profile_id', profile.id)
        .single();

      if (serviceProvider?.service_types && 
          Array.isArray(serviceProvider.service_types) && 
          serviceProvider.service_types.includes('GUINCHO')) {
        userCategory = 'guincho_urbano';
      } else {
        userCategory = 'prestador';
      }
    }

    logStep("User category determined", { userCategory, role: profile?.role });

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
          status: 'canceled',
          current_period_end: null,
          stripe_subscription_id: null,
          stripe_customer_id: null
        });

      return new Response(JSON.stringify({ 
        subscribed: false,
        subscription_tier: 'FREE',
        subscription_end: null,
        user_category: userCategory
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
      
      const planInfo = priceToCategory[priceId];
      if (planInfo) {
        tier = planInfo.planType.toUpperCase();
      }

      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        tier,
        priceId,
        planInfo
      });

      // Get plan ID from database
      const { data: planData } = await supabaseClient
        .from('plans')
        .select('id')
        .eq('category', planInfo?.category || userCategory)
        .eq('plan_type', planInfo?.planType || 'free')
        .single();

      planId = planData?.id;

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
          status: 'canceled',
          current_period_end: null,
          stripe_subscription_id: null,
          stripe_customer_id: customerId
        });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: tier,
      subscription_end: subscriptionEnd,
      plan_id: planId,
      user_category: userCategory
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