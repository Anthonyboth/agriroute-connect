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

    console.log('[STALE-PROPOSALS] Checking for stale proposals...');

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Buscar propostas pendentes antigas
    const { data: staleProposals, error: proposalError } = await supabase
      .from('freight_proposals')
      .select(`
        *,
        freight:freights(
          *,
          producer:profiles!freights_producer_id_fkey(id, full_name)
        )
      `)
      .eq('status', 'PENDING')
      .lt('created_at', twentyFourHoursAgo.toISOString());

    if (proposalError) throw proposalError;

    console.log(`[STALE-PROPOSALS] Found ${staleProposals?.length || 0} stale proposals`);

    if (!staleProposals || staleProposals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, checked: 0, notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notified = 0;

    for (const proposal of staleProposals) {
      const proposalAge = now.getTime() - new Date(proposal.created_at).getTime();
      const hoursOld = Math.floor(proposalAge / (60 * 60 * 1000));
      
      let reminderType: '24h' | '48h' | null = null;
      
      if (hoursOld >= 48) {
        reminderType = '48h';
      } else if (hoursOld >= 24) {
        reminderType = '24h';
      }

      if (!reminderType) continue;

      // Verificar se já enviou esse reminder
      const { data: existingReminder } = await supabase
        .from('proposal_reminders')
        .select('id')
        .eq('proposal_id', proposal.id)
        .eq('reminder_type', reminderType)
        .single();

      if (existingReminder) {
        console.log(`[STALE-PROPOSALS] Reminder ${reminderType} already sent for proposal ${proposal.id}`);
        continue;
      }

      // Criar notificação para o produtor
      const producerId = proposal.freight.producer.id;
      const message = reminderType === '24h' 
        ? `Você tem uma proposta pendente há mais de 24 horas. Revise agora para não perder a oportunidade!`
        : `⚠️ Proposta pendente há mais de 48 horas! O motorista pode estar aguardando sua resposta.`;

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: producerId,
          title: '⏰ Proposta Pendente',
          message,
          type: 'proposal_pending_reminder',
          data: {
            proposal_id: proposal.id,
            freight_id: proposal.freight_id,
            hours_old: hoursOld,
            reminder_type: reminderType
          }
        });

      if (notifError) {
        console.error(`[STALE-PROPOSALS] Error creating notification:`, notifError);
        continue;
      }

      // Enviar push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            user_ids: [producerId],
            title: '⏰ Proposta Pendente',
            message,
            type: 'proposal_pending_reminder',
            data: {
              proposal_id: proposal.id,
              freight_id: proposal.freight_id
            },
            requireInteraction: true
          }
        });
      } catch (pushError) {
        console.error('[STALE-PROPOSALS] Push error:', pushError);
      }

      // Registrar reminder enviado
      await supabase
        .from('proposal_reminders')
        .insert({
          proposal_id: proposal.id,
          reminder_type: reminderType
        });

      notified++;
      console.log(`[STALE-PROPOSALS] Sent ${reminderType} reminder for proposal ${proposal.id}`);
    }

    console.log(`[STALE-PROPOSALS] Notified ${notified} producers about stale proposals`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: staleProposals.length, 
        notified 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[STALE-PROPOSALS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
