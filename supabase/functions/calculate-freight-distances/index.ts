import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    console.log('[CALCULATE-FREIGHT-DISTANCES] Starting batch distance calculation');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!googleMapsApiKey) {
      return new Response(JSON.stringify({ 
        error: 'Google Maps API key not configured',
        calculated: 0,
        failed: 0,
        skipped: 0
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar fretes sem distância, limitando a 50 por vez
    const { data: freights, error: fetchError } = await supabase
      .from('freights')
      .select('id, origin_address, destination_address, origin_lat, origin_lng, destination_lat, destination_lng, status')
      .or('distance_km.is.null,distance_km.eq.0')
      .not('origin_lat', 'is', null)
      .not('destination_lat', 'is', null)
      .order('status', { ascending: true }) // Priorizar OPEN
      .limit(50);

    if (fetchError) {
      console.error('[CALCULATE-FREIGHT-DISTANCES] Error fetching freights:', fetchError);
      throw fetchError;
    }

    if (!freights || freights.length === 0) {
      console.log('[CALCULATE-FREIGHT-DISTANCES] No freights found needing distance calculation');
      return new Response(JSON.stringify({
        calculated: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        message: 'No freights found needing distance calculation'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CALCULATE-FREIGHT-DISTANCES] Found ${freights.length} freights to process`);

    const result: CalculationResult = {
      calculated: 0,
      failed: 0,
      skipped: 0,
      total: freights.length,
      details: []
    };

    // Processar cada frete
    for (const freight of freights) {
      try {
        // Validar coordenadas
        if (!freight.origin_lat || !freight.origin_lng || !freight.destination_lat || !freight.destination_lng) {
          console.log(`[CALCULATE-FREIGHT-DISTANCES] Freight ${freight.id} missing coordinates, skipping`);
          result.skipped++;
          result.details.push({
            freight_id: freight.id,
            error: 'Missing coordinates'
          });
          continue;
        }

        // Construir origem e destino como lat,lng
        const origin = `${freight.origin_lat},${freight.origin_lng}`;
        const destination = `${freight.destination_lat},${freight.destination_lng}`;

        // Chamar Google Maps Distance Matrix API
        const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&language=pt-BR`;
        
        const googleResponse = await fetch(distanceMatrixUrl);
        
        if (!googleResponse.ok) {
          throw new Error(`Google Maps API error: ${googleResponse.status}`);
        }
        
        const googleData = await googleResponse.json();
        
        if (googleData.status !== 'OK' || !googleData.rows?.[0]?.elements?.[0]) {
          console.error(`[CALCULATE-FREIGHT-DISTANCES] Invalid response for freight ${freight.id}:`, googleData);
          result.failed++;
          result.details.push({
            freight_id: freight.id,
            error: `API status: ${googleData.status}`
          });
          continue;
        }
        
        const element = googleData.rows[0].elements[0];
        
        if (element.status !== 'OK') {
          console.error(`[CALCULATE-FREIGHT-DISTANCES] Element status error for freight ${freight.id}:`, element.status);
          result.failed++;
          result.details.push({
            freight_id: freight.id,
            error: `Route status: ${element.status}`
          });
          continue;
        }
        
        // Extrair distância em km
        const distance_km = Math.round((element.distance.value / 1000) * 100) / 100;
        
        // Atualizar frete com distância calculada
        const { error: updateError } = await supabase
          .from('freights')
          .update({ distance_km })
          .eq('id', freight.id);
        
        if (updateError) {
          console.error(`[CALCULATE-FREIGHT-DISTANCES] Error updating freight ${freight.id}:`, updateError);
          result.failed++;
          result.details.push({
            freight_id: freight.id,
            error: updateError.message
          });
          continue;
        }
        
        console.log(`[CALCULATE-FREIGHT-DISTANCES] Successfully calculated distance for freight ${freight.id}: ${distance_km} km`);
        result.calculated++;
        result.details.push({
          freight_id: freight.id,
          distance_km
        });
        
        // Pequeno delay para não exceder rate limits da API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`[CALCULATE-FREIGHT-DISTANCES] Error processing freight ${freight.id}:`, error);
        result.failed++;
        result.details.push({
          freight_id: freight.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[CALCULATE-FREIGHT-DISTANCES] Batch calculation complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CALCULATE-FREIGHT-DISTANCES] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      calculated: 0,
      failed: 0,
      skipped: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
