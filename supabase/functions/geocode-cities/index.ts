import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Geocoding gratuito via Nominatim (OpenStreetMap) - sem API key necessária
async function geocodeCity(cityName: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = `${cityName}, ${state}, Brazil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AgriRoute/1.0' }
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (results.length > 0) {
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    }
  } catch (e) {
    console.warn(`Geocoding failed for ${cityName}:`, e);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { limit = 10 } = await req.json().catch(() => ({}));
    
    console.log(`Buscando até ${limit} cidades sem coordenadas (usando Nominatim/OSM)...`);
    
    // Buscar cidades sem coordenadas
    const { data: cities, error: fetchError } = await supabaseClient
      .rpc('cities_needing_geocoding');
    
    if (fetchError) throw new Error(`Erro ao buscar cidades: ${fetchError.message}`);

    if (!cities || cities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Todas as cidades já possuem coordenadas', geocoded: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const citiesToGeocode = cities.slice(0, limit);
    console.log(`Processando ${citiesToGeocode.length} cidades`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const city of citiesToGeocode) {
      try {
        const coords = await geocodeCity(city.name, city.state);
        
        if (coords) {
          const { error: updateError } = await supabaseClient
            .from('cities')
            .update({ lat: coords.lat, lng: coords.lng })
            .eq('id', city.id);
          
          if (updateError) {
            console.error(`Erro ao atualizar ${city.name}:`, updateError);
            errorCount++;
          } else {
            console.log(`✓ ${city.name}, ${city.state} geocodificada: ${coords.lat}, ${coords.lng}`);
            successCount++;
          }
        } else {
          console.warn(`Geocoding falhou para ${city.name}, ${city.state}`);
          errorCount++;
        }
        
        // Delay para respeitar rate limits do Nominatim (1 req/s)
        await new Promise(resolve => setTimeout(resolve, 1100));
      } catch (error) {
        console.error(`Erro ao geocodificar ${city.name}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Geocoding concluído: ${successCount} sucessos, ${errorCount} erros`);
    
    return new Response(
      JSON.stringify({ success: true, geocoded: successCount, errors: errorCount, total_processed: citiesToGeocode.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Erro ao geocodificar cidades:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
