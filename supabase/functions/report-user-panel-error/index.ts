import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorReport {
  errorType: 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'NETWORK' | 'PAYMENT';
  errorCategory: 'SIMPLE' | 'CRITICAL';
  errorMessage: string;
  errorStack?: string;
  errorCode?: string;
  module?: string;
  functionName?: string;
  route?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

function logStep(step: string, data?: any) {
  console.log(`[REPORT-USER-PANEL-ERROR] ${step}`, data ? JSON.stringify(data) : '');
}

function getClientIP(req: Request): string {
  const xRealIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  const xForwardedFor = req.headers.get('x-forwarded-for');
  
  return xRealIp || cfConnectingIp || xForwardedFor?.split(',')[0] || 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function invoked', { method: req.method });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const report: ErrorReport = await req.json();
    logStep('Report received', { 
      errorType: report.errorType,
      errorMessage: report.errorMessage,
      route: report.route
    });

    // Enrich with server-side data
    const enrichedData = {
      ...report,
      metadata: {
        ...report.metadata,
        ip: getClientIP(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        referer: req.headers.get('referer') || 'unknown',
        timestamp: new Date().toISOString(),
        user_panel: true,
        notifyReason: 'USER_PANEL_ERROR'
      }
    };

    logStep('Data enriched', { ip: enrichedData.metadata.ip });

    // Insert into error_logs
    const { data: errorLog, error: insertError } = await supabase
      .from('error_logs')
      .insert({
        error_type: enrichedData.errorType,
        error_category: enrichedData.errorCategory,
        error_message: enrichedData.errorMessage,
        error_stack: enrichedData.errorStack,
        error_code: enrichedData.errorCode,
        module: enrichedData.module,
        function_name: enrichedData.functionName,
        route: enrichedData.route,
        user_id: enrichedData.userId,
        user_email: enrichedData.userEmail,
        status: 'NOTIFIED',
        auto_correction_attempted: false,
        metadata: enrichedData.metadata
      })
      .select()
      .single();

    if (insertError) {
      logStep('Error inserting log', { error: insertError });
      throw new Error(`Failed to insert error log: ${insertError.message}`);
    }

    const errorLogId = errorLog.id;
    logStep('Error log created', { errorLogId });

    // ALWAYS invoke send-telegram-alert
    logStep('Invoking send-telegram-alert');
    const { data: telegramData, error: telegramError } = await supabase.functions.invoke(
      'send-telegram-alert',
      {
        body: {
          errorData: enrichedData,
          errorLogId
        }
      }
    );

    let notified = false;
    if (telegramError) {
      logStep('Telegram alert failed', { error: telegramError });
      
      // Update log as notification failed
      await supabase
        .from('error_logs')
        .update({ 
          telegram_notified: false,
          status: 'PERSISTENT'
        })
        .eq('id', errorLogId);
    } else {
      logStep('Telegram alert sent', { success: telegramData?.success });
      notified = telegramData?.success || false;
      
      // Update log with notification status
      await supabase
        .from('error_logs')
        .update({ 
          telegram_notified: notified,
          telegram_sent_at: notified ? new Date().toISOString() : null
        })
        .eq('id', errorLogId);
    }

    logStep('Process complete', { notified, errorLogId });

    return new Response(
      JSON.stringify({
        success: true,
        notified,
        errorLogId,
        message: notified 
          ? 'Erro reportado e notificação enviada ao Telegram'
          : 'Erro registrado, notificação pendente'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    logStep('Fatal error', { error: error.message });
    
    return new Response(
      JSON.stringify({
        success: false,
        notified: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
