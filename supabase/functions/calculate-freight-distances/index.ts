import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fórmula de Haversine
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface CalculationResult {
  calculated: number;
  failed: number;
  skipped: number;
  total: number;
  details: Array<{
    freight_id: string;
    distance_km?: number;
    error?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CALCULATE-FREIGHT-DISTANCES] Starting batch distance calculation (Haversine)');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar fretes sem distância que possuem coordenadas
    const { data: freights, error: fetchError } = await supabase
      .from('freights')
      .select('id, origin_lat, origin_lng, destination_lat, destination_lng, status')
      .or('distance_km.is.null,distance_km.eq.0')
      .not('origin_lat', 'is', null)
      .not('destination_lat', 'is', null)
      .order('status', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!freights || freights.length === 0) {
      return new Response(JSON.stringify({
        calculated: 0, failed: 0, skipped: 0, total: 0,
        message: 'No freights found needing distance calculation'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[CALCULATE-FREIGHT-DISTANCES] Found ${freights.length} freights to process`);

    const result: CalculationResult = {
      calculated: 0, failed: 0, skipped: 0, total: freights.length, details: []
    };

    for (const freight of freights) {
      try {
        if (!freight.origin_lat || !freight.origin_lng || !freight.destination_lat || !freight.destination_lng) {
          result.skipped++;
          result.details.push({ freight_id: freight.id, error: 'Missing coordinates' });
          continue;
        }

        // Calcular distância usando Haversine + fator rodoviário
        const haversine = calculateHaversineDistance(
          freight.origin_lat, freight.origin_lng,
          freight.destination_lat, freight.destination_lng
        );
        const distance_km = Math.round(haversine * 1.3); // Fator rodoviário

        const { error: updateError } = await supabase
          .from('freights')
          .update({ distance_km })
          .eq('id', freight.id);

        if (updateError) {
          result.failed++;
          result.details.push({ freight_id: freight.id, error: updateError.message });
          continue;
        }

        console.log(`[CALCULATE-FREIGHT-DISTANCES] Freight ${freight.id}: ${distance_km} km`);
        result.calculated++;
        result.details.push({ freight_id: freight.id, distance_km });
      } catch (error) {
        result.failed++;
        result.details.push({ freight_id: freight.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log('[CALCULATE-FREIGHT-DISTANCES] Complete:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CALCULATE-FREIGHT-DISTANCES] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      calculated: 0, failed: 0, skipped: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
