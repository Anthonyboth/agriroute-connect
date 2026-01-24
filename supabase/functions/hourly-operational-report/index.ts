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
  console.log(`[HOURLY-OPERATIONAL-REPORT] ${step}${detailsStr}`);
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

type Status = 'OK' | 'ATENCAO' | 'GARGALO';

interface OperationalMetric {
  name: string;
  value: number | string;
  status: Status;
  details?: string;
}

function getStatusEmoji(status: Status): string {
  switch (status) {
    case 'GARGALO': return '🔴';
    case 'ATENCAO': return '🟡';
    case 'OK': return '🟢';
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    logStep('Iniciando relatório horário operacional');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last6h = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const cuiabaTime = now.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

    const metrics: OperationalMetric[] = [];
    let hasGargalo = false;
    let hasAtencao = false;

    // ================== CADASTROS ==================
    logStep('Verificando cadastros');

    // Cadastros iniciados (profiles criados)
    const { count: startedSignups } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    // Cadastros concluídos (perfis com status ativo ou approved)
    const { count: completedSignups } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .or('registration_status.eq.approved,registration_status.eq.approved_verified');

    const signupConversionRate = startedSignups && startedSignups > 0 
      ? Math.round(((completedSignups || 0) / startedSignups) * 100) 
      : 100;

    let signupStatus: Status = 'OK';
    if (signupConversionRate < 50 && (startedSignups || 0) > 3) { signupStatus = 'GARGALO'; hasGargalo = true; }
    else if (signupConversionRate < 80 && (startedSignups || 0) > 3) { signupStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Cadastros (1h)',
      value: `${completedSignups || 0}/${startedSignups || 0}`,
      status: signupStatus,
      details: `${signupConversionRate}% conversão`
    });

    // Erros de login/cadastro mais frequentes
    const { data: authErrors } = await supabaseAdmin
      .from('error_logs')
      .select('error_message')
      .gte('created_at', oneHourAgo.toISOString())
      .or('function_name.ilike.%auth%,function_name.ilike.%login%,function_name.ilike.%signup%,module.ilike.%auth%');

    const errorCounts: Record<string, number> = {};
    authErrors?.forEach(e => {
      const msg = (e.error_message || 'unknown').substring(0, 50);
      errorCounts[msg] = (errorCounts[msg] || 0) + 1;
    });
    const topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topErrors.length > 0) {
      metrics.push({
        name: 'Top Erros Auth (1h)',
        value: topErrors.length,
        status: topErrors.length > 5 ? 'ATENCAO' : 'OK',
        details: topErrors.slice(0, 2).map(([e, c]) => `${e.substring(0, 25)}(${c}x)`).join(', ')
      });
    }

    // Perfis pendentes de aprovação
    const { count: pendingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .or('registration_status.eq.pending,registration_status.eq.pending_verification');

    let pendingStatus: Status = 'OK';
    if ((pendingProfiles || 0) > 20) { pendingStatus = 'GARGALO'; hasGargalo = true; }
    else if ((pendingProfiles || 0) > 10) { pendingStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Perfis Pendentes',
      value: pendingProfiles || 0,
      status: pendingStatus
    });

    // ================== FRETES ==================
    logStep('Verificando fretes');

    // Fretes abertos por tipo
    const { data: openFreights } = await supabaseAdmin
      .from('freights')
      .select('id, status, freight_type, service_type')
      .in('status', ['WAITING_PICKUP', 'OPEN', 'PENDING']);

    const freightsByType: Record<string, number> = {};
    openFreights?.forEach(f => {
      const type = f.freight_type || f.service_type || 'OUTROS';
      freightsByType[type] = (freightsByType[type] || 0) + 1;
    });

    metrics.push({
      name: 'Fretes Abertos',
      value: openFreights?.length || 0,
      status: 'OK',
      details: Object.entries(freightsByType).slice(0, 3).map(([t, c]) => `${t}: ${c}`).join(', ')
    });

    // Fretes sem proposta há mais de 6 horas
    const { count: freightsWithoutProposals } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'WAITING_PICKUP'])
      .lt('created_at', last6h.toISOString())
      .eq('proposals_count', 0);

    let noProposalStatus: Status = 'OK';
    if ((freightsWithoutProposals || 0) > 10) { noProposalStatus = 'GARGALO'; hasGargalo = true; }
    else if ((freightsWithoutProposals || 0) > 5) { noProposalStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Fretes s/ Proposta (+6h)',
      value: freightsWithoutProposals || 0,
      status: noProposalStatus
    });

    // Propostas criadas vs aceitas (taxa de conversão)
    const { count: proposalsCreated } = await supabaseAdmin
      .from('freight_proposals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    const { count: proposalsAccepted } = await supabaseAdmin
      .from('freight_proposals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())
      .eq('status', 'ACCEPTED');

    const proposalConversion = proposalsCreated && proposalsCreated > 0
      ? Math.round(((proposalsAccepted || 0) / proposalsCreated) * 100)
      : 0;

    let proposalStatus: Status = 'OK';
    if (proposalConversion < 10 && (proposalsCreated || 0) > 10) { proposalStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Propostas (1h)',
      value: `${proposalsAccepted || 0}/${proposalsCreated || 0}`,
      status: proposalStatus,
      details: `${proposalConversion}% aceitas`
    });

    // Fretes em andamento sem atualização há muito tempo
    const { count: staleInTransit } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_TRANSIT')
      .lt('updated_at', last24h.toISOString());

    let staleStatus: Status = 'OK';
    if ((staleInTransit || 0) > 5) { staleStatus = 'GARGALO'; hasGargalo = true; }
    else if ((staleInTransit || 0) > 2) { staleStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Em Trânsito (s/ update 24h)',
      value: staleInTransit || 0,
      status: staleStatus
    });

    // Entregas atrasadas
    const { count: overdueDeliveries } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .in('status', ['IN_TRANSIT', 'WAITING_PICKUP'])
      .lt('estimated_delivery_date', now.toISOString());

    let overdueStatus: Status = 'OK';
    if ((overdueDeliveries || 0) > 5) { overdueStatus = 'GARGALO'; hasGargalo = true; }
    else if ((overdueDeliveries || 0) > 2) { overdueStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Entregas Atrasadas',
      value: overdueDeliveries || 0,
      status: overdueStatus
    });

    // Confirmações de entrega pendentes
    const { count: pendingConfirmations } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'DELIVERED')
      .eq('delivery_confirmed', false);

    let confirmStatus: Status = 'OK';
    if ((pendingConfirmations || 0) > 10) { confirmStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Confirmações Pendentes',
      value: pendingConfirmations || 0,
      status: confirmStatus
    });

    // ================== SERVIÇOS ==================
    logStep('Verificando serviços');

    const { count: openServices } = await supabaseAdmin
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'PENDING', 'AWAITING_PROVIDER']);

    metrics.push({
      name: 'Serviços Abertos',
      value: openServices || 0,
      status: 'OK'
    });

    // ================== AVALIAÇÕES ==================
    logStep('Verificando avaliações');

    // Média de avaliações
    const { data: recentRatings } = await supabaseAdmin
      .from('ratings')
      .select('rating')
      .gte('created_at', last24h.toISOString());

    const avgRating = recentRatings && recentRatings.length > 0
      ? (recentRatings.reduce((sum, r) => sum + r.rating, 0) / recentRatings.length).toFixed(1)
      : 'N/A';

    // Avaliações ruins (1-2 estrelas)
    const badRatings = recentRatings?.filter(r => r.rating <= 2).length || 0;

    let ratingStatus: Status = 'OK';
    if (badRatings > 5) { ratingStatus = 'GARGALO'; hasGargalo = true; }
    else if (badRatings > 2) { ratingStatus = 'ATENCAO'; hasAtencao = true; }

    metrics.push({
      name: 'Avaliações (24h)',
      value: recentRatings?.length || 0,
      status: ratingStatus,
      details: `Média: ${avgRating} ⭐ | ${badRatings} ruins`
    });

    // Avaliações pendentes (fretes concluídos sem avaliação)
    const { count: pendingRatings } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED')
      .lt('completed_at', last24h.toISOString())
      .is('producer_rating', null);

    metrics.push({
      name: 'Avaliações Pendentes',
      value: pendingRatings || 0,
      status: (pendingRatings || 0) > 20 ? 'ATENCAO' : 'OK'
    });

    // ================== BUILD MESSAGE ==================
    const gargaloMetrics = metrics.filter(m => m.status === 'GARGALO');
    const atencaoMetrics = metrics.filter(m => m.status === 'ATENCAO');
    const okMetrics = metrics.filter(m => m.status === 'OK');

    let overallStatus = '🟢 NORMAL';
    if (hasGargalo) overallStatus = '🔴 GARGALOS';
    else if (hasAtencao) overallStatus = '🟡 ATENÇÃO';

    let message = `🚚 <b>OPERAÇÃO & QUALIDADE - AgriRoute</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📊 <b>Status:</b> ${overallStatus}\n`;
    message += `🕐 <b>Período:</b> Última 1 hora\n\n`;

    if (gargaloMetrics.length > 0) {
      message += `🔴 <b>GARGALOS (${gargaloMetrics.length}):</b>\n`;
      gargaloMetrics.forEach(m => {
        message += `├ ${m.name}: <b>${m.value}</b>`;
        if (m.details) message += ` (${m.details})`;
        message += `\n`;
      });
      message += `\n`;
    }

    if (atencaoMetrics.length > 0) {
      message += `🟡 <b>ATENÇÃO (${atencaoMetrics.length}):</b>\n`;
      atencaoMetrics.forEach(m => {
        message += `├ ${m.name}: <b>${m.value}</b>`;
        if (m.details) message += ` (${m.details})`;
        message += `\n`;
      });
      message += `\n`;
    }

    message += `🟢 <b>OK (${okMetrics.length}):</b>\n`;
    okMetrics.slice(0, 6).forEach(m => {
      message += `├ ${m.name}: ${m.value}`;
      if (m.details) message += ` (${m.details})`;
      message += `\n`;
    });
    if (okMetrics.length > 6) {
      message += `└ ... e mais ${okMetrics.length - 6} métricas OK\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `⏱️ Gerado em: ${cuiabaTime}`;

    // Send to Telegram
    const sent = await sendTelegramMessage(message);
    logStep('Relatório enviado', { sent, gargalos: gargaloMetrics.length, atencao: atencaoMetrics.length });

    // Log to audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'HOURLY_OPERATIONAL_REPORT',
        table_name: 'system',
        new_data: {
          gargaloCount: gargaloMetrics.length,
          atencaoCount: atencaoMetrics.length,
          metrics,
          executionTime: Date.now() - startTime,
          reportSent: sent
        }
      });

    return new Response(JSON.stringify({
      success: true,
      gargaloCount: gargaloMetrics.length,
      atencaoCount: atencaoMetrics.length,
      metrics,
      reportSent: sent,
      executionTime: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    logStep('ERRO', error);
    
    const errorMessage = `🚨 <b>ERRO NO MONITORAMENTO OPERACIONAL</b>\n\n❌ ${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`;
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
