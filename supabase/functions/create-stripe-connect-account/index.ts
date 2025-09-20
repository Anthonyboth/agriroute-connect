import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STRIPE-CONNECT] ${step}${detailsStr}`);
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

    logStep("User authenticated", { userId: user.id });

    // Verificar se o usuário é motorista
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, role, full_name")
      .eq("user_id", user.id)
      .eq("role", "MOTORISTA")
      .single();

    if (profileError || !profile) {
      throw new Error("Only drivers can create Stripe Connect accounts");
    }

    // Verificar se já existe conta Stripe
    const { data: existingAccount } = await supabaseClient
      .from("driver_stripe_accounts")
      .select("stripe_account_id")
      .eq("driver_id", profile.id)
      .single();

    if (existingAccount) {
      throw new Error("Driver already has a Stripe Connect account");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    logStep("Creating Stripe Connect account");

    // Criar conta Stripe Connect
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        user_id: user.id,
        profile_id: profile.id,
        platform: 'agriroute'
      }
    });

    // Salvar no banco
    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from("driver_stripe_accounts")
      .insert({
        driver_id: profile.id,
        stripe_account_id: account.id,
        account_status: 'pending'
      })
      .select()
      .single();

    if (accountError) {
      logStep("Error saving Stripe account", { error: accountError });
      throw new Error("Failed to save Stripe account");
    }

    // Criar Account Link para onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${Deno.env.get("FRONTEND_URL") || "https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com"}/driver/stripe-connect?refresh=true`,
      return_url: `${Deno.env.get("FRONTEND_URL") || "https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com"}/driver/stripe-connect?success=true`,
      type: 'account_onboarding',
    });

    logStep("Stripe Connect account created", { 
      accountId: account.id,
      onboardingUrl: accountLink.url 
    });

    return new Response(JSON.stringify({
      account_id: account.id,
      onboarding_url: accountLink.url,
      status: "pending"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-stripe-connect-account", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});