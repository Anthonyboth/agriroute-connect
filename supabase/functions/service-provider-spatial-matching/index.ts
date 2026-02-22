import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ServiceMatchRequest {
  service_request_id?: string;
  guest_request_id?: string;
  request_lat: number;
  request_lng: number;
  service_type?: string;
  notify_providers?: boolean;
}

interface ProviderMatchData {
  provider_id: string;
  provider_area_id: string;
  match_type: string;
  distance_m: number;
  match_score: number;
  service_compatibility_score: number;
  provider_name?: string;
  city_name?: string;
  radius_km?: number;
  service_types?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT — defense in depth (verify_jwt=true in config.toml already blocks unauthenticated)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token de autenticação obrigatório' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client for elevated queries
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { 
        service_request_id,
        guest_request_id,
        request_lat, 
        request_lng, 
        service_type,
        notify_providers = true 
      }: ServiceMatchRequest = await req.json();

      const requestId = service_request_id || guest_request_id;
      
      if (!requestId || !request_lat || !request_lng) {
        return new Response(
          JSON.stringify({ error: 'request_id, request_lat and request_lng are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Starting spatial matching for service request: ${requestId}`);

      // Execute the spatial matching function using user_cities
      const { data: matchResults, error: matchError } = await supabaseClient
        .rpc('execute_service_matching_with_user_cities', { 
          p_service_request_id: requestId,
          p_request_lat: request_lat,
          p_request_lng: request_lng,
          p_service_type: service_type || null
        });

      if (matchError) {
        console.error('Error executing service matching:', matchError);
        return new Response(
          JSON.stringify({ error: 'Failed to execute spatial matching', details: matchError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found ${matchResults?.length || 0} potential provider matches`);

      // Get additional provider information for matched providers
      const providerIds = [...new Set((matchResults || []).map((match: any) => match.provider_id))];
      
      let enrichedMatches: ProviderMatchData[] = [];
      if (providerIds.length > 0) {
        const { data: providerProfiles, error: profileError } = await supabaseClient
          .from('profiles')
          .select('id, full_name, user_id')
          .in('id', providerIds)
          .eq('status', 'APPROVED');

        if (profileError) {
          console.error('Error fetching provider profiles:', profileError);
        }

        // Get user_cities details
        const cityIds = (matchResults || []).map((match: any) => match.provider_city_id);
        const { data: userCities, error: cityError } = await supabaseClient
          .from('user_cities')
          .select(`
            id,
            radius_km,
            cities (
              name,
              state
            )
          `)
          .in('id', cityIds);

        if (cityError) {
          console.error('Error fetching user cities:', cityError);
        }

        // Enrich match data
        enrichedMatches = (matchResults || []).map((match: any) => {
          const providerProfile = providerProfiles?.find(p => p.id === match.provider_id);
          const userCity = userCities?.find((uc: any) => uc.id === match.provider_city_id);
          const city = (userCity as any)?.cities;

          return {
            ...match,
            provider_name: providerProfile?.full_name || 'Prestador Desconhecido',
            city_name: city ? `${city.name}, ${city.state}` : '',
            radius_km: userCity?.radius_km || 0,
            service_types: [] // Service types are now in profiles, not user_cities
          };
        });
      }

      // Send notifications if requested
      let notificationResults = null;
      if (notify_providers && enrichedMatches.length > 0) {
        console.log(`Sending notifications to ${enrichedMatches.length} providers`);
        
        // Get service request details for notification
        let requestData = null;
        
        if (service_request_id) {
          const { data, error } = await supabaseClient
            .from('service_requests')
            .select('service_type, location_address, contact_name, urgency, estimated_price')
            .eq('id', service_request_id)
            .single();
          
          if (!error) requestData = data;
        } else if (guest_request_id) {
          const { data, error } = await supabaseClient
            .from('guest_requests')
            .select('service_type, contact_name, payload')
            .eq('id', guest_request_id)
            .single();
          
          if (!error) {
            requestData = {
              service_type: data.service_type,
              location_address: data.payload?.origin_address || 'Localização informada',
              contact_name: data.contact_name,
              urgency: data.payload?.emergency ? 'URGENT' : 'MEDIUM',
              estimated_price: data.payload?.estimated_price
            };
          }
        }

        if (requestData) {
          const notificationPromises = enrichedMatches.map(async (match) => {
            // Check if provider can be notified (throttling)
            const { data: canNotify, error: throttleError } = await supabaseClient
              .rpc('can_notify_provider', { p_provider_id: match.provider_id });

            if (throttleError || !canNotify) {
              console.log(`Skipping notification for provider ${match.provider_id} due to throttling`);
              return { provider_id: match.provider_id, notified: false, reason: 'throttled' };
            }

            // Create notification
            try {
              const { error: notifyError } = await supabaseClient.functions.invoke('send-notification', {
                body: {
                  user_id: match.provider_id,
                  title: `Nova Solicitação - ${requestData.service_type}`,
                  message: `${requestData.location_address} - Cliente: ${requestData.contact_name}${requestData.estimated_price ? ` - Valor: R$ ${requestData.estimated_price}` : ''}`,
                  type: 'service_match',
                  data: {
                    request_id: requestId,
                    request_type: service_request_id ? 'service_request' : 'guest_request',
                    match_type: match.match_type,
                    distance_m: match.distance_m,
                    match_score: match.match_score,
                    service_compatibility_score: match.service_compatibility_score,
                    service_type: requestData.service_type,
                    urgency: requestData.urgency
                  }
                }
              });

              if (notifyError) {
                console.error(`Failed to notify provider ${match.provider_id}:`, notifyError);
                return { provider_id: match.provider_id, notified: false, reason: notifyError.message };
              }

              // Update match record with notification timestamp
              await supabaseClient
                .from('service_matches')
                .update({ notified_at: new Date().toISOString() })
                .eq('service_request_id', requestId)
                .eq('provider_id', match.provider_id);

              return { provider_id: match.provider_id, notified: true };
            } catch (error) {
              console.error(`Exception notifying provider ${match.provider_id}:`, error);
              return { provider_id: match.provider_id, notified: false, reason: 'exception' };
            }
          });

          notificationResults = await Promise.all(notificationPromises);
          console.log('Notification results:', notificationResults);
        }
      }

      const response = {
        success: true,
        request_id: requestId,
        request_type: service_request_id ? 'service_request' : 'guest_request',
        matches_found: enrichedMatches.length,
        matches: enrichedMatches,
        notifications_sent: notificationResults?.filter(n => n.notified).length || 0,
        notification_results: notificationResults
      };

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET endpoint to retrieve existing matches for a service request
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const service_request_id = url.searchParams.get('service_request_id');
      const guest_request_id = url.searchParams.get('guest_request_id');
      
      const requestId = service_request_id || guest_request_id;

      if (!requestId) {
        return new Response(
          JSON.stringify({ error: 'service_request_id or guest_request_id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: matches, error } = await supabaseClient
        .from('service_matches')
        .select(`
          *,
          user_cities!provider_area_id(
            radius_km,
            cities(name, state)
          ),
          profiles!provider_id(full_name)
        `)
        .eq('service_request_id', requestId)
        .order('service_compatibility_score', { ascending: false })
        .order('match_score', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch matches', details: error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          request_id: requestId,
          request_type: service_request_id ? 'service_request' : 'guest_request',
          matches: matches || [] 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Service spatial matching error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});