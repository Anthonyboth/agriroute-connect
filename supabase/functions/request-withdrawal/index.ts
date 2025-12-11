import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, pixKeySchema } from '../_shared/validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WithdrawalSchema = z.object({
  amount: z.number().min(50, 'Valor mínimo para saque é R$ 50').max(1000000, 'Valor máximo excedido'),
  pix_key: pixKeySchema
});

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [REQUEST-WITHDRAWAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Função iniciada");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      return new Response(
        JSON.stringify({ error: `Erro de autenticação: ${userError.message}`, code: "AUTH_ERROR" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user = userData.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado", code: "UNAUTHENTICATED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Usuário autenticado", { userId: user.id });

    const body = await req.json();
    const { amount, pix_key } = validateInput(WithdrawalSchema, body);

    // Verificar se é motorista e buscar conta Stripe
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("role", "MOTORISTA")
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Apenas motoristas podem solicitar saques", code: "DRIVER_ONLY" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from("driver_stripe_accounts")
      .select("*")
      .eq("driver_id", profile.id)
      .single();

    if (accountError || !stripeAccount) {
      return new Response(
        JSON.stringify({ 
          error: "Motorista precisa ter uma conta Stripe Connect verificada", 
          code: "STRIPE_ACCOUNT_REQUIRED" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stripeAccount.payouts_enabled) {
      return new Response(
        JSON.stringify({ 
          error: "Conta Stripe Connect não está habilitada para saques", 
          code: "PAYOUTS_DISABLED" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ 
          error: `Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2)}`, 
          code: "INSUFFICIENT_BALANCE",
          available_balance: availableBalance
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular taxa da plataforma (2%)
    const platformFeeRate = 0.02;
    const platformFee = amount * platformFeeRate;
    const netAmount = amount - platformFee;

    logStep("Processando saque", { 
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
      logStep("Erro ao criar solicitação de saque", { error: withdrawalError });
      return new Response(
        JSON.stringify({ 
          error: "Falha ao criar solicitação de saque", 
          code: "WITHDRAWAL_CREATE_FAILED" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentar processar saque via Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!stripeSecretKey) {
      logStep("STRIPE_SECRET_KEY não configurada - saque será processado manualmente");
      return new Response(JSON.stringify({
        withdrawal_id: withdrawal.id,
        amount: amount,
        net_amount: netAmount,
        platform_fee: platformFee,
        status: "pending",
        message: "Solicitação criada. O saque será processado manualmente pela equipe."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeSecretKey, { 
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

      logStep("Saque processado com sucesso", { 
        withdrawalId: withdrawal.id,
        transferId: transfer.id,
        payoutId: payout.id
      });

      return new Response(JSON.stringify({
        withdrawal_id: withdrawal.id,
        amount: amount,
        net_amount: netAmount,
        platform_fee: platformFee,
        status: "paid",
        stripe_payout_id: payout.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (stripeError: any) {
      // ✅ CORRIGIDO: Melhor tratamento de erro Stripe - não silenciar
      logStep("Erro no processamento Stripe", { 
        error: stripeError.message,
        type: stripeError.type,
        code: stripeError.code
      });
      
      // Marcar como falha com detalhes do erro
      await supabaseClient
        .from("driver_withdrawals")
        .update({ 
          status: 'failed',
          metadata: {
            stripe_error: stripeError.message,
            stripe_error_code: stripeError.code,
            stripe_error_type: stripeError.type,
            failed_at: new Date().toISOString()
          }
        })
        .eq("id", withdrawal.id);

      // Enviar notificação de falha ao motorista
      try {
        await supabaseClient.functions.invoke('send-notification', {
          body: {
            user_id: profile.id,
            title: 'Falha no Saque',
            message: `Sua solicitação de saque de R$ ${amount.toFixed(2)} falhou. Por favor, verifique sua conta Stripe ou entre em contato com o suporte.`,
            type: 'withdrawal_failed',
            data: {
              withdrawal_id: withdrawal.id,
              amount,
              error: stripeError.message
            }
          }
        });
      } catch (notifyError) {
        logStep("Erro ao notificar falha de saque", { error: notifyError });
      }

      // ✅ CORRIGIDO: Retornar erro ao cliente ao invés de silenciar
      return new Response(JSON.stringify({
        error: "Falha ao processar saque via Stripe",
        code: "STRIPE_PROCESSING_FAILED",
        withdrawal_id: withdrawal.id,
        details: stripeError.message,
        status: "failed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

  } catch (error) {
    // Handle validation errors
    if (error instanceof Response) {
      return error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERRO em request-withdrawal", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: "INTERNAL_ERROR"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
