import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[PROVIDER-SPATIAL-MATCHING] ${step}`, details ? JSON.stringify(details, null, 2) : '');
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logStep('Authentication failed', { error: authError });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('User authenticated', { userId: user.id });

    // Verify user is a service provider
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('role', 'PRESTADOR_SERVICOS')
      .single();

    if (profileError || !profile) {
      logStep('User is not a service provider', { error: profileError });
      return new Response(
        JSON.stringify({ error: 'Only service providers can access this endpoint' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Service provider verified', { providerId: profile.id });

    if (req.method === 'GET') {
      // Fetch existing matches
      const { data: matches, error: matchesError } = await supabase
        .from('service_matches')
        .select(`
          *,
          service_requests (*),
          service_provider_areas (*)
        `)
        .eq('provider_id', profile.id)
        .order('created_at', { ascending: false });

      if (matchesError) {
        logStep('Error fetching matches', { error: matchesError });
        throw matchesError;
      }

      logStep('Fetched existing matches', { count: matches?.length || 0 });

      return new Response(
        JSON.stringify({ success: true, matches: matches || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      // Execute spatial matching

      // 1. Get provider's active service areas
      const { data: providerAreas, error: areasError } = await supabase
        .from('service_provider_areas')
        .select('*')
        .eq('provider_id', profile.id)
        .eq('is_active', true);

      if (areasError) {
        logStep('Error fetching provider areas', { error: areasError });
        throw areasError;
      }

      if (!providerAreas || providerAreas.length === 0) {
        logStep('No active service areas configured');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No active service areas configured',
            matches_created: 0,
            matches_processed: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      logStep('Provider areas found', { count: providerAreas.length, areas: providerAreas.map(a => ({ city: a.city_name, state: a.state, radius: a.radius_km })) });

      // 2. Get recent open service requests
      const { data: serviceRequests, error: requestsError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('status', 'OPEN')
        .is('provider_id', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (requestsError) {
        logStep('Error fetching service requests', { error: requestsError });
        throw requestsError;
      }

      logStep('Service requests found', { count: serviceRequests?.length || 0 });

      // 3. Perform spatial matching
      const matches: any[] = [];
      let matchesCreated = 0;

      for (const request of serviceRequests || []) {
        for (const area of providerAreas) {
          let isMatch = false;
          let matchType = '';
          let distance_m: number | null = null;

          // Check service type compatibility
          const serviceTypesMatch = 
            !area.service_types || 
            area.service_types.length === 0 || 
            area.service_types.includes(request.service_type);

          if (!serviceTypesMatch) {
            continue;
          }

          // CITY_MATCH: Exact city/state match
          if (
            request.city_name && 
            request.state && 
            area.city_name && 
            area.state &&
            request.city_name.toLowerCase().trim() === area.city_name.toLowerCase().trim() &&
            request.state.toLowerCase().trim() === area.state.toLowerCase().trim()
          ) {
            isMatch = true;
            matchType = 'CITY_MATCH';
            distance_m = 0;
            logStep('CITY_MATCH found', { 
              request: `${request.city_name}/${request.state}`, 
              area: `${area.city_name}/${area.state}` 
            });
          }
          // SPATIAL_RADIUS: Geographic proximity
          else if (
            request.location_lat && 
            request.location_lng && 
            area.lat && 
            area.lng
          ) {
            const dist = haversine(
              area.lat, 
              area.lng, 
              request.location_lat, 
              request.location_lng
            );
            
            const radiusM = area.radius_m || (area.radius_km * 1000);
            
            if (dist <= radiusM) {
              isMatch = true;
              matchType = 'SPATIAL_RADIUS';
              distance_m = dist;
              logStep('SPATIAL_RADIUS match found', { 
                distance_km: (dist / 1000).toFixed(2), 
                radius_km: area.radius_km,
                request_location: `${request.city_name || 'N/A'}`,
                area_location: `${area.city_name}`
              });
            }
          }

          if (isMatch) {
            const matchData = {
              service_request_id: request.id,
              provider_id: profile.id,
              provider_area_id: area.id,
              match_type: matchType,
              distance_m,
              match_score: matchType === 'CITY_MATCH' ? 1.0 : Math.max(0.1, 1.0 - (distance_m! / (area.radius_km * 1000))),
              service_compatibility_score: serviceTypesMatch ? 1.0 : 0.5
            };

            matches.push(matchData);

            // Insert or update match
            const { error: matchError } = await supabase
              .from('service_matches')
              .upsert(matchData, {
                onConflict: 'service_request_id,provider_id,provider_area_id'
              });

            if (matchError) {
              logStep('Error creating match', { error: matchError });
            } else {
              matchesCreated++;
            }
          }
        }
      }

      logStep('Matching complete', { 
        total_matches: matches.length, 
        matches_created: matchesCreated,
        requests_processed: serviceRequests?.length || 0
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          matches_created: matchesCreated,
          matches_processed: matches.length,
          requests_evaluated: serviceRequests?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logStep('ERROR', { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
