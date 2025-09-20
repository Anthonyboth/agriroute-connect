import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

interface ServiceAreaRequest {
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
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

    // Get user's driver profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('role', 'MOTORISTA')
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Driver profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const driverId = profile.id;

    if (req.method === 'POST') {
      // Create new service area
      const serviceAreaData: ServiceAreaRequest = await req.json();

      const { data, error } = await supabaseClient
        .from('driver_service_areas')
        .insert({
          driver_id: driverId,
          city_name: serviceAreaData.city_name,
          state: serviceAreaData.state,
          lat: serviceAreaData.lat,
          lng: serviceAreaData.lng,
          radius_km: serviceAreaData.radius_km,
          is_active: serviceAreaData.is_active ?? true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating service area:', error);
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
      // Get driver's service areas
      const { data, error } = await supabaseClient
        .from('driver_service_areas')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching service areas:', error);
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

      const updateData: Partial<ServiceAreaRequest> = await req.json();

      const { data, error } = await supabaseClient
        .from('driver_service_areas')
        .update(updateData)
        .eq('id', areaId)
        .eq('driver_id', driverId) // Ensure driver can only update their own areas
        .select()
        .single();

      if (error) {
        console.error('Error updating service area:', error);
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
        .from('driver_service_areas')
        .delete()
        .eq('id', areaId)
        .eq('driver_id', driverId); // Ensure driver can only delete their own areas

      if (error) {
        console.error('Error deleting service area:', error);
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
    console.error('Service areas API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});