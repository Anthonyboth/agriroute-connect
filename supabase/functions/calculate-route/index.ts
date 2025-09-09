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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin, destination }: RouteRequest = await req.json();
    
    console.log('Calculating route from', origin, 'to', destination);

    // Simulação realística de cálculo de distância e custos
    const distance_km = Math.floor(Math.random() * 800) + 200; // 200-1000km
    const duration_hours = Math.round((distance_km / 80) * 10) / 10; // ~80km/h média
    
    // Cálculo de pedágios baseado na distância (R$ 0,15-0,25 por km)
    const toll_rate = 0.20;
    const toll_cost = Math.round(distance_km * toll_rate * 100) / 100;
    
    // Cálculo de combustível (consumo ~3.5km/l, diesel ~R$ 6,50/l)
    const fuel_consumption = 3.5; // km/l
    const fuel_price = 6.50; // R$/l
    const fuel_cost = Math.round((distance_km / fuel_consumption) * fuel_price * 100) / 100;
    
    // Simular pontos da rota
    const route_points = [
      { lat: -23.5505 + (Math.random() - 0.5) * 0.1, lng: -46.6333 + (Math.random() - 0.5) * 0.1 },
      { lat: -23.5505 + (Math.random() - 0.5) * 2, lng: -46.6333 + (Math.random() - 0.5) * 2 },
      { lat: -23.5505 + (Math.random() - 0.5) * 4, lng: -46.6333 + (Math.random() - 0.5) * 4 },
    ];

    const response: RouteResponse = {
      distance_km,
      duration_hours,
      toll_cost,
      fuel_cost,
      route_points
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});