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
  console.log(`[HOURLY-QUALITY-REPORT] ${step}${detailsStr}`);
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

type Status = 'OK' | 'ATENCAO' | 'CRITICO';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    logStep('Iniciando relatório de qualidade e confiança');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const cuiabaTime = now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

    let overallStatus: Status = 'OK';
    const issues: string[] = [];

    // ==========================================
    // 1. PAGAMENTOS PENDENTES (FRETES)
    // ==========================================
    logStep('Verificando pagamentos de fretes');
    const { count: pendingFreightPayments } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // Pendentes há mais de 24h
    const { count: pendingPayments24h } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .lt('created_at', last24h.toISOString());

    // Pendentes há mais de 48h (CRÍTICO)
    const { count: pendingPayments48h } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .lt('created_at', last48h.toISOString());

    if ((pendingPayments48h || 0) > 0) {
      overallStatus = 'CRITICO';
      issues.push(`${pendingPayments48h} pagamentos pendentes há +48h`);
    } else if ((pendingPayments24h || 0) > 3) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${pendingPayments24h} pagamentos pendentes há +24h`);
    }

    // ==========================================
    // 2. PAGAMENTOS PENDENTES (SERVIÇOS)
    // ==========================================
    logStep('Verificando pagamentos de serviços');
    const { count: pendingServicePayments } = await supabaseAdmin
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('payment_status', 'PENDING');

    // ==========================================
    // 3. PAGAMENTOS AGUARDANDO CONFIRMAÇÃO DO MOTORISTA
    // ==========================================
    logStep('Verificando confirmações de motorista');
    const { count: awaitingDriverConfirmation } = await supabaseAdmin
      .from('freight_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PAID')
      .eq('driver_confirmed', false);

    if ((awaitingDriverConfirmation || 0) > 10) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${awaitingDriverConfirmation} pagamentos aguardando confirmação do motorista`);
    }

    // ==========================================
    // 4. PAGAMENTOS ATRASADOS (fretes concluídos sem pagamento)
    // ==========================================
    logStep('Verificando pagamentos atrasados');
    const { count: completedWithoutPayment } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')
      .is('payment_id', null);

    if ((completedWithoutPayment || 0) > 5) {
      overallStatus = 'CRITICO';
      issues.push(`${completedWithoutPayment} fretes concluídos sem pagamento`);
    } else if ((completedWithoutPayment || 0) > 2) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${completedWithoutPayment} fretes concluídos sem pagamento`);
    }

    // ==========================================
    // 5. MÉDIA GERAL DE AVALIAÇÕES
    // ==========================================
    logStep('Calculando média de avaliações');
    const { data: allRatings } = await supabaseAdmin
      .from('ratings')
      .select('rating')
      .gte('created_at', last24h.toISOString());

    const totalRatings = allRatings?.length || 0;
    const avgRating = totalRatings > 0
      ? (allRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / totalRatings).toFixed(1)
      : 'N/A';

    // ==========================================
    // 6. AVALIAÇÕES NEGATIVAS (< 3 estrelas)
    // ==========================================
    logStep('Verificando avaliações negativas');
    const negativeRatings = allRatings?.filter(r => r.rating < 3) || [];
    const negativeRatingsCount = negativeRatings.length;

    // Avaliações muito ruins (1 estrela)
    const oneStarRatings = allRatings?.filter(r => r.rating === 1).length || 0;

    if (oneStarRatings > 3) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${oneStarRatings} avaliações de 1 estrela nas últimas 24h`);
    }

    if (negativeRatingsCount > 10) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${negativeRatingsCount} avaliações negativas (<3) nas últimas 24h`);
    }

    // ==========================================
    // 7. FRETES ENTREGUES SEM AVALIAÇÃO
    // ==========================================
    logStep('Verificando fretes sem avaliação');
    const { count: deliveredWithoutRating } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')
      .is('producer_rating', null)
      .lt('completed_at', last24h.toISOString());

    // ==========================================
    // 8. USUÁRIOS COM COMPORTAMENTO SUSPEITO (ANTIFRAUDE)
    // ==========================================
    logStep('Verificando comportamento suspeito');
    
    // Eventos de antifraude não resolvidos
    const { count: unresolvedAntifraudEvents } = await supabaseAdmin
      .from('antifraud_nfe_events')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false)
      .in('severity', ['high', 'critical']);

    // Eventos de auditoria com fraude detectada
    const { count: fraudAlerts } = await supabaseAdmin
      .from('auditoria_eventos')
      .select('*', { count: 'exact', head: true })
      .eq('resolvido', false)
      .in('severidade', ['ALTA', 'CRITICA']);

    // Feedback de antifraude confirmado
    const { count: confirmedFraud } = await supabaseAdmin
      .from('antifraud_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('confirmed_fraud', true)
      .gte('created_at', last24h.toISOString());

    const totalSuspiciousActivity = (unresolvedAntifraudEvents || 0) + (fraudAlerts || 0) + (confirmedFraud || 0);

    if ((confirmedFraud || 0) > 0) {
      overallStatus = 'CRITICO';
      issues.push(`${confirmedFraud} fraudes confirmadas nas últimas 24h`);
    } else if (totalSuspiciousActivity > 5) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${totalSuspiciousActivity} alertas de comportamento suspeito`);
    }

    // ==========================================
    // 9. SOLICITAÇÕES DE SAQUE PENDENTES
    // ==========================================
    logStep('Verificando solicitações de saque');
    const { count: pendingPayouts } = await supabaseAdmin
      .from('balance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'payout_request')
      .eq('status', 'pending');

    // Saques pendentes há mais de 24h
    const { count: stalePayouts } = await supabaseAdmin
      .from('balance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'payout_request')
      .eq('status', 'pending')
      .lt('created_at', last24h.toISOString());

    if ((stalePayouts || 0) > 0) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${stalePayouts} saques pendentes há +24h`);
    }

    // ==========================================
    // 10. VALOR TOTAL PENDENTE
    // ==========================================
    logStep('Calculando valor pendente');
    const { data: pendingPaymentsData } = await supabaseAdmin
      .from('freight_payments')
      .select('amount')
      .eq('status', 'PENDING');

    const totalPendingValue = pendingPaymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendingValue);

    // ==========================================
    // BUILD MESSAGE - FORMATO OBRIGATÓRIO
    // ==========================================
    const statusEmoji = overallStatus === 'CRITICO' ? '🔴' : overallStatus === 'ATENCAO' ? '🟡' : '🟢';

    let message = `💰 <b>QUALIDADE & CONFIANÇA DA PLATAFORMA</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // STATUS GERAL
    message += `📊 <b>Status Geral:</b> ${statusEmoji} ${overallStatus}\n\n`;

    // PAGAMENTOS
    message += `💳 <b>PAGAMENTOS</b>\n`;
    message += `├ Fretes Pendentes: <b>${pendingFreightPayments || 0}</b>\n`;
    message += `│  ├ Há +24h: ${pendingPayments24h || 0}${(pendingPayments24h || 0) > 0 ? ' ⚠️' : ''}\n`;
    message += `│  └ Há +48h: ${pendingPayments48h || 0}${(pendingPayments48h || 0) > 0 ? ' 🚨' : ''}\n`;
    message += `├ Serviços Pendentes: ${pendingServicePayments || 0}\n`;
    message += `├ Aguardando Confirmação Motorista: ${awaitingDriverConfirmation || 0}${(awaitingDriverConfirmation || 0) > 5 ? ' ⚠️' : ''}\n`;
    message += `├ Fretes s/ Pagamento: ${completedWithoutPayment || 0}${(completedWithoutPayment || 0) > 0 ? ' 🚨' : ''}\n`;
    message += `└ Valor Total Pendente: <b>${formattedValue}</b>\n\n`;

    // SAQUES
    message += `💸 <b>SAQUES</b>\n`;
    message += `├ Solicitações Pendentes: ${pendingPayouts || 0}\n`;
    message += `└ Pendentes +24h: ${stalePayouts || 0}${(stalePayouts || 0) > 0 ? ' ⚠️' : ''}\n\n`;

    // AVALIAÇÕES
    message += `⭐ <b>AVALIAÇÕES (24h)</b>\n`;
    message += `├ Total de Avaliações: <b>${totalRatings}</b>\n`;
    message += `├ Média Geral: <b>${avgRating}</b> ⭐\n`;
    message += `├ Avaliações Negativas (1-2⭐): ${negativeRatingsCount}${negativeRatingsCount > 5 ? ' ⚠️' : ''}\n`;
    message += `├ Avaliações 1 Estrela: ${oneStarRatings}${oneStarRatings > 0 ? ' ⚠️' : ''}\n`;
    message += `└ Fretes s/ Avaliação (+24h): ${deliveredWithoutRating || 0}\n\n`;

    // ANTIFRAUDE
    message += `🛡️ <b>ANTIFRAUDE</b>\n`;
    message += `├ Eventos NFe/CTe Pendentes: ${unresolvedAntifraudEvents || 0}\n`;
    message += `├ Alertas de Auditoria: ${fraudAlerts || 0}\n`;
    message += `├ Fraudes Confirmadas (24h): ${confirmedFraud || 0}${(confirmedFraud || 0) > 0 ? ' 🚨' : ''}\n`;
    message += `└ Total Atividade Suspeita: ${totalSuspiciousActivity}\n\n`;

    // ISSUES
    if (issues.length > 0) {
      message += `⚠️ <b>ALERTAS ATIVOS:</b>\n`;
      issues.forEach(issue => {
        message += `• ${issue}\n`;
      });
      message += `\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 Gerado em: ${cuiabaTime}`;

    // Send to Telegram
    const sent = await sendTelegramMessage(message);
    logStep('Relatório enviado', { sent, status: overallStatus, issues: issues.length });

    // Log to audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'HOURLY_QUALITY_REPORT',
        table_name: 'system',
        new_data: {
          status: overallStatus,
          pendingFreightPayments,
          pendingPayments24h,
          pendingPayments48h,
          pendingServicePayments,
          awaitingDriverConfirmation,
          completedWithoutPayment,
          totalRatings,
          avgRating,
          negativeRatingsCount,
          oneStarRatings,
          deliveredWithoutRating,
          totalSuspiciousActivity,
          confirmedFraud,
          pendingPayouts,
          totalPendingValue,
          issues,
          executionTime: Date.now() - startTime,
          reportSent: sent
        }
      });

    return new Response(JSON.stringify({
      success: true,
      status: overallStatus,
      issues,
      metrics: {
        pendingFreightPayments,
        totalRatings,
        avgRating,
        negativeRatingsCount,
        totalSuspiciousActivity
      },
      reportSent: sent,
      executionTime: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    const errorMessage = `🚨 <b>ERRO NO MONITORAMENTO DE QUALIDADE</b>\n\n❌ ${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
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
