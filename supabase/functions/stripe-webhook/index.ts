import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

const logStep = (step: string, details?: any) => {
  console.log(`[Stripe Webhook] ${step}`, details ? JSON.stringify(details) : '')
}

serve(async (req) => {
  logStep('Webhook received', { method: req.method, url: req.url })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceKey) {
      logStep('Missing environment variables')
      throw new Error('Missing required environment variables')
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the raw body for signature verification
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      logStep('Missing Stripe signature')
      throw new Error('Missing Stripe signature')
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret)
      logStep('Webhook verified', { type: event.type, id: event.id })
    } catch (err) {
      logStep('Webhook signature verification failed', { error: err.message })
      throw new Error(`Webhook signature verification failed: ${err.message}`)
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logStep('Checkout session completed', { sessionId: session.id, metadata: session.metadata })

        if (session.metadata?.type === 'subscription') {
          // Handle subscription payment
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const tier = session.metadata.tier as 'ESSENTIAL' | 'PROFESSIONAL'
          
          // Update subscriber record
          const { error: subError } = await supabase
            .from('subscribers')
            .upsert({
              user_email: session.customer_email,
              subscription_id: subscription.id,
              tier: tier,
              subscribed: true,
              subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            })

          if (subError) {
            logStep('Error updating subscription', { error: subError })
            throw subError
          }

          logStep('Subscription updated successfully', { email: session.customer_email, tier })
        } else if (session.metadata?.type === 'freight_advance') {
          // Handle freight advance payment
          const freightId = session.metadata.freight_id
          const advanceId = session.metadata.advance_id

          // Update advance status
          const { error: advanceError } = await supabase
            .from('freight_advances')
            .update({ 
              status: 'PAID',
              stripe_payment_intent_id: session.payment_intent,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', advanceId)

          if (advanceError) {
            logStep('Error updating freight advance', { error: advanceError })
            throw advanceError
          }

          logStep('Freight advance completed', { freightId, advanceId })
        } else if (session.metadata?.type === 'freight_payment') {
          // Handle freight payment
          const freightId = session.metadata.freight_id
          const paymentId = session.metadata.payment_id

          // Update payment status
          const { error: paymentError } = await supabase
            .from('freight_payments')
            .update({ 
              status: 'COMPLETED',
              stripe_payment_id: session.payment_intent,
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentId)

          if (paymentError) {
            logStep('Error updating freight payment', { error: paymentError })
            throw paymentError
          }

          // Update freight status to DELIVERED if payment is complete
          const { error: freightError } = await supabase
            .from('freights')
            .update({ 
              status: 'DELIVERED',
              updated_at: new Date().toISOString()
            })
            .eq('id', freightId)

          if (freightError) {
            logStep('Error updating freight status', { error: freightError })
            throw freightError
          }

          logStep('Freight payment completed and freight marked as delivered', { freightId, paymentId })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        logStep('Invoice payment succeeded', { invoiceId: invoice.id })

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          
          // Update subscription end date
          const { error } = await supabase
            .from('subscribers')
            .update({
              subscribed: true,
              subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('subscription_id', subscription.id)

          if (error) {
            logStep('Error updating subscription renewal', { error })
            throw error
          }

          logStep('Subscription renewed successfully', { subscriptionId: subscription.id })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        logStep('Subscription cancelled', { subscriptionId: subscription.id })

        // Mark subscription as cancelled
        const { error } = await supabase
          .from('subscribers')
          .update({
            subscribed: false,
            tier: 'FREE',
            subscription_end_date: new Date().toISOString(),
          })
          .eq('subscription_id', subscription.id)

        if (error) {
          logStep('Error updating cancelled subscription', { error })
          throw error
        }

        logStep('Subscription marked as cancelled', { subscriptionId: subscription.id })
        break
      }

      default:
        logStep('Unhandled event type', { type: event.type })
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    logStep('Webhook error', { error: error.message })
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})