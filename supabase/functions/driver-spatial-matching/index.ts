import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const logStep = (step: string, details?: unknown) => {
  try {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[DRIVER-SPATIAL-MATCHING] ${step}${detailsStr}`);
  } catch {
    console.log(`[DRIVER-SPATIAL-MATCHING] ${step}`);
  }
};

// Haversine distance in meters
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type MatchType = 'SPATIAL_RADIUS' | 'CITY_MATCH';

function normStr(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function normState(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userRes } = await supabase.auth.getUser(token);
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get driver profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, role, active_mode')
      .eq('user_id', user.id)
      .single();

    if (profErr || !profile) {
      console.error('❌ Profile not found for user:', user.id, profErr);
      return new Response(
        JSON.stringify({ error: 'Profile not found', userId: user.id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeMode = (profile as any).active_mode || (profile as any).role;
    const role = String(activeMode || profile.role);

    if (!['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(role)) {
      console.error('❌ Forbidden role:', role, 'for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden role', role }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const driverId = profile.id as string;

    // Helper: fetch existing matches with joined items
    const fetchResults = async () => {
      // Freight matches
      const { data: freightMatches, error: fmErr } = await supabase
        .from('freight_matches')
        .select('id, match_type, distance_m, created_at, freight_id, freight:freights(*)')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (fmErr) throw fmErr;

      const freights = (freightMatches || [])
        .map((m: any) => m.freight)
        .filter((f: any) => f && f.status === 'OPEN');

      // Service request matches
      const { data: srMatches, error: srmErr } = await supabase
        .from('service_request_matches')
        .select('id, match_type, distance_m, created_at, service_request_id, service_request:service_requests(*)')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (srmErr) throw srmErr;

      const service_requests = (srMatches || [])
        .map((m: any) => m.service_request)
        .filter((sr: any) => sr && sr.status === 'OPEN');

      return {
        matches: {
          freight_matches: freightMatches || [],
          service_request_matches: srMatches || [],
        },
        freights,
        service_requests,
      };
    };

    if (req.method === 'GET') {
      const result = await fetchResults();
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep("Starting driver spatial matching", { driverId, role });

    // 1) Fetch user_cities (both origin and destination types)
    const { data: areas, error: areasErr } = await supabase
      .from('user_cities')
      .select('id, city_id, radius_km, type, is_active, cities(name, state, lat, lng)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('type', ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO']);

    if (areasErr) {
      logStep("Error fetching user cities", areasErr);
      throw areasErr;
    }

    logStep("User cities loaded", { count: areas?.length || 0 });

    // No areas: clear matches and return empty
    if (!areas || areas.length === 0) {
      logStep("No active cities found for driver");
      
      await supabase.from('freight_matches').delete().eq('driver_id', driverId);
      await supabase.from('service_request_matches').delete().eq('driver_id', driverId);

      const result = await fetchResults();
      return new Response(JSON.stringify({ success: true, ...result, note: 'no_active_cities' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Clear previous matches (avoid stale results)
    {
      const { error: delFreightErr } = await supabase.from('freight_matches').delete().eq('driver_id', driverId);
      if (delFreightErr) logStep("Error clearing freight_matches", delFreightErr);

      const { error: delSrErr } = await supabase.from('service_request_matches').delete().eq('driver_id', driverId);
      if (delSrErr) logStep("Error clearing service_request_matches", delSrErr);
    }

    // 3) Fetch FREIGHTS (rural/traditional)
    const FREIGHTS_LIMIT = 200;
    const { data: freights, error: freErr } = await supabase
      .from('freights')
      .select('*')
      .eq('status', 'OPEN')
      .is('driver_id', null)
      .order('created_at', { ascending: false })
      .limit(FREIGHTS_LIMIT);

    if (freErr) {
      logStep("Error fetching freights", freErr);
      throw freErr;
    }

    logStep("Open freights loaded", { count: freights?.length || 0 });

    // 4) Fetch SERVICE_REQUESTS (urban on-demand: FRETE_MOTO, GUINCHO, MUDANCA, etc)
    const SERVICE_TYPES = [
      'FRETE_MOTO',
      'GUINCHO',
      'MUDANCA',
      'PICAPE',
      'FRETE_URBANO',
      'MOTO',
      'GUINCHO_URBANO',
    ];

    const SERVICE_LIMIT = 200;
    const { data: serviceRequests, error: srErr } = await supabase
      .from('service_requests')
      .select('*')
      .eq('status', 'OPEN')
      .is('provider_id', null)
      .in('service_type', SERVICE_TYPES)
      .order('created_at', { ascending: false })
      .limit(SERVICE_LIMIT);

    if (srErr) {
      logStep("Error fetching service_requests", srErr);
      throw srErr;
    }

    logStep("Open service_requests loaded", { count: serviceRequests?.length || 0 });

    // Helper: find best match for an item against driver's areas
    const findBestMatch = (item: {
      lat?: unknown;
      lng?: unknown;
      city_id?: unknown;
      city_name?: unknown;
      state?: unknown;
    }): { bestDistance: number; matchType: MatchType } | null => {
      const itemLat = safeNum(item.lat);
      const itemLng = safeNum(item.lng);
      const itemCityId = item.city_id ? String(item.city_id) : null;
      const itemCityName = normStr(item.city_name);
      const itemState = normState(item.state);

      let bestDistance: number | null = null;
      let matchType: MatchType | null = null;

      for (const a of areas) {
        const city = (a as any).cities;
        const areaLat = safeNum(city?.lat);
        const areaLng = safeNum(city?.lng);
        const radiusKm = safeNum((a as any).radius_km) ?? 50;

        // 1) Spatial radius match (lat/lng)
        if (itemLat !== null && itemLng !== null && areaLat !== null && areaLng !== null) {
          const distance = haversine(itemLat, itemLng, areaLat, areaLng);
          if (distance <= radiusKm * 1000) {
            if (bestDistance === null || distance < bestDistance) {
              bestDistance = distance;
              matchType = 'SPATIAL_RADIUS';
            }
          }
          continue;
        }

        // 2) Fallback: city_id match
        if (itemCityId && (a as any).city_id) {
          if (String((a as any).city_id) === itemCityId) {
            bestDistance = 0;
            matchType = 'CITY_MATCH';
            break;
          }
        }

        // 3) Fallback: city_name + state match
        const areaCityName = normStr(city?.name);
        const areaState = normState(city?.state);
        if (itemCityName && areaCityName && itemCityName === areaCityName) {
          if (!itemState || !areaState || itemState === areaState) {
            bestDistance = 0;
            matchType = 'CITY_MATCH';
            break;
          }
        }
      }

      if (bestDistance === null || !matchType) return null;
      return { bestDistance, matchType };
    };

    // 5) Generate upserts for freight_matches
    const freightUpserts: any[] = [];
    for (const f of freights || []) {
      const originLat = safeNum((f as any).origin_lat ?? (f as any).originLat ?? (f as any).origin_location_lat);
      const originLng = safeNum((f as any).origin_lng ?? (f as any).originLng ?? (f as any).origin_location_lng);
      const originCityId = (f as any).origin_city_id ?? null;
      const originCityName = (f as any).origin_city ?? null;
      const originState = (f as any).origin_state ?? null;

      const match = findBestMatch({
        lat: originLat,
        lng: originLng,
        city_id: originCityId,
        city_name: originCityName,
        state: originState,
      });

      if (!match) continue;

      const distance_m = Math.round(match.bestDistance);
      const match_score = match.matchType === 'SPATIAL_RADIUS'
        ? Math.max(0.1, 1 - distance_m / (50 * 1000))
        : 1;

      freightUpserts.push({
        freight_id: (f as any).id,
        driver_id: driverId,
        driver_area_id: null,
        match_type: match.matchType,
        distance_m,
        match_score,
      });
    }

    // 6) Generate upserts for service_request_matches
    const srUpserts: any[] = [];
    for (const sr of serviceRequests || []) {
      const lat = safeNum((sr as any).location_lat) ?? safeNum((sr as any).lat) ?? safeNum((sr as any).latitude);
      const lng = safeNum((sr as any).location_lng) ?? safeNum((sr as any).lng) ?? safeNum((sr as any).longitude);
      const cityId = (sr as any).city_id ?? null;
      const cityName = (sr as any).city_name ?? (sr as any).city ?? null;
      const state = (sr as any).state ?? (sr as any).uf ?? null;

      const match = findBestMatch({
        lat,
        lng,
        city_id: cityId,
        city_name: cityName,
        state,
      });

      if (!match) continue;

      const distance_m = Math.round(match.bestDistance);
      const match_score = match.matchType === 'SPATIAL_RADIUS'
        ? Math.max(0.1, 1 - distance_m / (50 * 1000))
        : 1;

      srUpserts.push({
        service_request_id: (sr as any).id,
        driver_id: driverId,
        match_type: match.matchType,
        distance_m,
        match_score,
      });
    }

    logStep("Computed upserts", {
      freight_matches_to_upsert: freightUpserts.length,
      service_request_matches_to_upsert: srUpserts.length,
    });

    // 7) Persist upserts (batch with fallback to individual)
    const upsertBatch = async (table: string, rows: any[], onConflict: string) => {
      if (!rows.length) return { ok: 0, err: 0 };

      const { error } = await supabase.from(table).upsert(rows, { onConflict });
      if (!error) return { ok: rows.length, err: 0 };

      logStep(`Batch upsert failed for ${table}, fallback to individual`, { error });

      let ok = 0;
      let errCount = 0;
      for (const row of rows) {
        const { error: oneErr } = await supabase.from(table).upsert(row, { onConflict });
        if (oneErr) errCount++;
        else ok++;
      }
      return { ok, err: errCount };
    };

    const freightRes = await upsertBatch('freight_matches', freightUpserts, 'freight_id,driver_id');
    const srRes = await upsertBatch('service_request_matches', srUpserts, 'service_request_id,driver_id');

    logStep("Upserts completed", { freightRes, srRes });

    // 8) Return results
    const result = await fetchResults();

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        created: {
          freight_matches: freightUpserts.length,
          service_request_matches: srUpserts.length,
        },
        processed: {
          freights_checked: (freights || []).length,
          service_requests_checked: (serviceRequests || []).length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('driver-spatial-matching error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
