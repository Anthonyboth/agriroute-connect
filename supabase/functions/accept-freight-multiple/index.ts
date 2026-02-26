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

    // Validate UUID format for freight_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof freight_id !== 'string' || !uuidRegex.test(freight_id)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid parameter: freight_id must be a valid UUID",
          details: "Please provide a valid freight ID in UUID format"
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

    // ======================================================
    // 5.1 CAPACITY SOURCE-OF-TRUTH (CRÍTICO)
    // ======================================================
    // accepted_trucks pode ficar fora de sincronia por falhas antigas/triggers.
    // Para evitar oversubscription (ex.: 1 carreta com 2+ motoristas), usamos
    // SEMPRE a contagem real de assignments ativos como fonte de verdade.
    const activeAssignmentStatuses = [
      'ACCEPTED',
      'LOADING',
      'LOADED',
      'IN_TRANSIT',
      'DELIVERED_PENDING_CONFIRMATION',
    ] as const;

    const { count: realAcceptedCount, error: realAcceptedError } = await supabase
      .from('freight_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('freight_id', freight_id)
      .in('status', [...activeAssignmentStatuses]);

    if (realAcceptedError) {
      console.error('[PREFLIGHT] Error counting real accepted assignments:', realAcceptedError);
      return new Response(
        JSON.stringify({
          error: 'Error verifying freight capacity',
          details: 'Unable to verify current assignments. Please try again.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const realAccepted = realAcceptedCount ?? 0;

    // Calcular vagas disponíveis com base em assignments (source-of-truth)
    const availableSlots = (freightFresh.required_trucks || 1) - realAccepted;
    
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
          real_accepted_assignments: realAccepted,
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

    // 7. Verificar se motorista já tem QUALQUER assignment para esse frete (evitar duplicata)
    // ✅ CORREÇÃO: Verificar TODOS os status, não apenas ativos, para evitar erro 23505
    const { data: existingAssignments, error: existingAssignmentsError } = await supabase
      .from("freight_assignments")
      .select("id, status")
      .eq("freight_id", freight_id)
      .eq("driver_id", profile.id);

    if (existingAssignmentsError) {
      console.error("[ASSIGNMENT-CHECK] Error checking existing assignments:", existingAssignmentsError);
    }

    if (existingAssignments && existingAssignments.length > 0) {
      const statusDescriptions: Record<string, string> = {
        'ACCEPTED': 'aceito',
        'IN_TRANSIT': 'em trânsito',
        'LOADING': 'carregando',
        'LOADED': 'carregado',
        'DELIVERED': 'entregue',
        'DELIVERED_PENDING_CONFIRMATION': 'aguardando confirmação',
        'COMPLETED': 'concluído',
        'CANCELLED': 'cancelado',
        'WITHDRAWN': 'desistido'
      };
      const currentStatus = existingAssignments[0].status;
      const statusDesc = statusDescriptions[currentStatus as string] || currentStatus?.toLowerCase() || 'desconhecido';
      
      console.log(`[DUPLICATE-CHECK] Driver ${profile.id} already has assignment for freight ${freight_id} with status: ${currentStatus}`);
      
      // ✅ IDEMPOTÊNCIA: Se está em status ativo, retornar SUCESSO (não erro)
      // Isso evita erros 500/409 repetitivos e permite tratamento gracioso no frontend
      const activeStatuses = ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'];
      if (activeStatuses.includes(currentStatus)) {
        console.log(`[IDEMPOTENT] Returning success for already-accepted freight`);
        return new Response(
          JSON.stringify({ 
            success: true,
            already_accepted: true,
            message: `Você já aceitou este frete (status: ${statusDesc})`,
            current_assignment_status: currentStatus,
            assignment_count: existingAssignments.length,
            assignments: existingAssignments,
            code: "ALREADY_ACCEPTED"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // ✅ IDEMPOTÊNCIA: Se está aguardando confirmação, retornar SUCESSO
      if (currentStatus === 'DELIVERED_PENDING_CONFIRMATION') {
        console.log(`[IDEMPOTENT] Returning success for pending confirmation freight`);
        return new Response(
          JSON.stringify({ 
            success: true,
            pending_confirmation: true,
            message: "Sua entrega está aguardando confirmação do produtor",
            current_assignment_status: currentStatus,
            assignments: existingAssignments,
            code: "PENDING_CONFIRMATION"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Se foi cancelado ou desistiu, permitir re-aceitação (não bloquear)
      if (['CANCELLED', 'WITHDRAWN'].includes(currentStatus)) {
        console.log(`[RE-ACCEPT] Allowing re-acceptance for driver ${profile.id} - previous status was ${currentStatus}`);
        // Deletar o assignment antigo cancelado/desistido para permitir nova inserção
        const { error: deleteError } = await supabase
          .from("freight_assignments")
          .delete()
          .eq("id", existingAssignments[0].id);
        
        if (deleteError) {
          console.error("[RE-ACCEPT] Failed to delete old assignment:", deleteError);
          return new Response(
            JSON.stringify({ 
              error: "Erro ao processar re-aceitação",
              details: "Não foi possível limpar o registro anterior. Tente novamente.",
              postgres_error: deleteError.message
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.log(`[RE-ACCEPT] Deleted old ${currentStatus} assignment, proceeding with new acceptance`);
      }
      
      // Se já foi entregue ou concluído, verificar se pode re-aceitar (lógica de avaliação)
      // Isso é tratado mais abaixo no código, então não bloquear aqui
      if (['DELIVERED', 'COMPLETED'].includes(currentStatus)) {
        console.log(`[DELIVERED-CHECK] Driver ${profile.id} has delivered/completed assignment - will check rating below`);
        // Continuar para verificação de avaliação (linha 280+)
      }
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

      // ✅ CRÍTICO: Transportadoras NÃO criam assignments automaticamente
      // Motoristas afiliados só veem fretes compartilhados via ShareFreightToDriver
      availableDrivers = [];
      
      console.log(`[TRANSPORT-COMPANY] Company ${company_id} accepting freight. NO automatic driver assignment. Freights must be manually shared via ShareFreightToDriver.`);
      
      // ⚠️ Para transportadoras, múltiplos caminhões são permitidos MAS não há validação
      // de motoristas/veículos aqui pois assignments serão criados manualmente depois
      if (num_trucks > 1) {
        console.log(`[TRANSPORT-COMPANY] Accepting ${num_trucks} trucks. Assignments will be created manually.`);
      }
    } else {
      // Motorista autônomo usa seu próprio perfil
      availableDrivers = [profile.id];
      
      // ✅ VALIDAÇÃO: Motorista autônomo só pode ter 1 frete em andamento
      const { data: activeFreights, error: activeFreightsError } = await supabase
        .from("freights")
        .select("id, status, cargo_type")
        .eq("driver_id", profile.id)
        .in("status", ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT"]);

      if (activeFreightsError) {
        console.error("[VALIDATION] Error checking active freights:", activeFreightsError);
        return new Response(
          JSON.stringify({ 
            error: "Unable to verify active freights",
            details: "Please try again in a moment"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar também freight_assignments (sistema novo)
      const { data: activeAssignmentsCheck, error: assignmentsError } = await supabase
        .from("freight_assignments")
        .select("id, status, freight:freights(id, cargo_type)")
        .eq("driver_id", profile.id)
        .in("status", ["ACCEPTED", "IN_TRANSIT", "LOADING", "LOADED"]);

      if (assignmentsError) {
        console.error("[VALIDATION] Error checking active assignments:", assignmentsError);
      }

      const totalActive = (activeFreights?.length || 0) + (activeAssignmentsCheck?.length || 0);

      // ✅ Regra atualizada: motoristas podem ter múltiplos fretes ativos
      // (ex: frete rural + pacotes + PET simultaneamente)
      console.log(`[VALIDATION] Driver ${profile.id} has ${totalActive} active freight(s) - multiple allowed`);
    }

    // ===== VALIDAÇÃO DE VEÍCULOS DISPONÍVEIS (TRANSPORTADORAS) =====
    let availableVehicleIds: string[] = [];
    
    // ✅ SKIP: Transportadoras não validam veículos aqui pois não criam assignments automaticamente
    if (!isTransportCompany) {
      console.log(`[VEHICLES] Skipping vehicle validation for individual driver (uses own vehicle)`);
    } else {
      console.log(`[VEHICLES] Skipping vehicle validation for transport company (assignments created manually later)`);
    }

    // ================================================
    // 10. CRIAR ASSIGNMENTS COM VALIDAÇÕES
    // ================================================
    
    const assignments = [];
    
    // ✅ CRÍTICO: Só criar assignments se houver motoristas selecionados
    // Para transportadoras, availableDrivers estará vazio
    if (availableDrivers.length > 0) {
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
      // ✅ CORREÇÃO: Ajustar datas se estiverem no passado (trigger bloqueia pickup_date < CURRENT_DATE)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let adjustedPickupDate = freight.pickup_date;
      let adjustedDeliveryDate = freight.delivery_date;
      let dateWasAdjusted = false;
      
      if (freight.pickup_date) {
        const pickupDate = new Date(freight.pickup_date);
        pickupDate.setHours(0, 0, 0, 0);
        
        if (pickupDate < today) {
          // Ajustar para hoje
          adjustedPickupDate = today.toISOString().split('T')[0];
          dateWasAdjusted = true;
          console.log(`[DATE-ADJUST] pickup_date ajustada de ${freight.pickup_date} para ${adjustedPickupDate}`);
          
          // Também ajustar delivery_date se necessário
          if (freight.delivery_date) {
            const deliveryDate = new Date(freight.delivery_date);
            deliveryDate.setHours(0, 0, 0, 0);
            
            if (deliveryDate < today) {
              // Manter a diferença de dias original ou ajustar para hoje
              const originalDiff = Math.ceil((deliveryDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
              const newDeliveryDate = new Date(today);
              newDeliveryDate.setDate(newDeliveryDate.getDate() + Math.max(0, originalDiff));
              adjustedDeliveryDate = newDeliveryDate.toISOString().split('T')[0];
              console.log(`[DATE-ADJUST] delivery_date ajustada de ${freight.delivery_date} para ${adjustedDeliveryDate}`);
            }
          }
        }
      }
      
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
            pickup_date: adjustedPickupDate || null,
            delivery_date: adjustedDeliveryDate || null,
            notes: (() => {
              const notes: string[] = [];
              if (freightFresh.service_type === 'FRETE_MOTO' && originalPrice < 10) {
                notes.push(`Preço ajustado de R$ ${originalPrice.toFixed(2)} para R$ 10,00 (mínimo ANTT)`);
              }
              if (dateWasAdjusted) {
                notes.push(`Data de coleta ajustada automaticamente para ${adjustedPickupDate} (data original no passado)`);
              }
              return notes.length > 0 ? notes.join('. ') : null;
            })(),
            metadata: {
              original_price: originalPrice,
              adjusted_price: agreedPrice !== originalPrice,
              service_type: freightFresh.service_type,
              created_by: 'accept-freight-multiple',
              is_company_assignment: isTransportCompany,
              driver_index: i + 1,
              vehicle_id: vehicle_id || undefined,
              date_was_adjusted: dateWasAdjusted,
              original_pickup_date: freight.pickup_date,
              original_delivery_date: freight.delivery_date,
              adjusted_pickup_date: dateWasAdjusted ? adjustedPickupDate : undefined,
              adjusted_delivery_date: dateWasAdjusted ? adjustedDeliveryDate : undefined,
              created_at: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (error) {
          console.error(`[ERROR] Creating assignment ${i + 1}/${num_trucks} for driver ${driver_id}:`, error);
          
          // ✅ IDEMPOTÊNCIA: Duplicata = já aceito = sucesso
          if (error.code === '23505') {
            console.log(`[IDEMPOTENT] Duplicate key - freight already accepted by this driver`);
            
            // Buscar o assignment existente
            const { data: existingAssignment } = await supabase
              .from("freight_assignments")
              .select("*")
              .eq("freight_id", freight_id)
              .eq("driver_id", driver_id)
              .single();
            
            // Rollback assignments criados nesta execução (se houver)
            if (assignments.length > 0) {
              console.log(`[ROLLBACK] Deleting ${assignments.length} created assignments`);
              await supabase
                .from("freight_assignments")
                .delete()
                .in("id", assignments.map(a => a.id));
            }
            
            return new Response(
              JSON.stringify({ 
                success: true,
                already_accepted: true,
                message: "Você já aceitou este frete",
                assignments: existingAssignment ? [existingAssignment] : [],
                code: "ALREADY_ACCEPTED"
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Rollback: deletar assignments já criados
          if (assignments.length > 0) {
            console.log(`[ROLLBACK] Deleting ${assignments.length} created assignments`);
            await supabase
              .from("freight_assignments")
              .delete()
              .in("id", assignments.map(a => a.id));
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
    } else {
      console.log(`[NO-ASSIGNMENT] Freight accepted without automatic driver assignment (transport company mode). Assignments will be created via ShareFreightToDriver.`);
    }

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

    // 11. Notificação do produtor é gerada automaticamente pelo trigger
    // notify_freight_status_change ao mudar status para ACCEPTED.
    // NÃO inserir manualmente aqui para evitar duplicação.
    const remainingSlots = availableSlots - num_trucks;
    console.log(`[NOTIFICATION] Skipping manual insert - trigger notify_freight_status_change handles it. Remaining slots: ${remainingSlots}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        assignments,
        remaining_slots: remainingSlots
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
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
