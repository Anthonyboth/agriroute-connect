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

interface RouteResponse {
  distance_km: number;
  duration_hours: number;
  toll_cost: number;
  fuel_cost: number;
  route_points: Array<{ lat: number; lng: number }>;
  is_simulation?: boolean;
}

// Fórmula de Haversine para calcular distância entre duas coordenadas
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Coordenadas aproximadas de capitais e cidades brasileiras importantes
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  'são paulo': { lat: -23.5505, lng: -46.6333 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  'belo horizonte': { lat: -19.9167, lng: -43.9345 },
  'brasília': { lat: -15.7801, lng: -47.9292 },
  'salvador': { lat: -12.9714, lng: -38.5014 },
  'fortaleza': { lat: -3.7172, lng: -38.5433 },
  'curitiba': { lat: -25.4284, lng: -49.2733 },
  'recife': { lat: -8.0476, lng: -34.8770 },
  'porto alegre': { lat: -30.0346, lng: -51.2177 },
  'manaus': { lat: -3.1190, lng: -60.0217 },
  'goiânia': { lat: -16.6869, lng: -49.2648 },
  'belém': { lat: -1.4558, lng: -48.4902 },
  'campinas': { lat: -22.9099, lng: -47.0626 },
  'campo grande': { lat: -20.4697, lng: -54.6201 },
  'cuiabá': { lat: -15.6010, lng: -56.0974 },
  'londrina': { lat: -23.3045, lng: -51.1696 },
  'maringá': { lat: -23.4273, lng: -51.9375 },
  'ribeirão preto': { lat: -21.1775, lng: -47.8103 },
  'uberlândia': { lat: -18.9186, lng: -48.2772 },
  'rondonópolis': { lat: -16.4673, lng: -54.6372 },
  'sinop': { lat: -11.8614, lng: -55.5035 },
  'sorriso': { lat: -12.5463, lng: -55.7089 },
  'lucas do rio verde': { lat: -13.0587, lng: -55.9040 },
  'primavera do leste': { lat: -15.5439, lng: -54.2968 },
  'dourados': { lat: -22.2231, lng: -54.8118 },
  'cascavel': { lat: -24.9578, lng: -53.4595 },
  'passo fundo': { lat: -28.2576, lng: -52.4091 },
  'chapecó': { lat: -27.0963, lng: -52.6158 },
  'paranaguá': { lat: -25.5205, lng: -48.5095 },
  'santos': { lat: -23.9608, lng: -46.3336 },
  'vitória': { lat: -20.3155, lng: -40.3128 },
  'florianópolis': { lat: -27.5954, lng: -48.5480 },
  'natal': { lat: -5.7945, lng: -35.2110 },
  'joão pessoa': { lat: -7.1195, lng: -34.8450 },
  'maceió': { lat: -9.6498, lng: -35.7089 },
  'aracaju': { lat: -10.9472, lng: -37.0731 },
  'teresina': { lat: -5.0892, lng: -42.8019 },
  'são luís': { lat: -2.5307, lng: -44.3068 },
  'palmas': { lat: -10.2491, lng: -48.3243 },
  'porto velho': { lat: -8.7612, lng: -63.9004 },
  'rio branco': { lat: -9.9754, lng: -67.8249 },
  'boa vista': { lat: 2.8235, lng: -60.6758 },
  'macapá': { lat: 0.0389, lng: -51.0664 },
};

// Extrair cidade do endereço
function extractCityFromAddress(address: string): string | null {
  const normalizedAddress = address.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  
  for (const city of Object.keys(cityCoordinates)) {
    const normalizedCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedAddress.includes(normalizedCity)) {
      return city;
    }
  }
  
  return null;
}

// Calcular distância usando fallback Haversine com fator rodoviário
function calculateFallbackDistance(origin: string, destination: string): number {
  const originCity = extractCityFromAddress(origin);
  const destinationCity = extractCityFromAddress(destination);
  
  console.log('[CALCULATE-ROUTE] Fallback - Origin city:', originCity, 'Destination city:', destinationCity);
  
  if (originCity && destinationCity && cityCoordinates[originCity] && cityCoordinates[destinationCity]) {
    const originCoords = cityCoordinates[originCity];
    const destCoords = cityCoordinates[destinationCity];
    
    const haversineDistance = calculateHaversineDistance(
      originCoords.lat, originCoords.lng,
      destCoords.lat, destCoords.lng
    );
    
    // Fator de correção rodoviário (1.3 é um fator comum para estradas brasileiras)
    const roadFactor = 1.3;
    const estimatedDistance = Math.round(haversineDistance * roadFactor);
    
    console.log('[CALCULATE-ROUTE] Haversine distance:', haversineDistance.toFixed(2), 'km, Estimated road distance:', estimatedDistance, 'km');
    
    return estimatedDistance;
  }
  
  // Se não encontrou as cidades, usar estimativa baseada em média nacional
  // Distância média entre cidades brasileiras: 400-600km
  console.log('[CALCULATE-ROUTE] Cities not found in database, using average estimate');
  return 450;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const { origin, destination } = validateInput(RouteRequestSchema, rawBody);
    
    console.log('[CALCULATE-ROUTE] Calculating route from', origin, 'to', destination);

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!googleMapsApiKey) {
      console.warn('[CALCULATE-ROUTE] Google Maps API key not configured, using Haversine fallback');
      
      // PROBLEMA 7 CORRIGIDO: Usar Haversine em vez de valor aleatório
      const distance_km = calculateFallbackDistance(origin, destination);
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
    
    console.log('[CALCULATE-ROUTE] Google API response status:', googleData.status);
    
    // If Google Maps API returns an error, use Haversine fallback
    if (googleData.status !== 'OK' || !googleData.rows?.[0]?.elements?.[0]) {
      console.warn('[CALCULATE-ROUTE] Google Maps API error, using Haversine fallback. Status:', googleData.status, 'Error:', googleData.error_message);
      
      const distance_km = calculateFallbackDistance(origin, destination);
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
    
    // If the specific route element has an error, use Haversine fallback
    if (element.status !== 'OK') {
      console.warn('[CALCULATE-ROUTE] Element status error, using Haversine fallback. Element status:', element.status);
      
      const distance_km = calculateFallbackDistance(origin, destination);
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
      route_points: [],
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
