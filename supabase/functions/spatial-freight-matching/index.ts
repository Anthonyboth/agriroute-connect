import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Input validation schemas
const FreightMatchRequestSchema = z.object({
  freight_id: z.string().uuid('Invalid freight_id format'),
  notify_drivers: z.boolean().optional().default(true),
});

const GetMatchesSchema = z.object({
  freight_id: z.string().uuid('Invalid freight_id format'),
});

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
    // Get JWT token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      // Validate input
      const body = await req.json();
      const validation = FreightMatchRequestSchema.safeParse(body);
      
      if (!validation.success) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid input', 
            details: validation.error.errors 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { freight_id, notify_drivers } = validation.data;

      // Get user's profiles (may have multiple: MOTORISTA + PRODUTOR)
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id);

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prefer PRODUTOR profile for freight ownership, fallback to first
      const profile = profiles.find(p => p.role === 'PRODUTOR') || profiles[0];

      // Verify user is the freight owner (producer)
      const { data: freight, error: freightError } = await supabaseClient
        .from('freights')
        .select('producer_id, cargo_type, origin_address, destination_address, price, weight')
        .eq('id', freight_id)
        .single();

      if (freightError || !freight) {
        return new Response(
          JSON.stringify({ error: 'Freight not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (freight.producer_id !== profile.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: You are not the freight owner' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check rate limit
      const { data: canProceed } = await supabaseClient
        .rpc('check_rate_limit', { 
          endpoint_name: 'spatial-freight-matching',
          max_requests: 10,
          time_window: '00:01:00'
        });

      if (!canProceed) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Spatial Matching] Starting for freight: ${freight_id} by user: ${user.id}`);

      // Use service role for RPC execution
      const supabaseService = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Execute the spatial matching function
      const { data: matchResults, error: matchError } = await supabaseService
        .rpc('execute_freight_matching', { freight_uuid: freight_id });

      if (matchError) {
        console.error('[Spatial Matching] Error executing:', matchError);
        return new Response(
          JSON.stringify({ error: 'Failed to execute spatial matching', details: matchError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Spatial Matching] Found ${matchResults?.length || 0} potential matches`);

      // Map output column names (out_driver_id -> driver_id) from the RPC
      const normalizedResults = (matchResults || []).map((m: any) => ({
        driver_id: m.out_driver_id || m.driver_id,
        driver_area_id: m.out_driver_area_id || m.driver_area_id,
        match_type: m.out_match_type || m.match_type,
        distance_m: m.out_distance_m ?? m.distance_m,
        match_score: m.out_match_score ?? m.match_score,
      }));
      const driverIds = [...new Set(normalizedResults.map((match: any) => match.driver_id))];
      
      let enrichedMatches: DriverAreaData[] = [];
      if (driverIds.length > 0) {
        const { data: driverProfiles } = await supabaseService
          .from('profiles')
          .select('id, full_name')
          .in('id', driverIds)
          .eq('role', 'MOTORISTA')
          .eq('status', 'APPROVED');

        const areaIds = normalizedResults.map((match: any) => match.driver_area_id);
        const { data: userCities } = await supabaseService
          .from('user_cities')
          .select(`
            id, 
            radius_km,
            cities!inner(name, state)
          `)
          .in('id', areaIds);

        enrichedMatches = normalizedResults.map((match: any) => {
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
        console.log(`[Spatial Matching] Sending notifications to ${enrichedMatches.length} drivers`);
        
        const notificationPromises = enrichedMatches.map(async (match) => {
          const { data: canNotify } = await supabaseService
            .rpc('can_notify_driver', { p_driver_id: match.driver_id });

          if (!canNotify) {
            return { driver_id: match.driver_id, notified: false, reason: 'throttled' };
          }

          try {
            const { error: notifyError } = await supabaseService.functions.invoke('send-notification', {
              body: {
                user_id: match.driver_id,
                title: `Novo Frete Disponível - ${freight.cargo_type}`,
                message: `${freight.origin_address} → ${freight.destination_address}. Valor: R$ ${freight.price}`,
                type: 'freight_match',
                data: {
                  freight_id,
                  match_type: match.match_type,
                  distance_m: match.distance_m,
                  match_score: match.match_score,
                  cargo_type: freight.cargo_type,
                  weight: freight.weight
                }
              }
            });

            if (notifyError) {
              return { driver_id: match.driver_id, notified: false, reason: notifyError.message };
            }

            await supabaseService
              .from('freight_matches')
              .update({ notified_at: new Date().toISOString() })
              .eq('freight_id', freight_id)
              .eq('driver_id', match.driver_id);

            return { driver_id: match.driver_id, notified: true };
          } catch (error) {
            return { driver_id: match.driver_id, notified: false, reason: 'exception' };
          }
        });

        notificationResults = await Promise.all(notificationPromises);
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

      const validation = GetMatchesSchema.safeParse({ freight_id });
      
      if (!validation.success) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid freight_id parameter',
            details: validation.error.errors
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user owns the freight
      const { data: getProfiles } = await supabaseClient
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id);

      const profile2 = getProfiles?.find(p => p.role === 'PRODUTOR') || getProfiles?.[0];

      const { data: freight } = await supabaseClient
        .from('freights')
        .select('producer_id')
        .eq('id', validation.data.freight_id)
        .single();

      if (!freight || freight.producer_id !== profile2?.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        .eq('freight_id', validation.data.freight_id)
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
          freight_id: validation.data.freight_id,
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
    console.error('[Spatial Matching] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
