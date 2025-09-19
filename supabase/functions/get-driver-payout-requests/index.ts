import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid user token')
    }

    // Parse request body
    const { driver_id } = await req.json()

    // Validate that the user owns this driver profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, role')
      .eq('id', driver_id)
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Invalid driver profile or unauthorized')
    }

    // Get payout requests
    const { data: payoutRequests, error: requestsError } = await supabase
      .from('driver_payout_requests')
      .select('*')
      .eq('driver_id', driver_id)
      .order('created_at', { ascending: false })

    if (requestsError) {
      throw requestsError
    }

    // Get available payouts from completed freights
    const { data: availablePayouts, error: payoutsError } = await supabase
      .from('driver_payouts')
      .select('*')
      .eq('driver_id', driver_id)
      .order('created_at', { ascending: false })

    if (payoutsError) {
      throw payoutsError
    }

    // Get freight details for available payouts
    const freightIds = availablePayouts?.map(p => p.freight_id).filter(Boolean) || []
    let freightDetails = []
    
    if (freightIds.length > 0) {
      const { data: freights, error: freightsError } = await supabase
        .from('freights')
        .select('id, cargo_type, origin_address, destination_address')
        .in('id', freightIds)
      
      if (!freightsError) {
        freightDetails = freights || []
      }
    }

    // Combine payout data with freight details
    const payoutsWithFreights = availablePayouts?.map(payout => ({
      ...payout,
      freight: freightDetails.find(f => f.id === payout.freight_id)
    })) || []

    return new Response(
      JSON.stringify({ 
        success: true,
        requests: payoutRequests || [],
        available_payouts: payoutsWithFreights
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error fetching payout data:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})