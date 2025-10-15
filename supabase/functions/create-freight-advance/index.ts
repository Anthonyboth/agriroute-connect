import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema } from '../_shared/validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AdvanceSchema = z.object({
  freight_id: uuidSchema,
  advance_amount: z.number().min(1).max(100000).optional(),
  advance_percentage: z.number().min(0.01).max(1.0).optional()
}).refine(
  (data) => data.advance_amount || data.advance_percentage,
  { message: "Either advance_amount or advance_percentage must be provided" }
);

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

    const body = await req.json();
    const { freight_id, advance_amount, advance_percentage } = validateInput(AdvanceSchema, body);

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

    // Calcular o valor do adiantamento em centavos
    // IMPORTANTE: freight.price já está em centavos no banco
    let calculatedAmount = advance_amount 
      ? Math.round(advance_amount * 100) // Converter de reais para centavos
      : Math.round(freight.price * advance_percentage); // freight.price já está em centavos, só aplicar %
    
    // Salvaguarda: se o valor ficou muito alto para um % (indica bug de * 100 a mais), corrigir
    if (advance_percentage !== undefined && calculatedAmount > freight.price) {
      const corrected = Math.round(freight.price * advance_percentage);
      logStep("Fixed miscalculation", { wrong: calculatedAmount, corrected, freightPrice: freight.price });
      calculatedAmount = corrected;
    }
    
    logStep("Calculated advance amount", { 
      calculatedAmount, 
      freightPriceInCents: freight.price, 
      freightPriceInReais: freight.price / 100,
      advancePercentage: advance_percentage,
      advanceInReais: calculatedAmount / 100,
      source: advance_percentage !== undefined ? 'percentage' : 'fixed_amount'
    });

    // Verificar solicitações duplicadas (mesmo valor nas últimas 2 horas)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentAdvances, error: checkError } = await supabaseClient
      .from("freight_advances")
      .select("id, requested_amount, requested_at")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .eq("requested_amount", calculatedAmount)
      .gte("requested_at", twoHoursAgo)
      .neq("status", "REJECTED");

    if (checkError) {
      logStep("Error checking for duplicate advances", { error: checkError });
      throw new Error("Erro ao verificar solicitações anteriores");
    }

    if (recentAdvances && recentAdvances.length > 0) {
      logStep("Duplicate advance request detected", { 
        existingAdvances: recentAdvances.length,
        duplicateAmount: calculatedAmount / 100
      });
      throw new Error("Você já solicitou um adiantamento com este valor recentemente. Aguarde 2 horas para solicitar novamente com o mesmo valor.");
    }

    // Verificar limite de solicitações pendentes (máximo 3 por frete)
    const { data: pendingAdvances, error: pendingError } = await supabaseClient
      .from("freight_advances")
      .select("id")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .eq("status", "PENDING");

    if (pendingError) {
      logStep("Error checking pending advances", { error: pendingError });
      throw new Error("Erro ao verificar solicitações pendentes");
    }

    if (pendingAdvances && pendingAdvances.length >= 3) {
      logStep("Too many pending advances", { pendingCount: pendingAdvances.length });
      throw new Error("Você já tem o máximo de 3 solicitações pendentes para este frete. Aguarde a aprovação ou rejeição das anteriores.");
    }

    // Registrar apenas a solicitação no banco (sem criar sessão Stripe ainda)
    const { data: advanceRecord, error: advanceError } = await supabaseClient
      .from("freight_advances")
      .insert({
        freight_id,
        driver_id: profile.id,
        producer_id: freight.producer_id,
        requested_amount: calculatedAmount,
        status: "PENDING",
        requested_at: new Date().toISOString(),
        notes: advance_percentage !== undefined 
          ? `source=percentage;value=${advance_percentage * 100}%`
          : `source=fixed_amount;value=R$${advance_amount?.toFixed(2)}`
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
          message: `O motorista solicitou um adiantamento de R$ ${(calculatedAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para o frete de ${freight.cargo_type}. 

⚠️ IMPORTANTE: O pagamento deve ser acertado diretamente com o motorista através do chat do frete. A plataforma ainda não processa pagamentos de adiantamento.

💬 Use o chat do frete para combinar a forma de pagamento.`,
          type: 'advance_request',
          data: {
            advance_id: advanceRecord.id,
            freight_id: freight_id,
            amount: calculatedAmount,
            requires_action: true,
            action_type: 'chat',
            action_label: 'Ir para o chat do frete',
            chat_freight_id: freight_id
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
    // Capturar Response objects lançados pelo validateInput
    if (error instanceof Response) {
      const errorBody = await error.json();
      const errorMessage = errorBody.error || 'Validation error';
      logStep("VALIDATION ERROR", errorBody);
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorBody.details 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.status || 400,
      });
    }
    
    // Tratamento normal para outros erros
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-freight-advance", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});