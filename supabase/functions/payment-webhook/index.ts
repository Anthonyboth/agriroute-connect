import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.log(`Webhook signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        if (session.metadata?.payment_id) {
          await supabaseClient
            .from("payments")
            .update({ 
              payment_status: 'succeeded',
              amount_paid: session.amount_total / 100,
              stripe_payment_id: session.payment_intent
            })
            .eq("id", session.metadata.payment_id);
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        if (paymentIntent.metadata?.payment_id) {
          await supabaseClient
            .from("payments")
            .update({ 
              payment_status: 'succeeded',
              amount_paid: paymentIntent.amount / 100
            })
            .eq("stripe_payment_id", paymentIntent.id);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object;
        if (failedIntent.metadata?.payment_id) {
          await supabaseClient
            .from("payments")
            .update({ payment_status: 'failed' })
            .eq("stripe_payment_id", failedIntent.id);
        }
        break;

      case 'account.updated':
        const account = event.data.object;
        await supabaseClient
          .from("driver_stripe_accounts")
          .update({ 
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            account_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending'
          })
          .eq("stripe_account_id", account.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});