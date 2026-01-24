import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = '-1003009756749';

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[HOURLY-FINANCIAL-REPORT] ${step}${detailsStr}`);
};

async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    logStep('TELEGRAM_BOT_TOKEN não configurado');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      logStep('Erro na API do Telegram', { status: response.status, error: errorText });
      return false;
    }
    
    return true;
  } catch (error) {
    logStep('Erro ao enviar Telegram', error);
    return false;
  }
}

type Status = 'OK' | 'ALERTA' | 'CRITICO';

interface FinancialMetric {
  name: string;
  value: number | string;
  status: Status;
  details?: string;
}

interface PerformanceMetric {
  name: string;
  latencyAvg: number;
  latencyP95: number;
  errorRate: number;
  status: Status;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    logStep('Iniciando relatório horário financeiro e performance');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const cuiabaTime = now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

    const financialMetrics: FinancialMetric[] = [];
    const performanceMetrics: PerformanceMetric[] = [];
    let hasFinancialCritical = false;
    let hasFinancialAlert = false;
    let hasPerfCritical = false;
    let hasPerfAlert = false;

    // ================== FINANCEIRO ==================
    logStep('Verificando métricas financeiras');

    // 1. Pagamentos pendentes no painel do produtor
    const { count: pendingPayments } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    let pendingStatus: Status = 'OK';
    if ((pendingPayments || 0) > 20) { pendingStatus = 'CRITICO'; hasFinancialCritical = true; }
    else if ((pendingPayments || 0) > 10) { pendingStatus = 'ALERTA'; hasFinancialAlert = true; }

    financialMetrics.push({
      name: 'Pagamentos Pendentes',
      value: pendingPayments || 0,
      status: pendingStatus
    });

    // 2. Solicitações de pagamento recebidas (última 1h)
    const { count: paymentRequests1h } = await supabaseAdmin
      .from('balance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'payout_request')
      .gte('created_at', oneHourAgo.toISOString());

    financialMetrics.push({
      name: 'Solicitações Saque (1h)',
      value: paymentRequests1h || 0,
      status: 'OK'
    });

    // 3. Pagamentos aguardando confirmação do motorista
    const { count: awaitingDriverConfirm } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PAID')
      .eq('driver_confirmed', false);

    let confirmStatus: Status = 'OK';
    if ((awaitingDriverConfirm || 0) > 10) { confirmStatus = 'ALERTA'; hasFinancialAlert = true; }

    financialMetrics.push({
      name: 'Aguardando Confirmação',
      value: awaitingDriverConfirm || 0,
      status: confirmStatus
    });

    // 4. Pagamentos pendentes há mais de 24h
    const { count: pending24h } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .lt('created_at', last24h.toISOString());

    let pending24Status: Status = 'OK';
    if ((pending24h || 0) > 5) { pending24Status = 'CRITICO'; hasFinancialCritical = true; }
    else if ((pending24h || 0) > 2) { pending24Status = 'ALERTA'; hasFinancialAlert = true; }

    financialMetrics.push({
      name: 'Pendentes +24h',
      value: pending24h || 0,
      status: pending24Status
    });

    // 5. Pagamentos pendentes há mais de 48h
    const { count: pending48h } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .lt('created_at', last48h.toISOString());

    let pending48Status: Status = 'OK';
    if ((pending48h || 0) > 0) { pending48Status = 'CRITICO'; hasFinancialCritical = true; }

    financialMetrics.push({
      name: 'Pendentes +48h',
      value: pending48h || 0,
      status: pending48Status
    });

    // 6. Fretes concluídos sem pagamento associado
    const { count: freightsNoPayment } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')
      .is('payment_id', null);

    let noPaymentStatus: Status = 'OK';
    if ((freightsNoPayment || 0) > 10) { noPaymentStatus = 'CRITICO'; hasFinancialCritical = true; }
    else if ((freightsNoPayment || 0) > 5) { noPaymentStatus = 'ALERTA'; hasFinancialAlert = true; }

    financialMetrics.push({
      name: 'Fretes s/ Pagamento',
      value: freightsNoPayment || 0,
      status: noPaymentStatus
    });

    // 7. Valor total em pagamentos pendentes
    const { data: pendingPaymentsValue } = await supabaseAdmin
      .from('freight_payments')
      .select('amount')
      .eq('status', 'PENDING');

    const totalPendingValue = pendingPaymentsValue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingValue);

    financialMetrics.push({
      name: 'Valor Pendente Total',
      value: formattedValue,
      status: totalPendingValue > 50000 ? 'ALERTA' : 'OK'
    });

    // ================== PERFORMANCE ==================
    logStep('Verificando métricas de performance');

    // Buscar erros de edge functions na última hora
    const { data: functionErrors } = await supabaseAdmin
      .from('error_logs')
      .select('function_name, created_at, error_category, metadata')
      .gte('created_at', oneHourAgo.toISOString())
      .not('function_name', 'is', null);

    // Agrupar erros por função
    const errorsByFunction: Record<string, { count: number; latencies: number[] }> = {};
    functionErrors?.forEach(e => {
      const fn = e.function_name || 'unknown';
      if (!errorsByFunction[fn]) {
        errorsByFunction[fn] = { count: 0, latencies: [] };
      }
      errorsByFunction[fn].count++;
      if (e.metadata?.latency) {
        errorsByFunction[fn].latencies.push(e.metadata.latency);
      }
    });

    // Funções críticas a monitorar
    const criticalFunctions = [
      'create-checkout',
      'stripe-webhook',
      'payment-webhook',
      'accept-freight',
      'accept-freight-proposal',
      'create-freight-payment',
      'nfe-emitir',
      'cte-emitir',
      'mdfe-emitir'
    ];

    // Analisar funções críticas
    for (const fn of criticalFunctions) {
      const errors = errorsByFunction[fn]?.count || 0;
      const latencies = errorsByFunction[fn]?.latencies || [];
      
      const avgLatency = latencies.length > 0 
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
      
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p95Latency = sortedLatencies[p95Index] || 0;

      // Calcular taxa de erro (estimativa baseada em logs)
      const errorRate = errors > 0 ? Math.min(errors * 5, 100) : 0; // Assumindo ~5% por erro registrado

      let status: Status = 'OK';
      if (errors > 10 || errorRate > 20 || avgLatency > 5000) {
        status = 'CRITICO';
        hasPerfCritical = true;
      } else if (errors > 3 || errorRate > 10 || avgLatency > 3000) {
        status = 'ALERTA';
        hasPerfAlert = true;
      }

      if (errors > 0 || status !== 'OK') {
        performanceMetrics.push({
          name: fn,
          latencyAvg: avgLatency,
          latencyP95: p95Latency,
          errorRate,
          status
        });
      }
    }

    // Taxa geral de erros 4xx/5xx
    const { count: total4xxErrors } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .or('metadata->>status_code.gte.400,error_category.eq.HTTP_ERROR');

    const { count: total5xxErrors } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .or('metadata->>status_code.gte.500,error_category.eq.SERVER_ERROR');

    // ================== INTEGRAÇÕES ==================
    logStep('Verificando integrações');

    // Verificar erros de integração NF-e / SEFAZ
    const { count: nfeErrors } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .or('function_name.ilike.%nfe%,function_name.ilike.%cte%,function_name.ilike.%mdfe%,function_name.ilike.%sefaz%');

    let nfeStatus: Status = 'OK';
    if ((nfeErrors || 0) > 10) { nfeStatus = 'CRITICO'; hasPerfCritical = true; }
    else if ((nfeErrors || 0) > 3) { nfeStatus = 'ALERTA'; hasPerfAlert = true; }

    // Verificar erros de pagamento/Stripe
    const { count: stripeErrors } = await supabaseAdmin
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .or('function_name.ilike.%stripe%,function_name.ilike.%payment%,function_name.ilike.%checkout%');

    let stripeStatus: Status = 'OK';
    if ((stripeErrors || 0) > 10) { stripeStatus = 'CRITICO'; hasPerfCritical = true; }
    else if ((stripeErrors || 0) > 3) { stripeStatus = 'ALERTA'; hasPerfAlert = true; }

    // ================== BUILD MESSAGE ==================
    let overallFinancial = '🟢 OK';
    if (hasFinancialCritical) overallFinancial = '🔴 CRÍTICO';
    else if (hasFinancialAlert) overallFinancial = '🟡 ALERTA';

    let overallPerf = '🟢 OK';
    if (hasPerfCritical) overallPerf = '🔴 CRÍTICO';
    else if (hasPerfAlert) overallPerf = '🟡 ALERTA';

    let message = `💳 <b>FINANCEIRO & PERFORMANCE</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // FINANCEIRO
    message += `💰 <b>FINANCEIRO:</b> ${overallFinancial}\n`;
    
    const criticalFinancial = financialMetrics.filter(m => m.status === 'CRITICO');
    const alertFinancial = financialMetrics.filter(m => m.status === 'ALERTA');
    const okFinancial = financialMetrics.filter(m => m.status === 'OK');

    if (criticalFinancial.length > 0) {
      criticalFinancial.forEach(m => {
        message += `🔴 ${m.name}: <b>${m.value}</b>${m.details ? ` (${m.details})` : ''}\n`;
      });
    }
    if (alertFinancial.length > 0) {
      alertFinancial.forEach(m => {
        message += `🟡 ${m.name}: <b>${m.value}</b>${m.details ? ` (${m.details})` : ''}\n`;
      });
    }
    okFinancial.slice(0, 4).forEach(m => {
      message += `🟢 ${m.name}: ${m.value}\n`;
    });

    message += `\n`;

    // PERFORMANCE
    message += `⚡ <b>PERFORMANCE:</b> ${overallPerf}\n`;
    message += `├ Erros 4xx (1h): ${total4xxErrors || 0}\n`;
    message += `├ Erros 5xx (1h): ${total5xxErrors || 0}\n`;

    const criticalPerf = performanceMetrics.filter(m => m.status === 'CRITICO');
    const alertPerf = performanceMetrics.filter(m => m.status === 'ALERTA');

    if (criticalPerf.length > 0 || alertPerf.length > 0) {
      message += `├ <b>Funções com Problemas:</b>\n`;
      [...criticalPerf, ...alertPerf].forEach(m => {
        const emoji = m.status === 'CRITICO' ? '🔴' : '🟡';
        message += `│  ${emoji} ${m.name}: ${m.errorRate}% erros\n`;
      });
    }

    message += `\n`;

    // INTEGRAÇÕES
    message += `🔌 <b>INTEGRAÇÕES:</b>\n`;
    message += `├ NF-e/SEFAZ: ${getStatusEmoji(nfeStatus)} ${nfeErrors || 0} erros\n`;
    message += `├ Stripe/Pagamentos: ${getStatusEmoji(stripeStatus)} ${stripeErrors || 0} erros\n`;

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⏱️ Gerado em: ${cuiabaTime}`;

    function getStatusEmoji(status: Status): string {
      switch (status) {
        case 'CRITICO': return '🔴';
        case 'ALERTA': return '🟡';
        case 'OK': return '🟢';
      }
    }

    // Send to Telegram
    const sent = await sendTelegramMessage(message);
    logStep('Relatório enviado', { sent, financial: financialMetrics.length, perf: performanceMetrics.length });

    // Log to audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'HOURLY_FINANCIAL_REPORT',
        table_name: 'system',
        new_data: {
          financialMetrics,
          performanceMetrics,
          total4xxErrors,
          total5xxErrors,
          nfeErrors,
          stripeErrors,
          executionTime: Date.now() - startTime,
          reportSent: sent
        }
      });

    return new Response(JSON.stringify({
      success: true,
      financialMetrics,
      performanceMetrics,
      integrations: {
        nfeErrors,
        stripeErrors
      },
      reportSent: sent,
      executionTime: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    const errorMessage = `🚨 <b>ERRO NO MONITORAMENTO FINANCEIRO</b>\n\n❌ ${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
    await sendTelegramMessage(errorMessage);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
