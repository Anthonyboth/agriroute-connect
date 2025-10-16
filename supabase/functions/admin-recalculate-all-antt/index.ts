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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('[ADMIN-RECALC] Iniciando recálculo de TODOS os fretes ativos');

    // Buscar TODOS os fretes ativos tipo CARGA
    const { data: freights, error: fetchError } = await supabase
      .from('freights')
      .select('id, cargo_type, distance_km, vehicle_axles_required, high_performance, required_trucks, minimum_antt_price')
      .eq('service_type', 'CARGA')
      .in('status', ['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
      .not('distance_km', 'is', null)
      .gt('distance_km', 0);

    if (fetchError) {
      console.error('[ADMIN-RECALC] Erro ao buscar fretes:', fetchError);
      throw fetchError;
    }

    console.log(`[ADMIN-RECALC] Encontrados ${freights?.length || 0} fretes para processar`);

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

        console.log(`[ADMIN-RECALC] Processando frete ${freight.id}: ${freight.cargo_type} -> ${anttCategory}`);

        // Buscar taxa ANTT
        const { data: rates, error: rateError } = await supabase
          .from('antt_rates')
          .select('rate_per_km, fixed_charge')
          .eq('table_type', tableType)
          .eq('cargo_category', anttCategory)
          .eq('axles', axles)
          .maybeSingle();

        if (rateError) {
          console.error(`[ADMIN-RECALC] Erro ao buscar taxa ANTT para frete ${freight.id}:`, rateError);
        }

        let ratePerKm: number, fixedCharge: number;

        if (rates) {
          ratePerKm = rates.rate_per_km;
          fixedCharge = rates.fixed_charge;
        } else {
          // Fallback para Carga Geral
          console.log(`[ADMIN-RECALC] Usando fallback Carga Geral para frete ${freight.id}`);
          const { data: fallback, error: fallbackError } = await supabase
            .from('antt_rates')
            .select('rate_per_km, fixed_charge')
            .eq('table_type', tableType)
            .eq('cargo_category', 'Carga Geral')
            .eq('axles', axles)
            .maybeSingle();

          if (fallbackError || !fallback) {
            console.error(`[ADMIN-RECALC] Sem fallback para frete ${freight.id}`);
            results.skipped++;
            continue;
          }
          ratePerKm = fallback.rate_per_km;
          fixedCharge = fallback.fixed_charge;
        }

        // Calcular ANTT POR CARRETA
        const anttPerTruck = parseFloat(
          ((ratePerKm * freight.distance_km) + fixedCharge).toFixed(2)
        );

        console.log(`[ADMIN-RECALC] Frete ${freight.id}: ANTT calculado = R$ ${anttPerTruck}`);

        // Atualizar frete
        const { error: updateError } = await supabase
          .from('freights')
          .update({
            minimum_antt_price: anttPerTruck,
            updated_at: new Date().toISOString()
          })
          .eq('id', freight.id);

        if (updateError) {
          console.error(`[ADMIN-RECALC] Erro ao atualizar frete ${freight.id}:`, updateError);
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
        console.error(`[ADMIN-RECALC] Erro no frete ${freight.id}:`, error);
        results.errors++;
      }
    }

    console.log('[ADMIN-RECALC] Finalizado:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ADMIN-RECALC] Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
