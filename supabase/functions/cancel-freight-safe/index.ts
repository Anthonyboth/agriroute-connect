import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) {
      console.error('[CANCEL-FREIGHT] Missing auth header');
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[CANCEL-FREIGHT] Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { freight_id, reason } = await req.json();

    if (!freight_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'freight_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT] User ${user.id} cancelling freight ${freight_id}`);

    // 1) Verify caller profile (must be producer or admin)
    const { data: caller, error: callerErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (callerErr || !caller) {
      console.error('[CANCEL-FREIGHT] Profile not found:', callerErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerRole = String((caller as any).role || '').toUpperCase();
    const callerProfileId = String((caller as any).id);
    const isAdmin = callerRole === 'ADMIN';
    const isProducer = callerRole === 'PRODUTOR';

    if (!isAdmin && !isProducer) {
      console.error('[CANCEL-FREIGHT] Not authorized:', callerRole);
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para cancelar fretes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Get freight details (including metadata to preserve)
    const { data: freight, error: fetchError } = await supabaseAdmin
      .from('freights')
      .select('id, pickup_date, producer_id, driver_id, status, metadata, required_trucks, accepted_trucks')
      .eq('id', freight_id)
      .single();

    if (fetchError || !freight) {
      console.error('[CANCEL-FREIGHT] Freight not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Frete não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Verify ownership (unless admin)
    if (!isAdmin && String((freight as any).producer_id) !== callerProfileId) {
      console.error('[CANCEL-FREIGHT] Not owner');
      return new Response(
        JSON.stringify({ success: false, error: 'Você não é o dono deste frete' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentStatus = String((freight as any).status || '').toUpperCase();

    // 4) Only allow cancellation from safe statuses
    // CRITICAL: After LOADING/LOADED/IN_TRANSIT, cancellation is NOT allowed.
    // User must contact support instead.
    const CANCELLABLE_STATUSES = ['OPEN', 'ACCEPTED', 'IN_NEGOTIATION'];
    if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
      console.error('[CANCEL-FREIGHT] BLOCKED - Cannot cancel freight with status:', currentStatus);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Não é possível cancelar frete com status "${currentStatus}". Após o carregamento, entre em contato com o suporte.` 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT] Freight status: ${currentStatus}, required_trucks: ${(freight as any).required_trucks}, accepted_trucks: ${(freight as any).accepted_trucks}`);

    // 5) ✅ CRITICAL: Cancel ALL active freight_assignments FIRST
    // This prevents the recalc_accepted_trucks trigger from reverting the freight status
    const { data: activeAssignments, error: assignListErr } = await supabaseAdmin
      .from('freight_assignments')
      .select('id, driver_id')
      .eq('freight_id', freight_id)
      .not('status', 'in', '("CANCELLED","REJECTED")');

    if (assignListErr) {
      console.warn('[CANCEL-FREIGHT] Error listing assignments:', assignListErr.message);
    }

    if (activeAssignments && activeAssignments.length > 0) {
      console.log(`[CANCEL-FREIGHT] Cancelling ${activeAssignments.length} active assignments`);
      
      const { error: assignCancelErr } = await supabaseAdmin
        .from('freight_assignments')
        .update({
          status: 'CANCELLED',
          notes: reason || 'Frete cancelado pelo produtor',
          updated_at: new Date().toISOString(),
        })
        .eq('freight_id', freight_id)
        .not('status', 'in', '("CANCELLED","REJECTED")');

      if (assignCancelErr) {
        console.error('[CANCEL-FREIGHT] Error cancelling assignments:', assignCancelErr.message);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao cancelar atribuições de motoristas' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also clean up trip progress for all assigned drivers
      const driverIds = activeAssignments.map((a: any) => a.driver_id).filter(Boolean);
      if (driverIds.length > 0) {
        await supabaseAdmin
          .from('driver_trip_progress')
          .delete()
          .eq('freight_id', freight_id)
          .in('driver_id', driverIds);
        
        console.log(`[CANCEL-FREIGHT] Cleaned up trip progress for ${driverIds.length} drivers`);
      }
    }

    // 6) Cancel any active proposals
    await supabaseAdmin
      .from('freight_proposals')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('freight_id', freight_id)
      .in('status', ['PENDING', 'ACCEPTED']);

    // 7) Now update the freight itself to CANCELLED
    // After assignments are cancelled, recalc_accepted_trucks will set accepted_trucks=0
    // So we just need to set the status to CANCELLED
    const existingMetadata = (freight as any).metadata || {};
    
    const { error: updateError } = await supabaseAdmin
      .from('freights')
      .update({
        status: 'CANCELLED',
        driver_id: null,
        accepted_trucks: 0,
        drivers_assigned: [],
        updated_at: new Date().toISOString(),
        metadata: {
          ...existingMetadata,
          cancellation_reason: reason || 'Cancelado pelo produtor',
          cancelled_by: callerProfileId,
          cancelled_at: new Date().toISOString(),
        }
      })
      .eq('id', freight_id);

    if (updateError) {
      console.error('[CANCEL-FREIGHT] Update error:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro ao cancelar frete',
          details: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT] ✅ Freight ${freight_id} cancelled successfully (${activeAssignments?.length || 0} assignments also cancelled)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Frete cancelado com sucesso',
        freight_id,
        assignments_cancelled: activeAssignments?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CANCEL-FREIGHT] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro inesperado ao cancelar frete' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
