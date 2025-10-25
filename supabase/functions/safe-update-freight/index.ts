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
      console.error('[SAFE-UPDATE] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { freight_id, updates } = await req.json();

    if (!freight_id || !updates) {
      return new Response(
        JSON.stringify({ error: 'freight_id e updates são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SAFE-UPDATE] User ${user.id} updating freight ${freight_id}`);

    // Get current freight
    const { data: freight, error: fetchError } = await supabaseAdmin
      .from('freights')
      .select('id, pickup_date')
      .eq('id', freight_id)
      .single();

    if (fetchError || !freight) {
      console.error('[SAFE-UPDATE] Freight not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Frete não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate safe pickup date
    const now = new Date();
    const safePickup = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    let finalPickupDate = updates.pickup_date || freight.pickup_date;
    if (finalPickupDate) {
      const pickupDate = new Date(finalPickupDate);
      if (pickupDate <= now) {
        finalPickupDate = safePickup.toISOString();
        console.log(`[SAFE-UPDATE] Adjusting past pickup_date to: ${finalPickupDate}`);
      }
    } else {
      finalPickupDate = safePickup.toISOString();
      console.log(`[SAFE-UPDATE] No pickup_date, setting to: ${finalPickupDate}`);
    }

    // Update freight with safe pickup_date
    const { data: updatedFreight, error: updateError } = await supabaseAdmin
      .from('freights')
      .update({
        ...updates,
        pickup_date: finalPickupDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', freight_id)
      .select()
      .single();

    if (updateError) {
      console.error('[SAFE-UPDATE] Update error:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao atualizar frete',
          details: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SAFE-UPDATE] ✅ Freight ${freight_id} updated successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Frete atualizado com sucesso',
        freight: updatedFreight
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SAFE-UPDATE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro inesperado ao atualizar frete' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
