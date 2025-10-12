import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface FreightMatchRequest {
  freight_id: string;
  notify_drivers?: boolean;
}

interface DriverAreaData {
  driver_id: string;
  driver_area_id: string;
  match_type: string;
  distance_m: number;
  match_score: number;
  driver_name?: string;
  city_name?: string;
  radius_km?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { freight_id, notify_drivers = true }: FreightMatchRequest = await req.json();

      if (!freight_id) {
        return new Response(
          JSON.stringify({ error: 'freight_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Starting spatial matching for freight: ${freight_id}`);

      // Execute the spatial matching function
      const { data: matchResults, error: matchError } = await supabaseClient
        .rpc('execute_freight_matching', { freight_uuid: freight_id });

      if (matchError) {
        console.error('Error executing freight matching:', matchError);
        return new Response(
          JSON.stringify({ error: 'Failed to execute spatial matching', details: matchError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Found ${matchResults?.length || 0} potential matches`);

      // Get additional driver information for matched drivers
      const driverIds = [...new Set((matchResults || []).map((match: any) => match.driver_id))];
      
      let enrichedMatches: DriverAreaData[] = [];
      if (driverIds.length > 0) {
        const { data: driverProfiles, error: profileError } = await supabaseClient
          .from('profiles')
          .select('id, full_name, user_id')
          .in('id', driverIds)
          .eq('role', 'MOTORISTA')
          .eq('status', 'APPROVED');

        if (profileError) {
          console.error('Error fetching driver profiles:', profileError);
        }

        // Get user cities details (new system)
        const areaIds = (matchResults || []).map((match: any) => match.driver_area_id);
        const { data: userCities, error: areaError } = await supabaseClient
          .from('user_cities')
          .select(`
            id, 
            radius_km,
            cities!inner(name, state)
          `)
          .in('id', areaIds);

        if (areaError) {
          console.error('Error fetching user cities:', areaError);
        }

        // Enrich match data
        enrichedMatches = (matchResults || []).map((match: any) => {
          const driverProfile = driverProfiles?.find(p => p.id === match.driver_id);
          const userCity = userCities?.find((uc: any) => uc.id === match.driver_area_id);

          return {
            ...match,
            driver_name: driverProfile?.full_name || 'Unknown Driver',
            city_name: userCity?.cities?.name || '',
            state: userCity?.cities?.state || '',
            radius_km: userCity?.radius_km || 0
          };
        });
      }

      // Send notifications if requested
      let notificationResults = null;
      if (notify_drivers && enrichedMatches.length > 0) {
        console.log(`Sending notifications to ${enrichedMatches.length} drivers`);
        
        // Get freight details for notification
        const { data: freightData, error: freightError } = await supabaseClient
          .from('freights')
          .select('cargo_type, origin_address, destination_address, price, weight')
          .eq('id', freight_id)
          .single();

        if (!freightError && freightData) {
          const notificationPromises = enrichedMatches.map(async (match) => {
            // Check if driver can be notified (throttling)
            const { data: canNotify, error: throttleError } = await supabaseClient
              .rpc('can_notify_driver', { p_driver_id: match.driver_id });

            if (throttleError || !canNotify) {
              console.log(`Skipping notification for driver ${match.driver_id} due to throttling`);
              return { driver_id: match.driver_id, notified: false, reason: 'throttled' };
            }

            // Get driver's user_id for notification
            const driverProfile = enrichedMatches.find(m => m.driver_id === match.driver_id);
            if (!driverProfile) return { driver_id: match.driver_id, notified: false, reason: 'no_profile' };

            // Create notification
            try {
              const { error: notifyError } = await supabaseClient.functions.invoke('send-notification', {
                body: {
                  user_id: match.driver_id,
                  title: `Novo Frete Disponível - ${freightData.cargo_type}`,
                  message: `${freightData.origin_address} → ${freightData.destination_address}. Valor: R$ ${freightData.price}`,
                  type: 'freight_match',
                  data: {
                    freight_id,
                    match_type: match.match_type,
                    distance_m: match.distance_m,
                    match_score: match.match_score,
                    cargo_type: freightData.cargo_type,
                    weight: freightData.weight
                  }
                }
              });

              if (notifyError) {
                console.error(`Failed to notify driver ${match.driver_id}:`, notifyError);
                return { driver_id: match.driver_id, notified: false, reason: notifyError.message };
              }

              // Update match record with notification timestamp
              await supabaseClient
                .from('freight_matches')
                .update({ notified_at: new Date().toISOString() })
                .eq('freight_id', freight_id)
                .eq('driver_id', match.driver_id);

              return { driver_id: match.driver_id, notified: true };
            } catch (error) {
              console.error(`Exception notifying driver ${match.driver_id}:`, error);
              return { driver_id: match.driver_id, notified: false, reason: 'exception' };
            }
          });

          notificationResults = await Promise.all(notificationPromises);
          console.log('Notification results:', notificationResults);
        }
      }

      const response = {
        success: true,
        freight_id,
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

    // GET endpoint to retrieve existing matches for a freight
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const freight_id = url.searchParams.get('freight_id');

      if (!freight_id) {
        return new Response(
          JSON.stringify({ error: 'freight_id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: matches, error } = await supabaseClient
        .from('freight_matches')
        .select(`
          *,
          user_cities!inner(
            radius_km,
            cities!inner(name, state)
          ),
          profiles(full_name)
        `)
        .eq('freight_id', freight_id)
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
          freight_id,
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
    console.error('Spatial matching error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});