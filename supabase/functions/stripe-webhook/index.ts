/**
 * @deprecated Esta Edge Function será removida em breve.
 * A integração Stripe será substituída pelo Pagar.me.
 * 
 * Novo modelo de cobrança: Por emissão de documento fiscal
 * Não haverá mais webhooks de assinatura/subscription.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [Stripe Webhook] ${step}`, details ? JSON.stringify(details) : '')
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
      logStep('Webhook signature verification failed', { error: err instanceof Error ? err.message : 'Unknown error' })
      throw new Error(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
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
        } else if (session.metadata?.type === 'freight_advance_payment') {
          // Handle freight advance payment - VALIDAÇÃO MELHORADA
          const freightId = session.metadata.freight_id
          const advanceId = session.metadata.advance_id
          
          logStep('Processing freight advance payment', { freightId, advanceId, sessionId: session.id })

          // Verificar se o adiantamento existe e está no status correto
          const { data: advance, error: fetchError } = await supabase
            .from('freight_advances')
            .select('*, freights(producer_id)')
            .eq('id', advanceId)
            .eq('status', 'APPROVED')
            .single()

          if (fetchError || !advance) {
            logStep('Freight advance not found or invalid status', { advanceId, error: fetchError })
            throw new Error('Invalid advance or advance already processed')
          }

          // Verificar se o pagamento foi realmente bem-sucedido no Stripe
          if (session.payment_status !== 'paid') {
            logStep('Payment not completed in Stripe', { sessionId: session.id, paymentStatus: session.payment_status })
            throw new Error('Payment not completed')
          }

          // Atualizar status do adiantamento para PAID
          const { error: advanceError } = await supabase
            .from('freight_advances')
            .update({ 
              status: 'PAID',
              stripe_payment_intent_id: session.payment_intent,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', advanceId)
            .eq('status', 'APPROVED') // Double-check status

          if (advanceError) {
            logStep('Error updating freight advance', { error: advanceError })
            throw advanceError
          }

          // Enviar notificação para o motorista
          try {
            await supabase.functions.invoke('send-notification', {
              body: {
                user_id: advance.driver_id,
                title: 'Adiantamento Confirmado!',
                message: `Seu adiantamento de R$ ${((advance.requested_amount || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi confirmado pelo Stripe e será processado em breve.`,
                type: 'advance_paid',
                data: {
                  advance_id: advanceId,
                  freight_id: freightId,
                  amount: (advance.requested_amount || 0) / 100
                }
              }
            });
            logStep('Driver notification sent for advance payment')
          } catch (notificationError) {
            logStep('Warning: Could not send driver notification', { error: notificationError })
          }

          logStep('Freight advance payment confirmed', { freightId, advanceId })
          
        } else if (session.metadata?.type === 'freight_payment') {
          // Handle freight payment - VALIDAÇÃO MELHORADA com atualização de saldo
          const freightId = session.metadata.freight_id
          const paymentId = session.metadata.payment_id
          
          logStep('Processing freight payment', { freightId, paymentId, sessionId: session.id })

          // Verificar se o pagamento existe e está no status correto
          const { data: payment, error: fetchError } = await supabase
            .from('freight_payments')
            .select('*, freights(driver_id)')
            .eq('id', paymentId)
            .eq('status', 'PENDING')
            .single()

          if (fetchError || !payment) {
            logStep('Freight payment not found or invalid status', { paymentId, error: fetchError })
            throw new Error('Invalid payment or payment already processed')
          }

          // Verificar se o pagamento foi realmente bem-sucedido no Stripe
          if (session.payment_status !== 'paid') {
            logStep('Payment not completed in Stripe', { sessionId: session.id, paymentStatus: session.payment_status })
            throw new Error('Payment not completed')
          }

          // Atualizar status do pagamento - ISSO ACIONARÁ O TRIGGER PARA ATUALIZAR O SALDO
          const { error: paymentError } = await supabase
            .from('freight_payments')
            .update({ 
              status: 'COMPLETED',
              stripe_payment_intent_id: session.payment_intent,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentId)
            .eq('status', 'PENDING') // Double-check status

          if (paymentError) {
            logStep('Error updating freight payment', { error: paymentError })
            throw paymentError
          }

          logStep('Freight payment updated - balance will be updated by trigger', { paymentId })

          // Atualizar status do frete para DELIVERED
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

          // Enviar notificações
          try {
            // Notificação para o motorista sobre pagamento confirmado E saldo atualizado
            await supabase.functions.invoke('send-notification', {
              body: {
                user_id: payment.freights.driver_id,
                title: 'Pagamento Confirmado e Saldo Atualizado!',
                message: `O pagamento do frete de R$ ${(payment.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi confirmado pela Stripe. Seu saldo foi atualizado e está disponível para saque.`,
                type: 'payment_confirmed_balance_updated',
                data: {
                  payment_id: paymentId,
                  freight_id: freightId,
                  gross_amount: payment.amount / 100,
                  net_amount: (payment.amount * 0.98) / 100, // Após comissão de 2%
                  commission_rate: 2
                }
              }
            });
            logStep('Driver notification sent for payment confirmation and balance update')
          } catch (notificationError) {
            logStep('Warning: Could not send driver notification', { error: notificationError })
          }

          logStep('Freight payment confirmed, balance updated by trigger, and freight delivered', { freightId, paymentId })
        } else if (session.metadata?.type === 'service_payment') {
          // Handle service payment
          const serviceRequestId = session.metadata.service_request_id
          const paymentId = session.metadata.payment_id
          
          logStep('Processing service payment', { serviceRequestId, paymentId, sessionId: session.id })

          // Verificar se o pagamento existe e está no status correto
          const { data: payment, error: fetchError } = await supabase
            .from('service_payments')
            .select('*')
            .eq('id', paymentId)
            .eq('status', 'PENDING')
            .single()

          if (fetchError || !payment) {
            logStep('Service payment not found or invalid status', { paymentId, error: fetchError })
            throw new Error('Invalid service payment or payment already processed')
          }

          // Verificar se o pagamento foi realmente bem-sucedido no Stripe
          if (session.payment_status !== 'paid') {
            logStep('Service payment not completed in Stripe', { sessionId: session.id, paymentStatus: session.payment_status })
            throw new Error('Service payment not completed')
          }

          // Atualizar status do pagamento - ISSO ACIONARÁ O TRIGGER PARA ATUALIZAR O SALDO
          const { error: paymentError } = await supabase
            .from('service_payments')
            .update({ 
              status: 'COMPLETED',
              stripe_payment_intent_id: session.payment_intent,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentId)
            .eq('status', 'PENDING') // Double-check status

          if (paymentError) {
            logStep('Error updating service payment', { error: paymentError })
            throw paymentError
          }

          logStep('Service payment updated - balance will be updated by trigger', { paymentId })

          // Enviar notificações
          try {
            // Notificação para o prestador sobre pagamento confirmado
            await supabase.functions.invoke('send-notification', {
              body: {
                user_id: session.metadata.provider_id,
                title: 'Pagamento de Serviço Confirmado!',
                message: `O pagamento do seu serviço no valor de R$ ${(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi confirmado via Stripe. Seu saldo foi atualizado automaticamente.`,
                type: 'service_payment_confirmed',
                data: {
                  payment_id: paymentId,
                  service_request_id: serviceRequestId,
                  gross_amount: payment.amount,
                  net_amount: payment.amount * 0.98 // Após comissão de 2%
                }
              }
            });

            // Notificação para o cliente sobre pagamento processado
            await supabase.functions.invoke('send-notification', {
              body: {
                user_id: session.metadata.client_id,
                title: 'Pagamento Processado com Sucesso!',
                message: `Seu pagamento de R$ ${(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi processado com sucesso. Obrigado por usar nossos serviços!`,
                type: 'payment_processed',
                data: {
                  payment_id: paymentId,
                  service_request_id: serviceRequestId,
                  amount: payment.amount
                }
              }
            });
            
            logStep('Service payment notifications sent successfully')
          } catch (notificationError) {
            logStep('Warning: Could not send service payment notifications', { error: notificationError })
          }

          logStep('Service payment confirmed and balance updated', { serviceRequestId, paymentId })
        }
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logStep('Payment intent succeeded', { paymentIntentId: paymentIntent.id, metadata: paymentIntent.metadata })
        
        // Log adicional para auditoria
        if (paymentIntent.metadata?.freight_id) {
          logStep('Payment intent success logged for freight', { 
            freightId: paymentIntent.metadata.freight_id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logStep('Payment intent failed', { paymentIntentId: paymentIntent.id, metadata: paymentIntent.metadata })
        
        // Reverter status se necessário
        if (paymentIntent.metadata?.advance_id) {
          const { error } = await supabase
            .from('freight_advances')
            .update({ 
              status: 'APPROVED', // Voltar para aprovado
              updated_at: new Date().toISOString()
            })
            .eq('stripe_payment_intent_id', paymentIntent.id)
            
          if (error) {
            logStep('Error reverting advance status', { error })
          } else {
            logStep('Advance status reverted due to payment failure')
          }
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
    logStep('Webhook error', { error: error instanceof Error ? error.message : 'Unknown error' })
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})