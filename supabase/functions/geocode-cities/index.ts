import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY não configurada');
    }

    console.log(`Buscando até ${limit} cidades sem coordenadas...`);
    
    // Buscar cidades sem coordenadas
    const { data: cities, error: fetchError } = await supabaseClient
      .rpc('cities_needing_geocoding');
    
    if (fetchError) {
      throw new Error(`Erro ao buscar cidades: ${fetchError.message}`);
    }

    if (!cities || cities.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Todas as cidades já possuem coordenadas',
          geocoded: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const citiesToGeocode = cities.slice(0, limit);
    console.log(`Processando ${citiesToGeocode.length} cidades`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const city of citiesToGeocode) {
      try {
        const address = `${city.name}, ${city.state}, Brasil`;
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
        
        const response = await fetch(geocodeUrl);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          
          const { error: updateError } = await supabaseClient
            .from('cities')
            .update({ 
              lat: location.lat, 
              lng: location.lng 
            })
            .eq('id', city.id);
          
          if (updateError) {
            console.error(`Erro ao atualizar ${city.name}:`, updateError);
            errorCount++;
          } else {
            console.log(`✓ ${city.name}, ${city.state} geocodificada`);
            successCount++;
          }
          
          // Delay para respeitar rate limits do Google Maps API
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          console.warn(`Geocoding falhou para ${city.name}, ${city.state}: ${data.status}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Erro ao geocodificar ${city.name}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Geocoding concluído: ${successCount} sucessos, ${errorCount} erros`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        geocoded: successCount,
        errors: errorCount,
        total_processed: citiesToGeocode.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Erro ao geocodificar cidades:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
