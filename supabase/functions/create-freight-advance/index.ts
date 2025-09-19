import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-FREIGHT-ADVANCE] ${step}${detailsStr}`);
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

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { freight_id, advance_amount, advance_percentage } = await req.json();
    if (!freight_id || (!advance_amount && !advance_percentage)) {
      throw new Error("freight_id and either advance_amount or advance_percentage are required");
    }

    // Verificar se o frete existe e pertence ao usuário
    const { data: freight, error: freightError } = await supabaseClient
      .from("freights")
      .select("id, price, producer_id, driver_id, cargo_type")
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      throw new Error("Freight not found");
    }

    // Verificar se o usuário é o motorista do frete
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.id !== freight.driver_id) {
      throw new Error("Only the assigned driver can request advances");
    }

    // Calcular o valor do adiantamento em centavos (como o preço está no banco)
    const calculatedAmount = advance_amount 
      ? Math.round(advance_amount * 100) // Converter de reais para centavos
      : Math.round((freight.price * advance_percentage) / 100); // Já em centavos
    
    logStep("Calculated advance amount", { 
      calculatedAmount, 
      freightPrice: freight.price, 
      freightPriceInReais: freight.price / 100,
      advancePercentage: advance_percentage,
      advanceInReais: calculatedAmount / 100
    });

    // Registrar apenas a solicitação no banco (sem criar sessão Stripe ainda)
    const { data: advanceRecord, error: advanceError } = await supabaseClient
      .from("freight_advances")
      .insert({
        freight_id,
        driver_id: profile.id,
        producer_id: freight.producer_id,
        requested_amount: calculatedAmount,
        status: "PENDING",
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (advanceError || !advanceRecord) {
      logStep("Error creating advance record", { error: advanceError });
      throw new Error("Failed to create advance record");
    }

    logStep("Advance request created successfully", { 
      advanceId: advanceRecord.id,
      amount: calculatedAmount,
      amountInReais: calculatedAmount / 100
    });

    // Enviar notificação para o produtor
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          user_id: freight.producer_id,
          title: 'Nova Solicitação de Adiantamento',
          message: `O motorista solicitou um adiantamento de R$ ${(calculatedAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para o frete de ${freight.cargo_type}`,
          type: 'advance_request',
          data: {
            advance_id: advanceRecord.id,
            freight_id: freight_id,
            amount: calculatedAmount
          }
        }
      });
      logStep("Notification sent to producer successfully");
    } catch (notificationError) {
      logStep("Warning: Could not send notification to producer", { error: notificationError });
      // Não falhar se a notificação não for enviada
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Solicitação de adiantamento enviada ao produtor",
      advance_id: advanceRecord.id,
      requested_amount: calculatedAmount / 100 // Retornar em reais para o frontend
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-freight-advance", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});