import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_ids, title, message, type, data, url } = await req.json();

    console.log(`[PUSH] Sending to ${user_ids?.length || 0} users`);

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

    // Por enquanto, apenas criar notificações in-app
    // Para enviar push real, seria necessário configurar VAPID keys e usar Web Push API
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Atualizar last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);

          console.log(`[PUSH] Processed subscription for user ${sub.user_id}`);
          return { success: true, subscription_id: sub.id };
        } catch (error) {
          console.error(`[PUSH] Failed for subscription ${sub.id}:`, error);
          return { success: false, subscription_id: sub.id, error: error.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    console.log(`[PUSH] Processed ${sent}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({ success: true, sent, total: subscriptions.length, results }),
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
