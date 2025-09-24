import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[REQUEST-PROVIDER-PAYOUT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Client for auth verification
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Admin client to bypass RLS for server-side operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const { amount, pix_key, description } = await req.json();

    logStep("Processing payout request", { userId: userData.user.id, amount, pixKey: pix_key });

    // Validações básicas
    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }

    if (!pix_key || pix_key.trim() === "") {
      throw new Error("PIX key is required");
    }

    // Valor mínimo para saque (R$ 10,00)
    if (amount < 10) {
      throw new Error("Minimum payout amount is R$ 10.00");
    }

    // Buscar profile do usuário
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("user_id", userData.user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    // Verificar se é motorista ou prestador
    if (!["MOTORISTA", "PRESTADOR_SERVICOS"].includes(profile.role)) {
      throw new Error("User is not a driver or service provider");
    }

    logStep("Profile validated", { profileId: profile.id, role: profile.role });

    // Processar solicitação de saque usando função do banco
    const { data: payoutResult, error: payoutError } = await supabaseAdmin
      .rpc("process_payout_request", {
        provider_id_param: profile.id,
        amount_param: amount,
        pix_key_param: pix_key,
        description_param: description
      });

    if (payoutError) {
      logStep("Error processing payout", { error: payoutError });
      throw payoutError;
    }

    if (!payoutResult.success) {
      logStep("Payout request failed", payoutResult);
      return new Response(JSON.stringify({
        error: payoutResult.error,
        available_balance: payoutResult.available_balance
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Enviar notificação de sucesso
    try {
      await supabaseAdmin.functions.invoke('send-notification', {
        body: {
          user_id: profile.id,
          title: 'Solicitação de Saque Enviada',
          message: `Sua solicitação de saque de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi enviada e será processada em até 2 dias úteis.`,
          type: 'payout_requested',
          data: {
            transaction_id: payoutResult.transaction_id,
            amount: amount,
            pix_key: pix_key
          }
        }
      });
      logStep('Payout notification sent')
    } catch (notificationError) {
      logStep('Warning: Could not send payout notification', { error: notificationError })
    }

    logStep("Payout request processed successfully", payoutResult);

    return new Response(JSON.stringify({
      success: true,
      transaction_id: payoutResult.transaction_id,
      new_balance: payoutResult.new_balance,
      message: "Solicitação de saque enviada com sucesso"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("Error", { error: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});