import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
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
  geocoding_source?: { origin: string; destination: string };
}

// Fórmula de Haversine para calcular distância entre duas coordenadas
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

function normalizeCity(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Buscar coordenadas no banco (tabela cities) via Supabase
async function getCoordsFromDB(cityName: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const cleanCity = cityName.trim();
    const cleanState = state.trim().toUpperCase();
    
    const { data, error } = await supabase
      .from('cities')
      .select('lat, lng')
      .ilike('name', cleanCity)
      .eq('state', cleanState)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(1)
      .single();

    if (!error && data?.lat && data?.lng) {
      console.log(`[CALCULATE-ROUTE] DB coords found for ${cleanCity}/${cleanState}: ${data.lat}, ${data.lng}`);
      return { lat: data.lat, lng: data.lng };
    }
  } catch (e) {
    console.warn('[CALCULATE-ROUTE] DB lookup failed:', e);
  }
  return null;
}

// Geocodificar via OpenStreetMap Nominatim (fallback)
async function geocodeViaNominatim(cityName: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = `${cityName}, ${state}, Brazil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
    
    console.log(`[CALCULATE-ROUTE] Nominatim geocoding: "${query}"`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AgriRoute/1.0 (freight-routing)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!response.ok) {
      console.warn(`[CALCULATE-ROUTE] Nominatim HTTP ${response.status}`);
      return null;
    }

    const results = await response.json();
    if (results && results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        console.log(`[CALCULATE-ROUTE] Nominatim found: ${lat}, ${lng} for "${query}"`);
        
        // Salvar no banco para futuras consultas
        await saveCoordsToDBAsync(cityName, state, lat, lng);
        
        return { lat, lng };
      }
    }
    console.warn(`[CALCULATE-ROUTE] Nominatim: no results for "${query}"`);
  } catch (e) {
    console.warn('[CALCULATE-ROUTE] Nominatim geocoding failed:', e);
  }
  return null;
}

// Salvar coordenadas geocodificadas no banco (fire-and-forget)
async function saveCoordsToDBAsync(cityName: string, state: string, lat: number, lng: number): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const cleanCity = cityName.trim();
    const cleanState = state.trim().toUpperCase();

    const { error } = await supabase
      .from('cities')
      .update({ lat, lng, updated_at: new Date().toISOString() })
      .ilike('name', cleanCity)
      .eq('state', cleanState)
      .is('lat', null);

    if (!error) {
      console.log(`[CALCULATE-ROUTE] Saved coords to DB for ${cleanCity}/${cleanState}: ${lat}, ${lng}`);
    }
  } catch (e) {
    console.warn('[CALCULATE-ROUTE] Failed to save coords to DB:', e);
  }
}

// Extrair cidade e estado do formato "Cidade, UF" ou "Cidade/UF" ou "Cidade — UF"
function parseCityState(address: string): { city: string; state: string } | null {
  // Formato: "Cidade — UF"
  const dashParts = address.split('—').map(s => s.trim());
  if (dashParts.length >= 2) {
    return { city: dashParts[0], state: dashParts[dashParts.length - 1] };
  }
  // Formato: "Cidade, UF"
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[parts.length - 1] };
  }
  // Formato: "Cidade/UF"
  const slashParts = address.split('/').map(s => s.trim());
  if (slashParts.length >= 2) {
    return { city: slashParts[0], state: slashParts[slashParts.length - 1] };
  }
  return null;
}

// Resolver coordenadas: 1) banco de dados, 2) Nominatim (OSM), 3) null
async function resolveCoords(address: string): Promise<{ lat: number; lng: number; source: string } | null> {
  const parsed = parseCityState(address);
  
  // 1. Tentar buscar no banco
  if (parsed) {
    const dbCoords = await getCoordsFromDB(parsed.city, parsed.state);
    if (dbCoords) return { ...dbCoords, source: 'database' };
  }

  // 2. Tentar Nominatim (OpenStreetMap) - geocodificação real
  if (parsed) {
    const nominatimCoords = await geocodeViaNominatim(parsed.city, parsed.state);
    if (nominatimCoords) return { ...nominatimCoords, source: 'nominatim' };
  }

  // 3. Tentar Nominatim com o endereço completo
  const fullNominatim = await geocodeViaNominatim(address, 'Brasil');
  if (fullNominatim) return { ...fullNominatim, source: 'nominatim_full' };

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const { origin, destination } = validateInput(RouteRequestSchema, rawBody);
    
    console.log('[CALCULATE-ROUTE] Calculating route from', origin, 'to', destination);

    // Resolver coordenadas de origem e destino
    const originCoords = await resolveCoords(origin);
    const destCoords = await resolveCoords(destination);

    let distance_km: number;
    const geocodingSource = {
      origin: originCoords?.source || 'not_found',
      destination: destCoords?.source || 'not_found',
    };

    if (originCoords && destCoords) {
      const haversine = calculateHaversineDistance(
        originCoords.lat, originCoords.lng,
        destCoords.lat, destCoords.lng
      );
      // Fator de correção rodoviário (1.3x para estradas brasileiras)
      distance_km = Math.round(haversine * 1.3);
      console.log(`[CALCULATE-ROUTE] Haversine: ${haversine.toFixed(2)} km, Road estimate: ${distance_km} km (sources: ${geocodingSource.origin}, ${geocodingSource.destination})`);
    } else {
      // ERRO: Não conseguiu resolver coordenadas - retornar erro em vez de valor fixo falso
      console.error(`[CALCULATE-ROUTE] FAILED to resolve coordinates. Origin: ${originCoords ? 'OK' : 'MISSING'}, Dest: ${destCoords ? 'OK' : 'MISSING'}`);
      return new Response(JSON.stringify({
        error: 'Não foi possível calcular a distância',
        details: `Coordenadas não encontradas: ${!originCoords ? 'origem' : ''}${!originCoords && !destCoords ? ' e ' : ''}${!destCoords ? 'destino' : ''}`,
        distance_km: 0,
        duration_hours: 0,
        toll_cost: 0,
        fuel_cost: 0,
        route_points: [],
        is_simulation: true,
        geocoding_failed: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const duration_hours = Math.round((distance_km / 80) * 10) / 10;
    const toll_cost = Math.round(distance_km * 0.20 * 100) / 100;
    const fuel_cost = Math.round((distance_km / 3.5) * 6.50 * 100) / 100;

    const response: RouteResponse = {
      distance_km,
      duration_hours,
      toll_cost,
      fuel_cost,
      route_points: [],
      is_simulation: true,
      geocoding_source: geocodingSource,
    };

    console.log('[CALCULATE-ROUTE] Result:', response);

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
