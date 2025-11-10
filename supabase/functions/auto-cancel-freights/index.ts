import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('[AUTO-CANCEL] Iniciando verificação automática de fretes vencidos...');
    const startTime = Date.now();

    // Call the database function
    const { data, error } = await supabaseAdmin.rpc('auto_cancel_overdue_freights');

    if (error) {
      console.error('[AUTO-CANCEL] Erro ao executar função:', error);
      throw error;
    }

    const executionTime = Date.now() - startTime;

    console.log('[AUTO-CANCEL] Resultado da verificação:', {
      ...data,
      execution_time_ms: executionTime
    });

    // 📬 Enviar notificações para fretes cancelados
    if (data?.cancelled_freights && data.cancelled_freights.length > 0) {
      console.log(`[AUTO-CANCEL] Enviando notificações para ${data.cancelled_freights.length} fretes cancelados...`);
      
      for (const freightId of data.cancelled_freights) {
        try {
          // Buscar dados do frete cancelado
          const { data: freight, error: freightError } = await supabaseAdmin
            .from('freights')
            .select(`
              id,
              cargo_type,
              origin_city,
              destination_city,
              pickup_date,
              producer_id,
              driver_id
            `)
            .eq('id', freightId)
            .single();
          
          if (freightError || !freight) {
            console.error(`[AUTO-CANCEL] Erro ao buscar frete ${freightId}:`, freightError);
            continue;
          }

          const formattedDate = new Date(freight.pickup_date).toLocaleDateString('pt-BR');

          // Notificar produtor
          const { error: producerNotifError } = await supabaseAdmin.functions.invoke('send-notification', {
            body: {
              user_id: freight.producer_id,
              title: '❌ Frete Cancelado Automaticamente',
              message: `O frete de ${freight.cargo_type} (${freight.origin_city} → ${freight.destination_city}) foi cancelado automaticamente por não ter sido coletado em 48 horas após a data agendada (${formattedDate}).`,
              type: 'freight_auto_cancelled',
              data: {
                freight_id: freight.id,
                cancellation_reason: 'Cancelamento automático: frete não coletado em 48h após a data agendada',
                cancelled_at: new Date().toISOString()
              }
            }
          });

          if (producerNotifError) {
            console.error(`[AUTO-CANCEL] Erro ao notificar produtor do frete ${freightId}:`, producerNotifError);
          } else {
            console.log(`[AUTO-CANCEL] ✅ Produtor notificado para frete ${freightId}`);
          }

          // Notificar motorista (se houver)
          if (freight.driver_id) {
            const { error: driverNotifError } = await supabaseAdmin.functions.invoke('send-notification', {
              body: {
                user_id: freight.driver_id,
                title: '❌ Frete Cancelado Automaticamente',
                message: `O frete de ${freight.cargo_type} (${freight.origin_city} → ${freight.destination_city}) foi cancelado automaticamente por não ter sido coletado em 48 horas após a data agendada (${formattedDate}).`,
                type: 'freight_auto_cancelled',
                data: {
                  freight_id: freight.id,
                  cancellation_reason: 'Cancelamento automático: frete não coletado em 48h após a data agendada',
                  cancelled_at: new Date().toISOString()
                }
              }
            });

            if (driverNotifError) {
              console.error(`[AUTO-CANCEL] Erro ao notificar motorista do frete ${freightId}:`, driverNotifError);
            } else {
              console.log(`[AUTO-CANCEL] ✅ Motorista notificado para frete ${freightId}`);
            }
          }
        } catch (notifError) {
          console.error(`[AUTO-CANCEL] Erro ao processar notificações para frete ${freightId}:`, notifError);
        }
      }
      
      console.log('[AUTO-CANCEL] ✅ Processamento de notificações concluído');
    }

    return new Response(
      JSON.stringify({
        success: true,
        data,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[AUTO-CANCEL] Erro crítico:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
