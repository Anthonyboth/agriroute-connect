import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  console.log(`[Driver Payout] ${step}`, details ? JSON.stringify(details) : '')
}

serve(async (req) => {
  logStep('Payout request received', { method: req.method, url: req.url })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      logStep('Missing environment variables')
      throw new Error('Missing required environment variables')
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { freight_id } = await req.json()

    if (!freight_id) {
      throw new Error('Freight ID is required')
    }

    logStep('Processing payout for freight', { freight_id })

    // Get freight details and verify it's delivered
    const { data: freight, error: freightError } = await supabase
      .from('freights')
      .select(`
        id,
        driver_id,
        price,
        commission_rate,
        commission_amount,
        status,
        producer_id,
        profiles:driver_id (
          id,
          full_name,
          user_id
        )
      `)
      .eq('id', freight_id)
      .eq('status', 'DELIVERED')
      .single()

    if (freightError || !freight) {
      logStep('Freight not found or not delivered', { error: freightError })
      throw new Error('Freight not found or not delivered')
    }

    if (!freight.driver_id) {
      throw new Error('No driver assigned to this freight')
    }

    // Check if payout already processed
    const { data: existingPayout } = await supabase
      .from('driver_payouts')
      .select('id, status')
      .eq('freight_id', freight_id)
      .single()

    if (existingPayout) {
      logStep('Payout already exists', { payout_id: existingPayout.id, status: existingPayout.status })
      return new Response(
        JSON.stringify({ 
          message: 'Payout already processed', 
          payout_id: existingPayout.id,
          status: existingPayout.status 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate payout amount (freight price minus commission)
    const commissionRate = freight.commission_rate || 2.0 // Default 2% commission
    const commissionAmount = freight.commission_amount || (freight.price * commissionRate / 100)
    const payoutAmount = freight.price - commissionAmount

    logStep('Calculated payout amount', { 
      freight_price: freight.price, 
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      payout_amount: payoutAmount 
    })

    // Get or create Stripe Express account for driver
    // For now, we'll create a pending payout record and let admin process manually
    // In production, you would set up Stripe Connect Express accounts

    // Create payout record
    const { data: payout, error: payoutError } = await supabase
      .from('driver_payouts')
      .insert({
        freight_id: freight.id,
        driver_id: freight.driver_id,
        amount: payoutAmount,
        status: 'PENDING',
        metadata: {
          freight_price: freight.price,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          processing_method: 'MANUAL_REVIEW'
        }
      })
      .select()
      .single()

    if (payoutError) {
      logStep('Error creating payout record', { error: payoutError })
      throw payoutError
    }

    logStep('Payout record created successfully', { payout_id: payout.id })

    // Send notification to admin about pending payout
    const adminNotification = {
      title: 'Novo Repasse Pendente',
      message: `Repasse de R$ ${payoutAmount.toFixed(2)} para motorista ${freight.profiles?.full_name || 'Desconhecido'} aguardando processamento`,
      type: 'PAYOUT_PENDING',
      data: {
        payout_id: payout.id,
        freight_id: freight.id,
        driver_name: freight.profiles?.full_name,
        amount: payoutAmount
      }
    }

    // In a real implementation, you would send this to admin users
    logStep('Admin notification prepared', adminNotification)

    return new Response(
      JSON.stringify({ 
        success: true,
        payout_id: payout.id,
        amount: payoutAmount,
        status: 'PENDING',
        message: 'Payout created and pending manual processing'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    logStep('Payout processing error', { error: error.message })
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})