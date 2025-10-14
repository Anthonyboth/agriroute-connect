import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de cargo_type para categoria ANTT
const CARGO_TO_ANTT_CATEGORY: Record<string, string> = {
  'graos_soja': 'Granel sólido',
  'graos_milho': 'Granel sólido',
  'graos_trigo': 'Granel sólido',
  'graos_arroz': 'Granel sólido',
  'adubo_fertilizante': 'Granel sólido',
  'sementes_bags': 'Neogranel',
  'defensivos_agricolas': 'Perigosa (carga geral)',
  'combustivel': 'Granel líquido',
  'calcario': 'Granel sólido',
  'farelo_soja': 'Granel sólido',
  'racao_animal': 'Carga Geral',
  'fardos_algodao': 'Carga Geral',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    console.log(`[RECALC] Starting recalculation for producer ${profile.id}`);

    // Fetch recent open freights for this producer
    const { data: freights, error: freightError } = await supabase
      .from('freights')
      .select('id, cargo_type, distance_km, vehicle_axles_required, high_performance, minimum_antt_price')
      .eq('producer_id', profile.id)
      .eq('service_type', 'CARGA')
      .in('status', ['OPEN', 'ACCEPTED', 'IN_TRANSIT'])
      .gte('created_at', new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()) // Last 120 days
      .order('created_at', { ascending: false });

    if (freightError) {
      throw freightError;
    }

    console.log(`[RECALC] Found ${freights?.length || 0} freights to process`);

    const results = [];
    
    for (const freight of freights || []) {
      try {
        // Determine ANTT category
        const anttCategory = CARGO_TO_ANTT_CATEGORY[freight.cargo_type] || 'Carga Geral';
        
        // Determine table_type: 'C' if high_performance, else 'A'
        const tableType = freight.high_performance ? 'C' : 'A';
        
        // Determine axles (default to 5 if not set)
        const axles = freight.vehicle_axles_required || 5;
        
        // Get distance
        const distanceKm = freight.distance_km;
        
        if (!distanceKm || distanceKm <= 0) {
          console.log(`[RECALC] Skipping freight ${freight.id} - no valid distance`);
          results.push({
            freight_id: freight.id,
            status: 'skipped',
            reason: 'no_distance'
          });
          continue;
        }

        // Look up ANTT rates
        const { data: rates } = await supabase
          .from('antt_rates')
          .select('rate_per_km, fixed_charge, cargo_category')
          .eq('table_type', tableType)
          .eq('cargo_category', anttCategory)
          .eq('axles', axles)
          .maybeSingle();

        let ratePerKm: number;
        let fixedCharge: number;
        let usedCategory = anttCategory;

        if (rates) {
          ratePerKm = rates.rate_per_km;
          fixedCharge = rates.fixed_charge;
        } else {
          // Fallback to 'Carga Geral' if specific category not found
          console.log(`[RECALC] Freight ${freight.id} - Fallback to Carga Geral`);
          const { data: fallbackRates } = await supabase
            .from('antt_rates')
            .select('rate_per_km, fixed_charge')
            .eq('table_type', tableType)
            .eq('cargo_category', 'Carga Geral')
            .eq('axles', axles)
            .maybeSingle();

          if (!fallbackRates) {
            console.log(`[RECALC] Freight ${freight.id} - No rates found, skipping`);
            results.push({
              freight_id: freight.id,
              status: 'skipped',
              reason: 'no_rates'
            });
            continue;
          }

          ratePerKm = fallbackRates.rate_per_km;
          fixedCharge = fallbackRates.fixed_charge;
          usedCategory = 'Carga Geral';
        }

        // Calculate official minimum: (rate_per_km × distance_km) + fixed_charge
        const officialMinimum = parseFloat(
          ((ratePerKm * distanceKm) + fixedCharge).toFixed(2)
        );

        // Update freight
        const { error: updateError } = await supabase
          .from('freights')
          .update({
            minimum_antt_price: officialMinimum,
            updated_at: new Date().toISOString()
          })
          .eq('id', freight.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`[RECALC] Updated freight ${freight.id}: ${freight.minimum_antt_price} → ${officialMinimum}`);
        
        results.push({
          freight_id: freight.id,
          status: 'updated',
          old_minimum: freight.minimum_antt_price,
          new_minimum: officialMinimum,
          parameters: {
            category: usedCategory,
            table_type: tableType,
            axles,
            distance_km: distanceKm,
            rate_per_km: ratePerKm,
            fixed_charge: fixedCharge,
            formula: `(${ratePerKm} × ${distanceKm}) + ${fixedCharge} = ${officialMinimum}`
          }
        });

      } catch (error) {
        console.error(`[RECALC] Error processing freight ${freight.id}:`, error);
        results.push({
          freight_id: freight.id,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`[RECALC] Completed: ${results.filter(r => r.status === 'updated').length} updated, ${results.filter(r => r.status === 'skipped').length} skipped, ${results.filter(r => r.status === 'error').length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: freights?.length || 0,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[RECALC] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
