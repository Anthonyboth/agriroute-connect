import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteRequest {
  origin: string;
  destination: string;
}

interface RouteResponse {
  distance_km: number;
  duration_hours: number;
  toll_cost: number;
  fuel_cost: number;
  route_points: Array<{ lat: number; lng: number }>;
  is_simulation?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination }: RouteRequest = await req.json();
    
    console.log('[CALCULATE-ROUTE] Calculating route from', origin, 'to', destination);

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!googleMapsApiKey) {
      console.warn('[CALCULATE-ROUTE] Google Maps API key not configured, using fallback simulation');
      // Fallback: simulação quando API não disponível
      const distance_km = Math.floor(Math.random() * 800) + 200;
      const duration_hours = Math.round((distance_km / 80) * 10) / 10;
      const toll_cost = Math.round(distance_km * 0.20 * 100) / 100;
      const fuel_cost = Math.round((distance_km / 3.5) * 6.50 * 100) / 100;
      
      return new Response(JSON.stringify({
        distance_km,
        duration_hours,
        toll_cost,
        fuel_cost,
        route_points: [],
        is_simulation: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Usar Google Maps Distance Matrix API
    const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&language=pt-BR`;
    
    console.log('[CALCULATE-ROUTE] Calling Google Maps Distance Matrix API');
    const googleResponse = await fetch(distanceMatrixUrl);
    
    if (!googleResponse.ok) {
      throw new Error(`Google Maps API error: ${googleResponse.status}`);
    }
    
    const googleData = await googleResponse.json();
    
    if (googleData.status !== 'OK' || !googleData.rows?.[0]?.elements?.[0]) {
      console.error('[CALCULATE-ROUTE] Invalid response from Google Maps:', googleData);
      throw new Error(`Google Maps API returned status: ${googleData.status}`);
    }
    
    const element = googleData.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      console.error('[CALCULATE-ROUTE] Element status error:', element.status);
      throw new Error(`Route calculation failed: ${element.status}`);
    }
    
    // Extrair distância e duração reais
    const distance_km = Math.round((element.distance.value / 1000) * 100) / 100; // metros para km
    const duration_hours = Math.round((element.duration.value / 3600) * 10) / 10; // segundos para horas
    
    // Calcular custos estimados
    const toll_rate = 0.20; // R$ 0.20 por km (estimativa)
    const toll_cost = Math.round(distance_km * toll_rate * 100) / 100;
    
    const fuel_consumption = 3.5; // km/l
    const fuel_price = 6.50; // R$/l
    const fuel_cost = Math.round((distance_km / fuel_consumption) * fuel_price * 100) / 100;
    
    console.log('[CALCULATE-ROUTE] Route calculated successfully:', {
      distance_km,
      duration_hours,
      toll_cost,
      fuel_cost
    });

    const response: RouteResponse = {
      distance_km,
      duration_hours,
      toll_cost,
      fuel_cost,
      route_points: [], // Pode adicionar Directions API depois se necessário
      is_simulation: false
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});