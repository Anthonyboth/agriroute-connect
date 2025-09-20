import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
      // Build/refresh matches based on driver service areas
      const { data: areas, error: areasErr } = await supabase
        .from('driver_service_areas')
        .select('*')
        .eq('driver_id', driverId)
        .eq('is_active', true);

      if (areasErr) throw areasErr;

      // No areas: nothing to match
      if (!areas || areas.length === 0) {
        const result = await fetchMatches();
        return new Response(JSON.stringify({ success: true, ...result, note: 'no_active_areas' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch recent open freights with coordinates
      const { data: freights, error: freErr } = await supabase
        .from('freights')
        .select('*')
        .eq('status', 'OPEN')
        .not('origin_lat', 'is', null)
        .not('origin_lng', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (freErr) throw freErr;

      const toUpsert: any[] = [];
      for (const f of freights || []) {
        const { origin_lat: flat, origin_lng: flng } = f as any;
        if (typeof flat !== 'number' || typeof flng !== 'number') continue;

        let bestDistance: number | null = null;
        for (const a of areas) {
          const d = haversine(flat, flng, Number(a.lat), Number(a.lng));
          const within = d <= Number(a.radius_km) * 1000;
          if (within) {
            bestDistance = bestDistance === null ? d : Math.min(bestDistance, d);
          }
        }

        if (bestDistance !== null) {
          toUpsert.push({
            freight_id: f.id,
            driver_id: driverId,
            match_type: 'DRIVER_AREA',
            distance_m: bestDistance,
          });
        }
      }

      if (toUpsert.length > 0) {
        // Upsert matches to avoid duplicates
        const { error: upErr } = await supabase
          .from('freight_matches')
          .upsert(toUpsert, { onConflict: 'freight_id,driver_id' });
        if (upErr) {
          console.error('Upsert matches error:', upErr);
        }
      }

      const result = await fetchMatches();
      return new Response(JSON.stringify({ success: true, ...result, created: toUpsert.length }), {
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
