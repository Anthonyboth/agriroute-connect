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

    // Autenticar usuário com cliente anon + header do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[CHECK-FREIGHT-REQUESTER] Sem header de autorização");
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.log("[CHECK-FREIGHT-REQUESTER] Tentativa de acesso não autorizado");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Não autorizado" 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`[CHECK-FREIGHT-REQUESTER] Verificando frete ${freight_id} para usuário ${userId}`);

    // Cliente com service_role para operações de dados
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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
      .maybeSingle();

    // ✅ Se não encontrou em freights, tentar em service_requests (PET, Pacotes, etc.)
    if (!freight) {
      console.log(`[CHECK-FREIGHT-REQUESTER] Não encontrado em freights, buscando em service_requests...`);
      
      const { data: serviceRequest, error: srError } = await supabase
        .from("service_requests")
        .select(`
          id,
          status,
          client_id,
          client:profiles!fk_service_requests_client (
            id,
            user_id,
            full_name,
            status
          )
        `)
        .eq("id", freight_id)
        .maybeSingle();

      if (srError || !serviceRequest) {
        console.error(`[CHECK-FREIGHT-REQUESTER] Também não encontrado em service_requests - freights: ${freightError?.message}, sr: ${srError?.message}`);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Frete ou solicitação não encontrado" 
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Service request encontrada - client_id é o solicitante
      const client = serviceRequest.client as any;
      const clientExists = client != null && client.id != null;
      const requesterType = clientExists ? 'REGISTERED' : 'GUEST';
      
      console.log(`[CHECK-FREIGHT-REQUESTER] Service request encontrada:`, JSON.stringify({
        service_request_id: freight_id,
        client_id: serviceRequest.client_id,
        client_exists: clientExists,
        requester_type: requesterType,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          requester: {
            type: requesterType,
            has_registration: clientExists,
            producer_id: serviceRequest.client_id,
            producer_name: client?.full_name || null,
            producer_status: client?.status || null
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
