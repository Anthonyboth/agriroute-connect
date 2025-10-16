import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { freight_id, num_trucks = 1 } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Buscar perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const isTransportCompany = profile?.role === 'TRANSPORTADORA';

    // 2. Buscar frete
    const { data: freight } = await supabase
      .from("freights")
      .select("*")
      .eq("id", freight_id)
      .single();

    if (!freight || freight.status !== "OPEN") {
      return new Response(
        JSON.stringify({ error: "Freight not available" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // 3. PREFLIGHT CHECK: Recarregar frete com dados atualizados
    // ================================================
    
    // Recarregar dados do frete para ter contagem mais recente
    const { data: freightFresh, error: reloadError } = await supabase
      .from("freights")
      .select("id, required_trucks, accepted_trucks, service_type, price, distance_km, status")
      .eq("id", freight_id)
      .single();

    if (reloadError || !freightFresh) {
      console.error(`[PREFLIGHT] Error reloading freight - ${reloadError?.message}`);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar disponibilidade do frete" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Status check
    if (freightFresh.status !== "OPEN") {
      return new Response(
        JSON.stringify({ error: "Este frete não está mais disponível" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular vagas disponíveis com dados frescos
    const availableSlots = (freightFresh.required_trucks || 1) - (freightFresh.accepted_trucks || 0);
    
    if (availableSlots < num_trucks) {
      console.log(`[PREFLIGHT] Insufficient slots - {${JSON.stringify({
        freight_id,
        required: freightFresh.required_trucks,
        accepted: freightFresh.accepted_trucks,
        available: availableSlots,
        requested: num_trucks
      })}}`);
      
      return new Response(
        JSON.stringify({ 
          error: availableSlots > 0 
            ? `Apenas ${availableSlots} vaga(s) disponível(is). Você tentou aceitar ${num_trucks} carreta(s).`
            : "Este frete já está com todas as vagas preenchidas",
          available_slots: availableSlots,
          required_trucks: freightFresh.required_trucks,
          accepted_trucks: freightFresh.accepted_trucks,
          requested_trucks: num_trucks
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // 4. VALIDAÇÕES ESPECÍFICAS POR TIPO DE SERVIÇO
    // ================================================
    
    // FRETE_MOTO: Preço mínimo R$10
    if (freightFresh.service_type === 'FRETE_MOTO') {
      const currentPrice = freightFresh.price || 0;
      
      if (currentPrice < 10) {
        console.log(`[VALIDATION] FRETE_MOTO below minimum - {${JSON.stringify({
          freight_id,
          current_price: currentPrice,
          minimum: 10
        })}}`);
        
        return new Response(
          JSON.stringify({ 
            error: `Fretes de moto devem ter valor mínimo de R$ 10,00. Valor atual: R$ ${currentPrice.toFixed(2)}. Entre em contato com o produtor para ajustar.`,
            minimum_price: 10,
            current_price: currentPrice
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[VALIDATION] FRETE_MOTO price OK - R$${currentPrice}`);
    }
    
    // Motorista individual só pode aceitar 1 carreta
    if (!isTransportCompany && num_trucks > 1) {
      return new Response(
        JSON.stringify({ error: "Individual drivers can only accept 1 truck per freight" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verificar se motorista já tem assignment ativo para esse frete
    const { data: activeAssignments } = await supabase
      .from("freight_assignments")
      .select("id, status")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .in("status", ["ACCEPTED", "IN_TRANSIT", "LOADING", "LOADED"]);

    if (activeAssignments && activeAssignments.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Você já tem uma carreta em andamento para este frete. Complete a entrega atual primeiro." 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Verificar se tem DELIVERED sem avaliação
    const { data: deliveredAssignments } = await supabase
      .from("freight_assignments")
      .select("id")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .eq("status", "DELIVERED");

    let isReAcceptance = false;
    if (deliveredAssignments && deliveredAssignments.length > 0) {
      // Verificar se já avaliou o produtor
      const { data: rating } = await supabase
        .from("freight_ratings")
        .select("id")
        .eq("freight_id", freight_id)
        .eq("rater_id", profile.id)
        .eq("rating_type", "DRIVER_TO_PRODUCER")
        .maybeSingle();

      if (!rating) {
        return new Response(
          JSON.stringify({ 
            error: "Complete a avaliação da entrega anterior antes de aceitar novamente este frete." 
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      isReAcceptance = true;
      console.log(`✅ Re-aceitação permitida: Motorista ${profile.id} já completou e avaliou`);
    }

    // 5. Buscar company_id se transportadora
    let company_id = null;
    let availableDrivers: string[] = [];
    
    if (isTransportCompany) {
      const { data: company } = await supabase
        .from("transport_companies")
        .select("id")
        .eq("profile_id", profile.id)
        .single();
      company_id = company?.id;

      // Buscar motoristas afiliados ativos
      if (company_id) {
        const { data: companyDrivers } = await supabase
          .from("company_drivers")
          .select("driver_profile_id")
          .eq("company_id", company_id)
          .eq("status", "ACTIVE")
          .eq("can_accept_freights", true);

        if (companyDrivers && companyDrivers.length > 0) {
          const driverIds = companyDrivers.map(cd => cd.driver_profile_id);

          // Filtrar motoristas que já têm assignments ativos neste frete
          const { data: existingAssignments } = await supabase
            .from("freight_assignments")
            .select("driver_id")
            .eq("freight_id", freight_id)
            .in("driver_id", driverIds)
            .in("status", ["ACCEPTED", "IN_TRANSIT", "LOADING", "LOADED"]);

          const busyDriverIds = new Set(existingAssignments?.map(a => a.driver_id) || []);
          availableDrivers = driverIds.filter(id => !busyDriverIds.has(id));

          console.log(`[COMPANY-DRIVERS] Total: ${driverIds.length}, Available: ${availableDrivers.length}, Busy: ${busyDriverIds.size}`);
        }
      }

      // Validar se há motoristas suficientes
      if (num_trucks > 1 && availableDrivers.length < num_trucks) {
        console.log(`[VALIDATION] Insufficient drivers - {${JSON.stringify({
          company_id,
          requested_trucks: num_trucks,
          available_drivers: availableDrivers.length
        })}}`);

        return new Response(
          JSON.stringify({ 
            error: `Você não tem motoristas aprovados suficientes para aceitar ${num_trucks} carreta(s). Motoristas disponíveis: ${availableDrivers.length}. Vá em "Motoristas" para ativar/convidar mais motoristas.`,
            available_drivers: availableDrivers.length,
            requested_trucks: num_trucks
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fallback: Se aceitar 1 carreta e não tem motoristas, usar perfil da empresa
      if (num_trucks === 1 && availableDrivers.length === 0) {
        availableDrivers = [profile.id];
        console.log(`[FALLBACK] Using company profile as driver for single truck acceptance`);
      }
    } else {
      // Motorista autônomo usa seu próprio perfil
      availableDrivers = [profile.id];
    }

    // ================================================
    // 6. CRIAR ASSIGNMENTS COM VALIDAÇÕES
    // ================================================
    
    const assignments = [];
    
    // Calcular agreed_price baseado no tipo de serviço
    const originalPrice = freightFresh.price || 0;
    let agreedPrice = originalPrice;
    let pricingType = 'FIXED'; // Default sempre FIXED
    
    // FRETE_MOTO: Garantir mínimo R$10
    if (freightFresh.service_type === 'FRETE_MOTO') {
      agreedPrice = Math.max(originalPrice, 10);
      pricingType = 'FIXED';
      console.log(`[ASSIGNMENT] FRETE_MOTO agreed_price: R$${agreedPrice} (original: R$${originalPrice})`);
    }
    
    // CARGA: Log warning se abaixo do ANTT
    if (freightFresh.service_type === 'CARGA' && freight.minimum_antt_price && originalPrice < freight.minimum_antt_price) {
      console.warn(`[ASSIGNMENT] CARGA price R$${originalPrice} below ANTT min R$${freight.minimum_antt_price}`);
    }
    
    // Criar um assignment para cada motorista disponível (até num_trucks)
    for (let i = 0; i < num_trucks; i++) {
      const driver_id = availableDrivers[i];
      
      const { data: assignment, error } = await supabase
        .from("freight_assignments")
        .insert({
          freight_id,
          driver_id,
          company_id,
          agreed_price: agreedPrice,
          pricing_type: pricingType,
          status: 'ACCEPTED',
          pickup_date: freight.pickup_date || null,
          delivery_date: freight.delivery_date || null,
          notes: freightFresh.service_type === 'FRETE_MOTO' && originalPrice < 10
            ? `Preço ajustado de R$ ${originalPrice.toFixed(2)} para R$ 10,00 (mínimo ANTT)`
            : null,
          metadata: {
            original_price: originalPrice,
            adjusted_price: agreedPrice !== originalPrice,
            service_type: freightFresh.service_type,
            created_by: 'accept-freight-multiple',
            is_company_assignment: isTransportCompany,
            driver_index: i + 1,
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) {
        console.error(`[ERROR] Creating assignment ${i + 1}/${num_trucks} for driver ${driver_id}:`, error);
        
        // Rollback: deletar assignments já criados
        if (assignments.length > 0) {
          console.log(`[ROLLBACK] Deleting ${assignments.length} created assignments`);
          await supabase
            .from("freight_assignments")
            .delete()
            .in("id", assignments.map(a => a.id));
        }
        
        // Retornar erro amigável para duplicatas
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ 
              error: "Você já aceitou este frete com este motorista. Tente com outro motorista disponível.",
              postgres_error: error.message
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Outros erros
        return new Response(
          JSON.stringify({ 
            error: error.message,
            assignment_index: i + 1,
            total_requested: num_trucks
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      assignments.push(assignment);
      console.log(`[SUCCESS] Assignment ${i + 1}/${num_trucks} created for driver ${driver_id}`);
    }

    console.log(`[ASSIGNMENTS] Successfully created ${assignments.length} assignments for freight ${freight_id}`);

    // ================================================
    // 6.5. VINCULAR MOTORISTA AO FRETE (para fretes de carreta única)
    // ================================================
    
    if ((freightFresh.required_trucks || 1) === 1 && !freight.driver_id) {
      const { error: driverUpdateError } = await supabase
        .from("freights")
        .update({ driver_id: profile.id })
        .eq("id", freight_id)
        .is("driver_id", null);
      
      if (driverUpdateError) {
        console.error("[DRIVER-LINK] Failed to link driver to freight:", driverUpdateError);
      } else {
        console.log(`[DRIVER-LINK] Successfully linked driver ${profile.id} to freight ${freight_id}`);
      }
    }

    // 7. Notificar produtor (com mensagem especial para re-aceitações)
    const remainingSlots = availableSlots - num_trucks;
    
    // Buscar user_id do produtor
    const { data: producerProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', freight.producer_id)
      .single();

    if (producerProfile?.user_id) {
      await supabase.from("notifications").insert({
        user_id: producerProfile.user_id,
        title: isReAcceptance 
          ? `🌟 Motorista retornou para mais ${num_trucks} carreta(s)!`
          : (isTransportCompany 
              ? `Transportadora aceitou ${num_trucks} carretas! 🚚`
              : "Motorista aceitou seu frete! 🎉"),
        message: isReAcceptance
          ? `Um motorista que já completou com sucesso uma entrega aceitou mais ${num_trucks} carreta(s). ${remainingSlots} vaga(s) restante(s).`
          : (remainingSlots > 0
              ? `${num_trucks} carreta(s) aceita(s). ${remainingSlots} vaga(s) restante(s).`
              : "Todas as carretas foram preenchidas!"),
        type: "freight_accepted",
        data: { 
          freight_id, 
          num_trucks, 
          is_company: isTransportCompany,
          is_re_acceptance: isReAcceptance 
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignments,
        remaining_slots: remainingSlots
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[FATAL] Error in accept-freight-multiple:", error);
    
    // ================================================
    // TRATAMENTO DE ERROS COM MENSAGENS AMIGÁVEIS
    // ================================================
    
    let errorMessage = "Erro ao aceitar frete";
    let statusCode = 500;
    let errorDetails = null;
    
    // Mapear códigos do Postgres para mensagens amigáveis
    if (error?.code) {
      errorDetails = {
        code: error.code,
        postgres_message: error.message,
        details: error.details,
        hint: error.hint
      };
      
      switch (error.code) {
        case '23505': // Duplicate key
          errorMessage = "Você já aceitou este frete com este motorista";
          statusCode = 409;
          break;
        case '23514': // Check constraint violation (accepted_trucks)
          errorMessage = "Este frete não tem vagas disponíveis. Outro motorista aceitou antes de você.";
          statusCode = 409;
          break;
        case '23503': // Foreign key violation
          errorMessage = "Dados inválidos. Verifique o frete ou veículo selecionado";
          statusCode = 400;
          break;
        case '42703': // Undefined column
          errorMessage = "Erro de configuração do banco de dados. Entre em contato com o suporte";
          statusCode = 500;
          break;
        case 'P0001': // Raised exception (custom validations)
          errorMessage = error.message || "Validação de regra de negócio falhou";
          statusCode = 400;
          break;
        default:
          errorMessage = error.message || String(error);
      }
      
      console.error(`[ERROR-MAPPED] Code: ${error.code} -> Message: ${errorMessage}`);
    } else {
      errorMessage = error?.message || String(error);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
