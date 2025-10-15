import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DRIVER-SPATIAL-MATCHING] ${step}${detailsStr}`);
};

// Haversine distance in meters
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
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
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profErr || !profile || profile.role !== 'MOTORISTA') {
      return new Response(JSON.stringify({ error: 'Driver profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const driverId = profile.id as string;

    // Helper: fetch existing matches with joined freights
    const fetchMatches = async () => {
      const { data: matches, error } = await supabase
        .from('freight_matches')
        .select(`id, match_type, distance_m, created_at, freight_id,
                 freight:freights(*)`)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter only OPEN freights in case status changed
      const freights = (matches || [])
        .map((m: any) => m.freight)
        .filter((f: any) => f && f.status === 'OPEN');

      return { matches: matches || [], freights };
    };

    if (req.method === 'GET') {
      const result = await fetchMatches();
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      logStep("Starting driver spatial matching", { driverId });
      
      // Build/refresh matches based on user_cities
      const { data: areas, error: areasErr } = await supabase
        .from('user_cities')
        .select('*, cities(name, state, lat, lng)')
        .eq('user_id', user.id)
        .eq('type', 'MOTORISTA_ORIGEM')
        .eq('is_active', true);

      if (areasErr) {
        logStep("Error fetching user cities", areasErr);
        throw areasErr;
      }

      logStep("User cities found", { count: areas?.length || 0 });

      // No areas: nothing to match
      if (!areas || areas.length === 0) {
        logStep("No active cities found for driver");
        const result = await fetchMatches();
        return new Response(JSON.stringify({ success: true, ...result, note: 'no_active_cities' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch recent open freights (with or without coordinates)
      const { data: freights, error: freErr } = await supabase
        .from('freights')
        .select('*')
        .eq('status', 'OPEN')
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (freErr) {
        logStep("Error fetching freights", freErr);
        throw freErr;
      }

      logStep("Open freights found", { count: freights?.length || 0 });

      const toUpsert: any[] = [];
      let matchesFound = 0;

      for (const f of freights || []) {
        const { origin_lat: flat, origin_lng: flng, origin_city, origin_state } = f as any;

        let bestDistance: number | null = null;
        let matchingArea: any = null;
        let matchType: 'SPATIAL_RADIUS' | 'CITY_MATCH' | null = null;

        for (const a of areas) {
          const cityData = (a as any).cities;
          const areaLat = cityData?.lat ? Number(cityData.lat) : null;
          const areaLng = cityData?.lng ? Number(cityData.lng) : null;
          const radiusKm = Number(a.radius_km || 50);

          if (typeof flat === 'number' && typeof flng === 'number' &&
              areaLat !== null && areaLng !== null && !isNaN(radiusKm)) {
            const distance = haversine(flat, flng, areaLat, areaLng);
            const within = distance <= radiusKm * 1000; // km -> m
            if (within) {
              if (bestDistance === null || distance < bestDistance) {
                bestDistance = distance;
                matchingArea = a;
                matchType = 'SPATIAL_RADIUS';
              }
            }
          } else if (cityData) {
            // Fallback: match by city_id
            if (origin_city && cityData.name && String(origin_city).toLowerCase() === String(cityData.name).toLowerCase()) {
              const sameState = !origin_state || String(origin_state).toLowerCase() === String(cityData.state || '').toLowerCase();
              if (sameState) {
                bestDistance = 0;
                matchingArea = a;
                matchType = 'CITY_MATCH';
                break;
              }
            }
          }
        }

        if (bestDistance !== null && matchingArea && matchType) {
          matchesFound++;
        toUpsert.push({
          freight_id: f.id,
          driver_id: driverId,
          // Evitar violação de FK: não referenciar driver_service_areas aqui
          driver_area_id: null,
          match_type: matchType,
          distance_m: bestDistance ? Math.round(bestDistance) : 0,
          match_score: matchType === 'SPATIAL_RADIUS'
            ? Math.max(0.1, 1 - (bestDistance / (Number(matchingArea.radius_km) * 1000)))
            : 1
        });
        }
      }

      logStep("Matches to upsert", { count: toUpsert.length, matchesFound });

      if (toUpsert.length > 0) {
        // Use individual insert to handle conflicts gracefully
        let successCount = 0;
        let errorCount = 0;
        
        for (const match of toUpsert) {
          try {
            const { error: insertErr } = await supabase
              .from('freight_matches')
              .upsert(match, { onConflict: 'freight_id,driver_id', ignoreDuplicates: false });
            
            if (insertErr) {
              logStep("Individual match upsert error", { match, error: insertErr });
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            logStep("Match insertion failed", { match, error: err });
            errorCount++;
          }
        }
        
        logStep("Matches processing complete", { successCount, errorCount });
      }

      const result = await fetchMatches();
      logStep("Spatial matching complete", { 
        totalMatches: result.matches.length, 
        activeFreights: result.freights.length 
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        ...result, 
        created: toUpsert.length,
        processed: matchesFound
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('driver-spatial-matching error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
