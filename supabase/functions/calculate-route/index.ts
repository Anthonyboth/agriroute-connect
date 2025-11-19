import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { validateInput } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RouteRequestSchema = z.object({
  origin: z.string().min(3, 'Origin must be at least 3 characters').max(500, 'Origin too long'),
  destination: z.string().min(3, 'Destination must be at least 3 characters').max(500, 'Destination too long')
});

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
    const rawBody = await req.json();
    const { origin, destination } = validateInput(RouteRequestSchema, rawBody);
    
    console.log('[CALCULATE-ROUTE] Validatedroute from', origin, 'to', destination);

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
    
    // If Google Maps API returns an error (REQUEST_DENIED, OVER_QUERY_LIMIT, etc.), return simulation
    if (googleData.status !== 'OK' || !googleData.rows?.[0]?.elements?.[0]) {
      console.warn('[CALCULATE-ROUTE] Google Maps API error, using fallback simulation. Status:', googleData.status);
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
    
    const element = googleData.rows[0].elements[0];
    
    // If the specific route element has an error, return simulation
    if (element.status !== 'OK') {
      console.warn('[CALCULATE-ROUTE] Element status error, using fallback simulation. Element status:', element.status);
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