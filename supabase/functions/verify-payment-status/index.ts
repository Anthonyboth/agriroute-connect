import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [VERIFY-PAYMENT-STATUS] ${step}`, details ? JSON.stringify(details) : '')
}

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

    const { payment_type, payment_id } = await req.json();
    if (!payment_type || !payment_id) {
      throw new Error("payment_type and payment_id are required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    logStep("Verifying payment status", { paymentType: payment_type, paymentId: payment_id });

    if (payment_type === 'freight_advance') {
      // Verificar adiantamento de frete
      const { data: advance, error: advanceError } = await supabaseClient
        .from('freight_advances')
        .select('*, freights(producer_id)')
        .eq('id', payment_id)
        .single();

      if (advanceError || !advance) {
        throw new Error('Advance not found');
      }

      // Verificar se o usuário tem permissão
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.id !== advance.freights.producer_id) {
        throw new Error('Unauthorized');
      }

      // Verificar status no Stripe se houver session_id
      if (advance.stripe_payment_intent_id) {
        try {
          const session = await stripe.checkout.sessions.retrieve(advance.stripe_payment_intent_id);
          
          logStep("Stripe session status", { 
            sessionId: session.id, 
            paymentStatus: session.payment_status,
            status: session.status 
          });

          // Se o pagamento foi confirmado no Stripe mas não foi atualizado no banco
          if (session.payment_status === 'paid' && advance.status !== 'PAID') {
            const { error: updateError } = await supabaseClient
              .from('freight_advances')
              .update({
                status: 'PAID',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', payment_id);

            if (updateError) {
              logStep("Error updating advance status", { error: updateError });
              throw updateError;
            }

            logStep("Advance status synchronized with Stripe");
            
            return new Response(JSON.stringify({ 
              success: true, 
              message: 'Payment status synchronized',
              status: 'PAID'
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        } catch (stripeError) {
          logStep("Error checking Stripe session", { error: stripeError.message });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        status: advance.status,
        stripe_session_id: advance.stripe_payment_intent_id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (payment_type === 'freight_payment') {
      // Verificar pagamento de frete
      const { data: payment, error: paymentError } = await supabaseClient
        .from('freight_payments')
        .select('*, freights(producer_id)')
        .eq('id', payment_id)
        .single();

      if (paymentError || !payment) {
        throw new Error('Payment not found');
      }

      // Verificar se o usuário tem permissão
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.id !== payment.freights.producer_id) {
        throw new Error('Unauthorized');
      }

      // Verificar status no Stripe se houver session_id
      if (payment.stripe_session_id) {
        try {
          const session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
          
          logStep("Stripe session status", { 
            sessionId: session.id, 
            paymentStatus: session.payment_status,
            status: session.status 
          });

          // Se o pagamento foi confirmado no Stripe mas não foi atualizado no banco
          if (session.payment_status === 'paid' && payment.status !== 'COMPLETED') {
            const { error: updateError } = await supabaseClient
              .from('freight_payments')
              .update({
                status: 'COMPLETED',
                stripe_payment_intent_id: session.payment_intent,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', payment_id);

            if (updateError) {
              logStep("Error updating payment status", { error: updateError });
              throw updateError;
            }

            // Atualizar status do frete
            const { error: freightError } = await supabaseClient
              .from('freights')
              .update({
                status: 'DELIVERED',
                updated_at: new Date().toISOString()
              })
              .eq('id', payment.freight_id);

            if (freightError) {
              logStep("Error updating freight status", { error: freightError });
            }

            logStep("Payment status synchronized with Stripe");
            
            return new Response(JSON.stringify({ 
              success: true, 
              message: 'Payment status synchronized',
              status: 'COMPLETED'
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        } catch (stripeError) {
          logStep("Error checking Stripe session", { error: stripeError.message });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        status: payment.status,
        stripe_session_id: payment.stripe_session_id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else {
      throw new Error('Invalid payment_type. Must be "freight_advance" or "freight_payment"');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-payment-status", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});