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
    const { driver_id, amount, pix_key } = await req.json()

    if (!driver_id || !amount || !pix_key) {
      throw new Error('Missing required fields: driver_id, amount, pix_key')
    }

    // Validate that the user owns this driver profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, role')
      .eq('id', driver_id)
      .eq('user_id', user.id)
      .eq('role', 'MOTORISTA')
      .single()

    if (profileError || !profile) {
      throw new Error('Invalid driver profile or unauthorized')
    }

    // Validate minimum amount
    if (amount < 50) {
      throw new Error('Minimum payout amount is R$ 50')
    }

    // Insert payout request
    const { data: payoutRequest, error: insertError } = await supabase
      .from('driver_payout_requests')
      .insert({
        driver_id: driver_id,
        amount: amount,
        pix_key: pix_key,
        status: 'PENDING'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        payout_request_id: payoutRequest.id,
        message: 'Payout request created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error processing payout request:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})