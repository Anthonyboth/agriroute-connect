import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SERVICE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Cliente para autenticação
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Cliente admin para operações do servidor
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    logStep("User authenticated", { userId: user.id, email: user.email });

    // SECURITY: Validate input with Zod schema to prevent injection attacks
    const ServicePaymentSchema = z.object({
      serviceRequestId: z.string().uuid('Invalid service request ID format')
    });

    const body = await req.json();
    const validated = ServicePaymentSchema.parse(body);
    const { serviceRequestId } = validated;

    // Buscar o service request
    const { data: serviceRequest, error: serviceError } = await supabaseAdmin
      .from("service_requests")
      .select(`
        *,
        client:profiles!service_requests_client_id_fkey(id, user_id, full_name),
        provider:profiles!service_requests_provider_id_fkey(id, user_id, full_name)
      `)
      .eq("id", serviceRequestId)
      .eq("status", "COMPLETED")
      .single();

    if (serviceError || !serviceRequest) {
      logStep("Service request not found or not completed", { serviceRequestId, error: serviceError });
      throw new Error("Service request not found or not completed");
    }

    // Verificar se o usuário é o cliente do serviço
    if (serviceRequest.client.user_id !== user.id) {
      logStep("User not authorized for this service", { userId: user.id, clientUserId: serviceRequest.client.user_id });
      throw new Error("Not authorized to pay for this service");
    }

    // Verificar se já existe um pagamento pendente ou completo
    const { data: existingPayment } = await supabaseAdmin
      .from("service_payments")
      .select("*")
      .eq("service_request_id", serviceRequestId)
      .in("status", ["PENDING", "COMPLETED"])
      .single();

    if (existingPayment) {
      logStep("Payment already exists", { existingPayment });
      throw new Error("Payment for this service already exists");
    }

    const finalPrice = serviceRequest.final_price || serviceRequest.estimated_price;
    if (!finalPrice || finalPrice <= 0) {
      throw new Error("Invalid service price");
    }

    // Criar pagamento na base de dados
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("service_payments")
      .insert({
        service_request_id: serviceRequestId,
        client_id: serviceRequest.client_id,
        provider_id: serviceRequest.provider_id,
        amount: finalPrice,
        status: "PENDING",
        payment_method: "STRIPE_CHECKOUT"
      })
      .select()
      .single();

    if (paymentError || !payment) {
      logStep("Error creating payment record", { error: paymentError });
      throw new Error("Failed to create payment record");
    }

    logStep("Payment record created", { paymentId: payment.id, amount: finalPrice });

    // Inicializar Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Verificar se já existe um cliente Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      logStep("No existing customer found, will create during checkout");
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Serviço de ${serviceRequest.service_type.replace('_', ' ')}`,
              description: `${serviceRequest.problem_description} - ${serviceRequest.location_address}`,
            },
            unit_amount: Math.round(finalPrice * 100), // Converter para centavos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/service-payment/success`,
      cancel_url: `${req.headers.get("origin")}/service-payment/cancel`,
      metadata: {
        type: "service_payment",
        service_request_id: serviceRequestId,
        payment_id: payment.id,
        client_id: serviceRequest.client_id,
        provider_id: serviceRequest.provider_id,
        user_id: user.id
      }
    });

    // Atualizar o pagamento com o session ID
    const { error: updateError } = await supabaseAdmin
      .from("service_payments")
      .update({ 
        stripe_session_id: session.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", payment.id);

    if (updateError) {
      logStep("Error updating payment with session ID", { error: updateError });
      throw updateError;
    }

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      paymentId: payment.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-service-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});