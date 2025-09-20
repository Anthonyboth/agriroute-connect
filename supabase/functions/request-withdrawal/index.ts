import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REQUEST-WITHDRAWAL] ${step}${detailsStr}`);
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
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const { amount, pix_key } = await req.json();
    if (!amount || amount <= 0) throw new Error("amount must be greater than 0");
    if (!pix_key) throw new Error("pix_key is required");

    const MIN_WITHDRAWAL = 50; // R$ 50 mínimo
    if (amount < MIN_WITHDRAWAL) {
      throw new Error(`Minimum withdrawal amount is R$ ${MIN_WITHDRAWAL}`);
    }

    // Verificar se é motorista e buscar conta Stripe
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("role", "MOTORISTA")
      .single();

    if (profileError || !profile) {
      throw new Error("Only drivers can request withdrawals");
    }

    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from("driver_stripe_accounts")
      .select("*")
      .eq("driver_id", profile.id)
      .single();

    if (accountError || !stripeAccount) {
      throw new Error("Driver must have a verified Stripe Connect account");
    }

    if (!stripeAccount.payouts_enabled) {
      throw new Error("Stripe Connect account is not enabled for payouts");
    }

    // Calcular saldo disponível
    const { data: completedPayments } = await supabaseClient
      .from("payments")
      .select("amount_total")
      .eq("driver_id", profile.id)
      .eq("payment_status", "succeeded");

    const { data: previousWithdrawals } = await supabaseClient
      .from("driver_withdrawals")
      .select("amount")
      .eq("driver_id", profile.id)
      .in("status", ["paid", "processing"]);

    const totalEarnings = completedPayments?.reduce((sum, p) => sum + p.amount_total, 0) || 0;
    const totalWithdrawn = previousWithdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0;
    const availableBalance = totalEarnings - totalWithdrawn;

    if (amount > availableBalance) {
      throw new Error(`Insufficient balance. Available: R$ ${availableBalance.toFixed(2)}`);
    }

    // Calcular taxa da plataforma (2%)
    const platformFeeRate = 0.02;
    const platformFee = amount * platformFeeRate;
    const netAmount = amount - platformFee;

    logStep("Processing withdrawal", { 
      amount, 
      platformFee, 
      netAmount,
      availableBalance 
    });

    // Criar solicitação de saque
    const { data: withdrawal, error: withdrawalError } = await supabaseClient
      .from("driver_withdrawals")
      .insert({
        driver_id: profile.id,
        amount: amount,
        pix_key: pix_key,
        platform_fee: platformFee,
        net_amount: netAmount,
        stripe_account_id: stripeAccount.stripe_account_id,
        status: 'pending'
      })
      .select()
      .single();

    if (withdrawalError) {
      logStep("Error creating withdrawal", { error: withdrawalError });
      throw new Error("Failed to create withdrawal request");
    }

    // Tentar processar saque via Stripe (em background)
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2023-10-16" 
    });

    try {
      // Atualizar status para processing
      await supabaseClient
        .from("driver_withdrawals")
        .update({ status: 'processing' })
        .eq("id", withdrawal.id);

      // Criar transfer para conta Stripe Connect
      const transfer = await stripe.transfers.create({
        amount: Math.round(netAmount * 100), // Converter para centavos
        currency: 'brl',
        destination: stripeAccount.stripe_account_id,
        metadata: {
          withdrawal_id: withdrawal.id,
          driver_id: profile.id,
          original_amount: amount,
          platform_fee: platformFee
        }
      });

      // Criar payout para PIX
      const payout = await stripe.payouts.create({
        amount: Math.round(netAmount * 100),
        currency: 'brl',
        method: 'instant',
        metadata: {
          withdrawal_id: withdrawal.id,
          pix_key: pix_key
        }
      }, {
        stripeAccount: stripeAccount.stripe_account_id
      });

      // Atualizar com sucesso
      await supabaseClient
        .from("driver_withdrawals")
        .update({ 
          status: 'paid',
          stripe_payout_id: payout.id,
          processed_at: new Date().toISOString()
        })
        .eq("id", withdrawal.id);

      logStep("Withdrawal processed successfully", { 
        withdrawalId: withdrawal.id,
        transferId: transfer.id,
        payoutId: payout.id
      });

    } catch (stripeError) {
      logStep("Stripe processing failed", { error: stripeError });
      
      // Marcar como falha
      await supabaseClient
        .from("driver_withdrawals")
        .update({ status: 'failed' })
        .eq("id", withdrawal.id);
      
      // Não falhar a função, apenas informar que será processado manualmente
    }

    return new Response(JSON.stringify({
      withdrawal_id: withdrawal.id,
      amount: amount,
      net_amount: netAmount,
      platform_fee: platformFee,
      status: "processing"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in request-withdrawal", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});