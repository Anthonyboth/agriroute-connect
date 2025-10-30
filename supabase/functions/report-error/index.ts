import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REPORT-ERROR] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Função iniciada');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse error report
    const errorReport = await req.json();
    logStep('Relatório recebido', { 
      type: errorReport.errorType, 
      category: errorReport.errorCategory 
    });

    // Enriquecer com metadados
    const enrichedReport = {
      ...errorReport,
      metadata: {
        ...errorReport.metadata,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
        user_agent: req.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      }
    };

    // Salvar no banco
    const { data: errorLog, error: insertError } = await supabaseAdmin
      .from('error_logs')
      .insert(enrichedReport)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Erro ao salvar log: ${insertError.message}`);
    }

    logStep('Log salvo no banco', { errorLogId: errorLog.id });

    // Decidir se deve notificar Telegram
    let shouldNotify = false;
    let notifyReason = '';

    // REGRA TEMPORÁRIA: Notificar TODOS os erros de /dashboard/company
    const isCompanyDashboard = errorReport.route?.includes('/dashboard/company');
    const isReferenceError = errorReport.errorMessage?.includes('is not defined') || 
                             errorReport.errorType === 'ReferenceError';

    if (isCompanyDashboard || isReferenceError) {
      shouldNotify = true;
      notifyReason = isCompanyDashboard 
        ? 'Erro em /dashboard/company (monitoramento total ativo)'
        : 'ReferenceError detectado (erro crítico de código)';
      logStep('Notificação forçada', { reason: notifyReason });
    } else if (errorReport.errorCategory === 'CRITICAL') {
      shouldNotify = true;
      notifyReason = 'Erro crítico';
      logStep('Notificação necessária: erro crítico');
    } else {
      // Verificar se é erro recorrente
      const { count } = await supabaseAdmin
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('error_message', errorReport.errorMessage)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (count && count >= 3) {
        shouldNotify = true;
        notifyReason = `Erro recorrente (${count} ocorrências na última hora)`;
        logStep('Notificação necessária: erro recorrente', { count });
      }

      // Verificar se já foi notificado recentemente (apenas para não-prioritários)
      if (shouldNotify && !isCompanyDashboard && !isReferenceError) {
        const { count: recentNotifications } = await supabaseAdmin
          .from('error_logs')
          .select('*', { count: 'exact', head: true })
          .eq('error_message', errorReport.errorMessage)
          .eq('telegram_notified', true)
          .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());

        if (recentNotifications && recentNotifications > 0) {
          shouldNotify = false;
          notifyReason = '';
          logStep('Notificação cancelada: já notificado recentemente');
        }
      }
    }

    // Adicionar motivo da notificação ao metadata
    if (shouldNotify && notifyReason) {
      enrichedReport.metadata = {
        ...enrichedReport.metadata,
        notify_reason: notifyReason
      };
    }

    // Enviar para Telegram se necessário
    if (shouldNotify) {
      logStep('Enviando para Telegram', { reason: notifyReason });
      
      try {
        const telegramResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-telegram-alert`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              errorData: enrichedReport,
              errorLogId: errorLog.id
            })
          }
        );

        if (!telegramResponse.ok) {
          const responseText = await telegramResponse.text();
          logStep('Erro ao chamar send-telegram-alert', { 
            status: telegramResponse.status,
            body: responseText
          });
        } else {
          logStep('Telegram enviado com sucesso');
        }
      } catch (telegramError) {
        logStep('Erro ao enviar para Telegram (não bloqueante)', {
          error: telegramError instanceof Error ? telegramError.message : String(telegramError)
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      errorLogId: errorLog.id,
      notified: shouldNotify
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
