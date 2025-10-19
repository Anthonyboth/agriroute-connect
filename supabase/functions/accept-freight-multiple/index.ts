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
    // ================================================
    // 1. VALIDATE REQUEST BODY
    // ================================================
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid request format. Please provide valid JSON data.",
          details: "Request body must be valid JSON"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { freight_id, num_trucks = 1 } = requestBody;
    
    // Validate required parameters
    if (!freight_id) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameter: freight_id",
          details: "Please provide a valid freight ID to accept"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate num_trucks is a positive integer
    if (typeof num_trucks !== 'number' || num_trucks < 1 || !Number.isInteger(num_trucks)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid parameter: num_trucks must be a positive integer",
          details: `Received: ${num_trucks}`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ================================================
    // 2. VALIDATE AUTHENTICATION
    // ================================================
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: "Authentication required",
          details: "Please provide an Authorization header with a valid token"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid or expired authentication token",
          details: "Please log in again to continue"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // 3. VALIDATE USER PROFILE
    // ================================================
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ 
          error: "User profile not found",
          details: "Please complete your profile setup before accepting freights"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTransportCompany = profile?.role === 'TRANSPORTADORA';

    // ================================================
    // 4. VALIDATE FREIGHT EXISTS AND IS AVAILABLE
    // ================================================
    const { data: freight, error: freightError } = await supabase
      .from("freights")
      .select("*")
      .eq("id", freight_id)
      .single();

    if (freightError || !freight) {
      return new Response(
        JSON.stringify({ 
          error: "Freight not found",
          details: "The freight you are trying to accept does not exist or has been removed"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (freight.status !== "OPEN") {
      const statusMessages: Record<string, string> = {
        'ACCEPTED': 'This freight has already been fully accepted by other drivers',
        'IN_TRANSIT': 'This freight is already in transit',
        'DELIVERED': 'This freight has already been delivered',
        'CANCELLED': 'This freight has been cancelled by the producer',
        'COMPLETED': 'This freight has been completed'
      };
      
      return new Response(
        JSON.stringify({ 
          error: "Freight not available",
          details: statusMessages[freight.status as string] || `This freight is not available (status: ${freight.status})`,
          current_status: freight.status
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // 5. PREFLIGHT CHECK: Recarregar frete com dados atualizados
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
        JSON.stringify({ 
          error: "Error verifying freight availability",
          details: "Unable to check current freight status. Please try again."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Status check
    if (freightFresh.status !== "OPEN") {
      return new Response(
        JSON.stringify({ 
          error: "Freight is no longer available",
          details: "This freight was accepted by another driver while you were viewing it. Please check other available freights.",
          current_status: freightFresh.status
        }),
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
            ? `Only ${availableSlots} slot(s) available. You attempted to accept ${num_trucks} truck(s).`
            : "All slots for this freight have been filled",
          details: availableSlots > 0
            ? `Please reduce the number of trucks to ${availableSlots} or less`
            : "Another driver accepted the remaining slots while you were processing this request",
          available_slots: availableSlots,
          required_trucks: freightFresh.required_trucks,
          accepted_trucks: freightFresh.accepted_trucks,
          requested_trucks: num_trucks
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ================================================
    // 6. VALIDAÇÕES ESPECÍFICAS POR TIPO DE SERVIÇO
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
            error: `Motorcycle freight must have a minimum price of R$ 10.00. Current price: R$ ${currentPrice.toFixed(2)}. Please contact the producer to adjust.`,
            details: "This freight does not meet the minimum price requirement for motorcycle deliveries",
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
        JSON.stringify({ 
          error: "Individual drivers can only accept 1 truck per freight",
          details: "Only transport companies can accept multiple trucks. Individual drivers are limited to one truck per freight.",
          requested_trucks: num_trucks
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Verificar se motorista já tem assignment ativo para esse frete
    const { data: activeAssignments } = await supabase
      .from("freight_assignments")
      .select("id, status")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id)
      .in("status", ["ACCEPTED", "IN_TRANSIT", "LOADING", "LOADED"]);

    if (activeAssignments && activeAssignments.length > 0) {
      const statusDescriptions: Record<string, string> = {
        'ACCEPTED': 'already accepted',
        'IN_TRANSIT': 'in transit',
        'LOADING': 'loading',
        'LOADED': 'loaded'
      };
      const currentStatus = activeAssignments[0].status;
      const statusDesc = statusDescriptions[currentStatus as string] || currentStatus.toLowerCase();
      
      return new Response(
        JSON.stringify({ 
          error: "You already have an active assignment for this freight",
          details: `You have a truck ${statusDesc} for this freight. Please complete the current delivery before accepting another truck for the same freight.`,
          current_assignment_status: currentStatus,
          assignment_count: activeAssignments.length
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Verificar se tem DELIVERED sem avaliação
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
            error: "Rating required before re-acceptance",
            details: "You have completed a delivery for this freight but haven't rated the producer yet. Please complete the rating before accepting another truck for this freight.",
            action_required: "Rate the producer in your completed deliveries"
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      isReAcceptance = true;
      console.log(`✅ Re-aceitação permitida: Motorista ${profile.id} já completou e avaliou`);
    }

    // 9. Buscar company_id se transportadora
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
            error: `You don't have enough approved drivers to accept ${num_trucks} truck(s). Available drivers: ${availableDrivers.length}. Go to "Drivers" to activate/invite more drivers.`,
            details: "Transport companies need enough active and approved drivers to accept multiple trucks",
            available_drivers: availableDrivers.length,
            requested_trucks: num_trucks,
            action_required: "Activate or invite more drivers in the Drivers section"
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

    // ===== VALIDAÇÃO DE VEÍCULOS DISPONÍVEIS (TRANSPORTADORAS) =====
    let availableVehicleIds: string[] = [];
    
    if (isTransportCompany && company_id) {
      console.log(`[VEHICLES] Checking available vehicles for company ${company_id}`);
      
      const { data: companyVehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, license_plate, vehicle_type, status')
        .eq('company_id', company_id)
        .eq('is_company_vehicle', true)
        .eq('status', 'APPROVED');
      
      if (vehicleError) {
        console.error('[VEHICLES] Error fetching vehicles:', vehicleError);
        return new Response(
          JSON.stringify({ 
            error: 'Error fetching available vehicles',
            details: vehicleError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[VEHICLES] Found ${companyVehicles?.length || 0} approved vehicles`);

      const { data: usedVehicles, error: usedError } = await supabase
        .from('freight_assignments')
        .select('vehicle_id')
        .eq('freight_id', freight_id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .not('vehicle_id', 'is', null);

      if (usedError) {
        console.error('[VEHICLES] Error checking used vehicles:', usedError);
      }

      const usedVehicleIds = new Set(usedVehicles?.map(v => v.vehicle_id).filter(Boolean) || []);
      const freeVehicles = companyVehicles?.filter(v => !usedVehicleIds.has(v.id)) || [];
      
      console.log(`[VEHICLES] Total: ${companyVehicles?.length || 0}, In use: ${usedVehicleIds.size}, Available: ${freeVehicles.length}`);

      if (freeVehicles.length < num_trucks) {
        const totalApproved = companyVehicles?.length || 0;

        return new Response(
          JSON.stringify({
            error: `You don't have enough approved vehicles. Available: ${freeVehicles.length}, Required: ${num_trucks}.`,
            details: "Register more vehicles in the Fleet tab and wait for administrator approval",
            available_vehicles: freeVehicles.length,
            total_approved: totalApproved,
            vehicles_in_use: usedVehicleIds.size,
            requested_trucks: num_trucks,
            action_required: 'Register more vehicles in the "Fleet" section'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      availableVehicleIds = freeVehicles.map(v => v.id);
      console.log(`[VEHICLES] Will use vehicle IDs:`, availableVehicleIds);
    }

    // ================================================
    // 10. CRIAR ASSIGNMENTS COM VALIDAÇÕES
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
      const vehicle_id = availableVehicleIds[i] || null;
      
      const { data: assignment, error } = await supabase
        .from("freight_assignments")
        .insert({
          freight_id,
          driver_id,
          company_id,
          vehicle_id,
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
            vehicle_id: vehicle_id || undefined,
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
              error: "This freight has already been accepted with this driver",
              details: "You cannot accept the same freight multiple times with the same driver. Try using a different available driver.",
              postgres_error: error.message
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Outros erros
        return new Response(
          JSON.stringify({ 
            error: "Error creating freight assignment",
            details: error.message,
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
    // 10.5. VINCULAR MOTORISTA AO FRETE (para fretes de carreta única)
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

    // 11. Notificar produtor (com mensagem especial para re-aceitações)
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
    
    let errorMessage = "Failed to accept freight";
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
          errorMessage = "This freight has already been accepted with this driver";
          statusCode = 409;
          break;
        case '23514': // Check constraint violation (accepted_trucks)
          errorMessage = "This freight has no available slots. Another driver accepted it before you.";
          statusCode = 409;
          break;
        case '23503': // Foreign key violation
          errorMessage = "Invalid data provided. Please check the freight or vehicle selection";
          statusCode = 400;
          break;
        case '42703': // Undefined column
          errorMessage = "Database configuration error. Please contact support";
          statusCode = 500;
          break;
        case 'P0001': // Raised exception (custom validations)
          errorMessage = error.message || "Business rule validation failed";
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
