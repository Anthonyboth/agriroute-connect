import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔔 Verificando fretes com deadline próximo...')

    // Buscar fretes DELIVERED_PENDING_CONFIRMATION
    const { data: freights, error: fetchError } = await supabase
      .from('freights')
      .select(`
        id,
        cargo_type,
        origin_address,
        destination_address,
        producer_id,
        updated_at,
        profiles:producer_id(full_name)
      `)
      .eq('status', 'DELIVERED_PENDING_CONFIRMATION')

    if (fetchError) {
      console.error('❌ Erro ao buscar fretes:', fetchError)
      throw fetchError
    }

    if (!freights || freights.length === 0) {
      console.log('ℹ️ Nenhum frete aguardando confirmação')
      return new Response(
        JSON.stringify({ message: 'Nenhum frete aguardando confirmação' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date()
    let notificationsSent = 0

    for (const freight of freights) {
      const deliveredAt = new Date(freight.updated_at)
      const deadline = new Date(deliveredAt.getTime() + (72 * 60 * 60 * 1000)) // +72h
      const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

      console.log(`📦 Frete ${freight.id}: ${hoursRemaining.toFixed(1)}h restantes`)

      // Verificar se já enviamos notificação para este threshold
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('id, data')
        .eq('user_id', freight.producer_id)
        .eq('type', 'delivery_deadline_warning')
        .eq('data->>freight_id', freight.id)

      let shouldSend = false
      let threshold = ''

      // Verificar threshold de 24h
      if (hoursRemaining <= 24 && hoursRemaining > 6) {
        const has24hNotification = existingNotifications?.some(
          n => n.data?.threshold === '24h'
        )
        if (!has24hNotification) {
          shouldSend = true
          threshold = '24h'
        }
      }

      // Verificar threshold de 6h (crítico)
      if (hoursRemaining <= 6 && hoursRemaining > 0) {
        const has6hNotification = existingNotifications?.some(
          n => n.data?.threshold === '6h'
        )
        if (!has6hNotification) {
          shouldSend = true
          threshold = '6h'
        }
      }

      if (shouldSend) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: freight.producer_id,
            type: 'delivery_deadline_warning',
            title: threshold === '6h' ? '🚨 URGENTE: Prazo de confirmação expirando!' : '⏰ Atenção: Prazo de confirmação próximo',
            message: `Frete ${freight.cargo_type} (${freight.origin_address} → ${freight.destination_address}) precisa ser confirmado em ${threshold === '6h' ? 'menos de 6 horas' : 'menos de 24 horas'}!`,
            data: {
              freight_id: freight.id,
              threshold,
              hours_remaining: Math.floor(hoursRemaining)
            },
            read: false
          })

        if (notifError) {
          console.error(`❌ Erro ao criar notificação para frete ${freight.id}:`, notifError)
        } else {
          console.log(`✅ Notificação ${threshold} enviada para frete ${freight.id}`)
          notificationsSent++
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Verificação concluída: ${freights.length} fretes analisados, ${notificationsSent} notificações enviadas`,
        freights_checked: freights.length,
        notifications_sent: notificationsSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
