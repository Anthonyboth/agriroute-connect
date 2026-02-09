import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[GET-PROVIDER-BALANCE] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Also create client for user auth verification
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
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

    logStep("User authenticated", { userId: userData.user.id });

    // Buscar profile do usuário usando admin client
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

    logStep("Profile found", { profileId: profile.id, role: profile.role });

    // Buscar saldo usando a função do banco com admin client
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .rpc("get_provider_balance", { provider_id_param: profile.id });

    if (balanceError) {
      logStep("Error getting balance", { error: balanceError });
      throw balanceError;
    }

    // Buscar histórico recente via view segura (mascara Stripe IDs e saldos antigos)
    const { data: recentTransactions, error: transactionsError } = await supabaseAdmin
      .from("balance_transactions_secure")
      .select("*")
      .eq("provider_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (transactionsError) {
      logStep("Warning: Could not fetch recent transactions", { error: transactionsError });
    }

    const response = {
      ...balanceData,
      recent_transactions: recentTransactions || []
    };

    logStep("Balance retrieved successfully", response);

    return new Response(JSON.stringify(response), {
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