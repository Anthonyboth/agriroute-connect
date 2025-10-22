import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CARGO_TO_ANTT: Record<string, string> = {
  'graos_soja': 'Granel sólido',
  'graos_milho': 'Granel sólido',
  'graos_trigo': 'Granel sólido',
  'graos_arroz': 'Granel sólido',
  'adubo_fertilizante': 'Granel sólido',
  'calcario': 'Granel sólido',
  'farelo_soja': 'Granel sólido',
  'sementes_bags': 'Neogranel',
  'defensivos_agricolas': 'Perigosa (carga geral)',
  'combustivel': 'Granel líquido',
  'racao_animal': 'Carga Geral',
  'fardos_algodao': 'Carga Geral',
  'GRAOS_SOJA': 'Granel sólido',
  'GRAOS_MILHO': 'Granel sólido',
  'GRAOS_TRIGO': 'Granel sólido',
  'GRAOS_ARROZ': 'Granel sólido',
  'ADUBO_FERTILIZANTE': 'Granel sólido',
  'CALCARIO': 'Granel sólido',
  'FARELO_SOJA': 'Granel sólido',
  'SEMENTES_BAGS': 'Neogranel',
  'DEFENSIVOS_AGRICOLAS': 'Perigosa (carga geral)',
  'COMBUSTIVEL': 'Granel líquido',
  'RACAO_ANIMAL': 'Carga Geral',
  'FARDOS_ALGODAO': 'Carga Geral',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated and is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      console.error(`[ADMIN-RECALC] Unauthorized access attempt by user: ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const { data: canProceed } = await supabaseClient
      .rpc('check_rate_limit', { 
        endpoint_name: 'admin-recalculate-all-antt',
        max_requests: 2,
        time_window: '01:00:00'
      });

    if (!canProceed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. This operation can only be run twice per hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ADMIN-RECALC] Starting recalculation by admin user: ${user.id}`);

    // Use service role for bulk operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch active CARGA freights
    const { data: freights, error: fetchError } = await supabase
      .from('freights')
      .select('id, cargo_type, distance_km, vehicle_axles_required, high_performance, required_trucks, minimum_antt_price')
      .eq('service_type', 'CARGA')
      .in('status', ['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
      .not('distance_km', 'is', null)
      .gt('distance_km', 0);

    if (fetchError) {
      console.error('[ADMIN-RECALC] Error fetching freights:', fetchError);
      throw fetchError;
    }

    console.log(`[ADMIN-RECALC] Found ${freights?.length || 0} freights to process`);

    const results = {
      total: freights?.length || 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const freight of freights || []) {
      try {
        const anttCategory = CARGO_TO_ANTT[freight.cargo_type] || 'Carga Geral';
        const tableType = freight.high_performance ? 'C' : 'A';
        const axles = freight.vehicle_axles_required || 5;

        const { data: rates, error: rateError } = await supabase
          .from('antt_rates')
          .select('rate_per_km, fixed_charge')
          .eq('table_type', tableType)
          .eq('cargo_category', anttCategory)
          .eq('axles', axles)
          .maybeSingle();

        if (rateError) {
          console.error(`[ADMIN-RECALC] Error fetching rate for freight ${freight.id}:`, rateError);
        }

        let ratePerKm: number, fixedCharge: number;

        if (rates) {
          ratePerKm = rates.rate_per_km;
          fixedCharge = rates.fixed_charge;
        } else {
          // Fallback to Carga Geral
          const { data: fallback } = await supabase
            .from('antt_rates')
            .select('rate_per_km, fixed_charge')
            .eq('table_type', tableType)
            .eq('cargo_category', 'Carga Geral')
            .eq('axles', axles)
            .maybeSingle();

          if (!fallback) {
            results.skipped++;
            continue;
          }
          ratePerKm = fallback.rate_per_km;
          fixedCharge = fallback.fixed_charge;
        }

        const anttPerTruck = parseFloat(
          ((ratePerKm * freight.distance_km) + fixedCharge).toFixed(2)
        );

        const { error: updateError } = await supabase
          .from('freights')
          .update({
            minimum_antt_price: anttPerTruck,
            updated_at: new Date().toISOString()
          })
          .eq('id', freight.id);

        if (updateError) {
          console.error(`[ADMIN-RECALC] Error updating freight ${freight.id}:`, updateError);
          throw updateError;
        }

        results.updated++;
        results.details.push({
          freight_id: freight.id,
          cargo_type: freight.cargo_type,
          old: freight.minimum_antt_price,
          new: anttPerTruck,
          trucks: freight.required_trucks || 1
        });

      } catch (error) {
        console.error(`[ADMIN-RECALC] Error processing freight ${freight.id}:`, error);
        results.errors++;
      }
    }

    // Log audit trail
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        table_name: 'freights',
        operation: 'ADMIN_ANTT_RECALC',
        new_data: results
      });

    console.log('[ADMIN-RECALC] Completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ADMIN-RECALC] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
