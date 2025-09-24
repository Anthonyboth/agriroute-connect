import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ServiceAreaRequest {
  city_name: string;
  state?: string;
  lat: number;
  lng: number;
  radius_km: number;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get producer profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'PRODUTOR')
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Producer profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const serviceAreaId = url.searchParams.get('id')

    if (req.method === 'POST') {
      // Create new service area
      const serviceAreaData: ServiceAreaRequest = await req.json()

      const { data, error } = await supabaseClient
        .from('producer_service_areas')
        .insert({
          producer_id: profile.id,
          city_name: serviceAreaData.city_name,
          state: serviceAreaData.state,
          lat: serviceAreaData.lat,
          lng: serviceAreaData.lng,
          radius_km: serviceAreaData.radius_km,
          is_active: serviceAreaData.is_active,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating service area:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to create service area' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, service_area: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'GET') {
      // Get all service areas for the producer
      const { data, error } = await supabaseClient
        .from('producer_service_areas')
        .select('*')
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching service areas:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch service areas' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, service_areas: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'PUT') {
      // Update service area
      if (!serviceAreaId) {
        return new Response(
          JSON.stringify({ error: 'Service area ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const updateData = await req.json()

      const { data, error } = await supabaseClient
        .from('producer_service_areas')
        .update(updateData)
        .eq('id', serviceAreaId)
        .eq('producer_id', profile.id) // Ensure the producer owns this area
        .select()
        .single()

      if (error) {
        console.error('Error updating service area:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to update service area' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, service_area: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'DELETE') {
      // Delete service area
      if (!serviceAreaId) {
        return new Response(
          JSON.stringify({ error: 'Service area ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseClient
        .from('producer_service_areas')
        .delete()
        .eq('id', serviceAreaId)
        .eq('producer_id', profile.id) // Ensure the producer owns this area

      if (error) {
        console.error('Error deleting service area:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to delete service area' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})