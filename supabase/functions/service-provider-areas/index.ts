import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

interface ServiceProviderAreaRequest {
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
  service_types?: string[];
  is_active?: boolean;
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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's service provider profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Service provider profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const providerId = profile.id;

    if (req.method === 'POST') {
      // Create new service area
      const areaData: ServiceProviderAreaRequest = await req.json();

      const { data, error } = await supabaseClient
        .from('service_provider_areas')
        .insert({
          provider_id: providerId,
          city_name: areaData.city_name,
          state: areaData.state,
          lat: areaData.lat,
          lng: areaData.lng,
          radius_km: areaData.radius_km,
          service_types: areaData.service_types || [],
          is_active: areaData.is_active ?? true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating service provider area:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create service area', details: error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, service_area: data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // Get provider's service areas
      const { data, error } = await supabaseClient
        .from('service_provider_areas')
        .select('*')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching service provider areas:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch service areas', details: error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, service_areas: data || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT') {
      // Update service area
      const url = new URL(req.url);
      const areaId = url.searchParams.get('id');

      if (!areaId) {
        return new Response(
          JSON.stringify({ error: 'Service area ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Partial<ServiceProviderAreaRequest> = await req.json();

      const { data, error } = await supabaseClient
        .from('service_provider_areas')
        .update(updateData)
        .eq('id', areaId)
        .eq('provider_id', providerId) // Ensure provider can only update their own areas
        .select()
        .single();

      if (error) {
        console.error('Error updating service provider area:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update service area', details: error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Service area not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, service_area: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE') {
      // Delete service area
      const url = new URL(req.url);
      const areaId = url.searchParams.get('id');

      if (!areaId) {
        return new Response(
          JSON.stringify({ error: 'Service area ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabaseClient
        .from('service_provider_areas')
        .delete()
        .eq('id', areaId)
        .eq('provider_id', providerId); // Ensure provider can only delete their own areas

      if (error) {
        console.error('Error deleting service provider area:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to delete service area', details: error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Service area deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Service provider areas API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});