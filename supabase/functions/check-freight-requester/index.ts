import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Verifica se o solicitante de um frete tem cadastro completo.
 * 
 * IMPORTANTE: Esta função APENAS INFORMA o status do solicitante.
 * Ela NÃO altera o frete de nenhuma forma (sem efeitos colaterais).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[CHECK-FREIGHT-REQUESTER] Função iniciada");
    
    const { freight_id } = await req.json();
    
    if (!freight_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "ID do frete é obrigatório" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Autenticar usuário
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      console.log("[CHECK-FREIGHT-REQUESTER] Tentativa de acesso não autorizado");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Não autorizado" 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CHECK-FREIGHT-REQUESTER] Verificando frete ${freight_id} para usuário ${user.id}`);

    // Buscar frete com produtor usando FK correto
    const { data: freight, error: freightError } = await supabase
      .from("freights")
      .select(`
        id,
        status,
        producer_id,
        is_guest_freight,
        prospect_user_id,
        producer:profiles!freights_producer_id_fkey (
          id,
          user_id,
          full_name,
          status
        )
      `)
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      console.error(`[CHECK-FREIGHT-REQUESTER] Frete não encontrado - ${freightError?.message}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Frete não encontrado" 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar tipo de solicitante
    const producer = freight.producer as any;
    const isGuestFreight = freight.is_guest_freight === true || freight.prospect_user_id != null;
    const hasProducerId = freight.producer_id != null;
    const producerExists = producer != null && producer.id != null;
    
    // Regra clara:
    // - É GUEST se: is_guest_freight=true OU prospect_user_id preenchido OU producer_id é null
    // - É REGISTERED se: producer_id existe E o profile existe
    const requesterType = (isGuestFreight || !hasProducerId || !producerExists) ? 'GUEST' : 'REGISTERED';
    const hasRegistration = requesterType === 'REGISTERED';
    
    console.log(`[CHECK-FREIGHT-REQUESTER] Resultado da verificação:`, JSON.stringify({
      freight_id,
      producer_id: freight.producer_id,
      is_guest_freight: freight.is_guest_freight,
      prospect_user_id: freight.prospect_user_id,
      producer_exists: producerExists,
      requester_type: requesterType,
      has_registration: hasRegistration
    }));

    // IMPORTANTE: Apenas retorna informação, NÃO altera o frete
    return new Response(
      JSON.stringify({
        success: true,
        requester: {
          type: requesterType,
          has_registration: hasRegistration,
          producer_id: freight.producer_id,
          producer_name: producer?.full_name || null,
          producer_status: producer?.status || null
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[CHECK-FREIGHT-REQUESTER] Erro fatal:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Erro interno ao verificar solicitante"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
