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

    // This is an admin-only function - verify authorization
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[NORMALIZE] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NORMALIZE] Starting normalization process...`);

    const now = new Date();
    const safePickup = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const safePickupISO = safePickup.toISOString();

    // Normalize freights with past pickup_date
    const { data: freightsToUpdate, error: freightsFetchError } = await supabaseAdmin
      .from('freights')
      .select('id, pickup_date')
      .or('pickup_date.is.null,pickup_date.lt.' + now.toISOString());

    if (freightsFetchError) {
      console.error('[NORMALIZE] Error fetching freights:', freightsFetchError);
    } else if (freightsToUpdate && freightsToUpdate.length > 0) {
      console.log(`[NORMALIZE] Found ${freightsToUpdate.length} freights to update`);
      
      for (const freight of freightsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('freights')
          .update({ 
            pickup_date: safePickupISO,
            updated_at: new Date().toISOString()
          })
          .eq('id', freight.id);

        if (updateError) {
          console.error(`[NORMALIZE] Error updating freight ${freight.id}:`, updateError);
        } else {
          console.log(`[NORMALIZE] ✅ Updated freight ${freight.id}: ${freight.pickup_date} → ${safePickupISO}`);
        }
      }
    } else {
      console.log('[NORMALIZE] No freights to update');
    }

    // Normalize freight_assignments with past pickup_date
    const { data: assignmentsToUpdate, error: assignmentsFetchError } = await supabaseAdmin
      .from('freight_assignment')
      .select('id, pickup_date')
      .or('pickup_date.is.null,pickup_date.lt.' + now.toISOString());

    if (assignmentsFetchError) {
      console.error('[NORMALIZE] Error fetching assignments:', assignmentsFetchError);
    } else if (assignmentsToUpdate && assignmentsToUpdate.length > 0) {
      console.log(`[NORMALIZE] Found ${assignmentsToUpdate.length} assignments to update`);
      
      for (const assignment of assignmentsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('freight_assignment')
          .update({ 
            pickup_date: safePickupISO,
            updated_at: new Date().toISOString()
          })
          .eq('id', assignment.id);

        if (updateError) {
          console.error(`[NORMALIZE] Error updating assignment ${assignment.id}:`, updateError);
        } else {
          console.log(`[NORMALIZE] ✅ Updated assignment ${assignment.id}: ${assignment.pickup_date} → ${safePickupISO}`);
        }
      }
    } else {
      console.log('[NORMALIZE] No assignments to update');
    }

    const summary = {
      freights_updated: freightsToUpdate?.length || 0,
      assignments_updated: assignmentsToUpdate?.length || 0,
      safe_pickup_date: safePickupISO
    };

    console.log('[NORMALIZE] ✅ Normalization complete:', summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Normalização concluída com sucesso',
        summary
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[NORMALIZE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro inesperado na normalização' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
