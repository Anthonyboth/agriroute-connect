import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput, uuidSchema, textSchema } from '../_shared/validation.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RejectAdvanceSchema = z.object({
  advance_id: uuidSchema,
  rejection_reason: textSchema(500).optional()
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REJECT-FREIGHT-ADVANCE] ${step}${detailsStr}`);
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

    const body = await req.json()
    const validated = validateInput(RejectAdvanceSchema, body)
    const { advance_id, rejection_reason } = validated

    // Buscar o adiantamento e verificar se o usuário é o produtor
    const { data: advance, error: advanceError } = await supabaseClient
      .from("freight_advances")
      .select(`
        id,
        freight_id,
        driver_id,
        producer_id,
        requested_amount,
        status,
        freights!inner(id, cargo_type, producer_id)
      `)
      .eq("id", advance_id)
      .single();

    if (advanceError || !advance) {
      throw new Error("Advance request not found");
    }

    // Verificar se o usuário é o produtor do frete
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.id !== advance.producer_id) {
      throw new Error("Only the freight producer can reject advances");
    }

    if (advance.status !== "PENDING") {
      throw new Error("Esta solicitação de adiantamento já foi processada");
    }

    logStep("Rejecting advance", { 
      advanceId: advance.id,
      amount: advance.requested_amount,
      reason: rejection_reason
    });

    // Atualizar o adiantamento como rejeitado
    const { error: updateError } = await supabaseClient
      .from("freight_advances")
      .update({
        status: "REJECTED",
        notes: rejection_reason || "Rejeitado pelo produtor",
        updated_at: new Date().toISOString()
      })
      .eq("id", advance_id);

    if (updateError) {
      logStep("Error updating advance record", { error: updateError });
      throw new Error("Failed to reject advance request");
    }

    logStep("Advance rejected successfully", { 
      advanceId: advance.id, 
      amount: advance.requested_amount
    });

    // Buscar informações do produtor para a mensagem
    const { data: producerProfile } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("id", advance.producer_id)
      .single();

    // Enviar mensagem no chat do frete
    try {
      const chatMessage = `💼 Adiantamento rejeitado pelo produtor${rejection_reason ? `\n\n📝 Motivo: ${rejection_reason}` : ''}\n\n💰 Valor: R$ ${advance.requested_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      const { error: messageError } = await supabaseClient
        .from("freight_messages")
        .insert({
          freight_id: advance.freight_id,
          sender_id: advance.producer_id,
          message: chatMessage,
          message_type: 'SYSTEM'
        });

      if (messageError) {
        logStep("Warning: Could not send chat message", { error: messageError });
      } else {
        logStep("Chat message sent successfully");
      }
    } catch (chatError) {
      logStep("Warning: Could not send chat message", { error: chatError });
    }

    // Enviar notificação para o motorista sobre rejeição do adiantamento
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          user_id: advance.driver_id,
          title: 'Adiantamento Rejeitado',
          message: `Seu adiantamento de R$ ${advance.requested_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} foi rejeitado pelo produtor.${rejection_reason ? ` Motivo: ${rejection_reason}` : ''}`,
          type: 'advance_rejected',
          data: {
            advance_id: advance_id,
            amount: advance.requested_amount,
            reason: rejection_reason
          }
        }
      });
      logStep("Notification sent to driver successfully");
    } catch (notificationError) {
      logStep("Warning: Could not send notification to driver", { error: notificationError });
      // Não falhar se a notificação não for enviada
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Adiantamento rejeitado com sucesso"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in reject-freight-advance", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});