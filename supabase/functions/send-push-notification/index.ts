import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID helper para Web Push
async function sendWebPush(subscription: any, payload: any) {
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') || 'mailto:contato@agriroute.com';

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[PUSH] VAPID keys not configured, skipping real push');
    return { success: false, reason: 'vapid_not_configured' };
  }

  try {
    // Importar webpush via npm: specifier
    const webpush = await import('npm:web-push@3.6.6');
    
    webpush.setVapidDetails(
      VAPID_EMAIL,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key
      }
    };

    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    console.log(`[PUSH] Real push sent to ${subscription.endpoint}`);
    return { success: true };
  } catch (error) {
    console.error('[PUSH] Web push error:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_ids, title, message, type, data, url, requireInteraction = false, actions = [] } = await req.json();

    console.log(`[PUSH] Sending to ${user_ids?.length || 0} users - Type: ${type}`);

    // Buscar subscriptions ativas dos usuários
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', user_ids)
      .eq('is_active', true);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[PUSH] No active subscriptions found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No active subscriptions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PUSH] Found ${subscriptions.length} active subscriptions`);

    // Enviar push notifications reais
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Payload da notificação
          const pushPayload = {
            title,
            message,
            type,
            data: {
              ...data,
              url: url || '/',
              notificationId: crypto.randomUUID()
            },
            requireInteraction,
            actions
          };

          // Enviar push real
          const pushResult = await sendWebPush(sub, pushPayload);

          // Atualizar last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);

          console.log(`[PUSH] Processed for user ${sub.user_id} - Success: ${pushResult.success}`);
          return { 
            success: pushResult.success, 
            subscription_id: sub.id,
            reason: pushResult.reason || pushResult.error
          };
        } catch (error) {
          console.error(`[PUSH] Failed for subscription ${sub.id}:`, error);
          return { success: false, subscription_id: sub.id, error: error.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`[PUSH] Sent ${sent}/${subscriptions.length} real push notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent, 
        total: subscriptions.length, 
        results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false })
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PUSH] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
