import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[CANCEL-FREIGHT] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { freight_id, reason } = await req.json();

    if (!freight_id) {
      return new Response(
        JSON.stringify({ error: 'freight_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT] User ${user.id} cancelling freight ${freight_id}`);

    // Get freight details
    const { data: freight, error: fetchError } = await supabaseAdmin
      .from('freights')
      .select('id, pickup_date, producer_id, driver_id, status')
      .eq('id', freight_id)
      .single();

    if (fetchError || !freight) {
      console.error('[CANCEL-FREIGHT] Freight not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Frete não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate safe pickup date (now + 2 hours)
    const now = new Date();
    const safePickup = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // If freight has a future pickup_date, use the max between it and safePickup
    let finalPickupDate = safePickup;
    if (freight.pickup_date) {
      const existingPickup = new Date(freight.pickup_date);
      if (existingPickup > now) {
        finalPickupDate = existingPickup > safePickup ? existingPickup : safePickup;
      }
    }

    console.log(`[CANCEL-FREIGHT] Original pickup: ${freight.pickup_date}, Safe pickup: ${finalPickupDate.toISOString()}`);

    // Update freight with safe pickup_date
    const { error: updateError } = await supabaseAdmin
      .from('freights')
      .update({
        status: 'CANCELLED',
        pickup_date: finalPickupDate.toISOString(),
        updated_at: new Date().toISOString(),
        metadata: freight.metadata 
          ? { ...freight.metadata, cancellation_reason: reason }
          : { cancellation_reason: reason }
      })
      .eq('id', freight_id);

    if (updateError) {
      console.error('[CANCEL-FREIGHT] Update error:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao cancelar frete',
          details: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CANCEL-FREIGHT] ✅ Freight ${freight_id} cancelled successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Frete cancelado com sucesso',
        freight_id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CANCEL-FREIGHT] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro inesperado ao cancelar frete' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
