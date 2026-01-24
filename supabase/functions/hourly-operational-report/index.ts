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

type Status = 'OK' | 'ATENCAO' | 'CRITICO';

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

    let overallStatus: Status = 'OK';
    const issues: string[] = [];

    // ==========================================
    // 1. FRETES ABERTOS POR TIPO
    // ==========================================
    logStep('Verificando fretes abertos');
    
    const { data: openFreights } = await supabaseAdmin
      .from('freights')
      .select('id, freight_type, service_type, status, created_at, updated_at')
      .in('status', ['OPEN', 'WAITING_PICKUP', 'PENDING']);

    // Contar por tipo de veículo/serviço
    const freightsByType: Record<string, number> = {
      'CAMINHAO': 0,
      'MOTO': 0,
      'GUINCHO': 0,
      'SERVICO': 0,
      'OUTROS': 0
    };

    openFreights?.forEach(f => {
      const type = f.freight_type?.toUpperCase() || f.service_type?.toUpperCase() || '';
      
      if (type.includes('CAMINHAO') || type.includes('TRUCK') || type.includes('CARRETA')) {
        freightsByType['CAMINHAO']++;
      } else if (type.includes('MOTO') || type.includes('BIKE')) {
        freightsByType['MOTO']++;
      } else if (type.includes('GUINCHO') || type.includes('REBOQUE') || type.includes('TOW')) {
        freightsByType['GUINCHO']++;
      } else if (type.includes('SERVICO') || type.includes('SERVICE')) {
        freightsByType['SERVICO']++;
      } else {
        freightsByType['OUTROS']++;
      }
    });

    const totalOpenFreights = openFreights?.length || 0;

    // ==========================================
    // 2. FRETES EM ANDAMENTO
    // ==========================================
    logStep('Verificando fretes em andamento');
    const { count: inTransitFreights } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_TRANSIT');

    // ==========================================
    // 3. FRETES PRÓXIMOS DE CANCELAMENTO AUTOMÁTICO (24h+)
    // ==========================================
    logStep('Verificando fretes estagnados');
    const { data: staleFreights } = await supabaseAdmin
      .from('freights')
      .select('id, status, created_at')
      .in('status', ['OPEN', 'WAITING_PICKUP'])
      .lt('created_at', last24h.toISOString());

    const staleFreightsCount = staleFreights?.length || 0;
    if (staleFreightsCount > 5) {
      overallStatus = 'CRITICO';
      issues.push(`${staleFreightsCount} fretes há +24h sem movimento`);
    } else if (staleFreightsCount > 2) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${staleFreightsCount} fretes há +24h sem movimento`);
    }

    // ==========================================
    // 4. SERVIÇOS ABERTOS
    // ==========================================
    logStep('Verificando serviços abertos');
    const { count: openServices } = await supabaseAdmin
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'PENDING', 'AWAITING_PROVIDER']);

    // ==========================================
    // 5. PROPOSTAS ENVIADAS (últimas 24h)
    // ==========================================
    logStep('Verificando propostas');
    const { count: proposals24h } = await supabaseAdmin
      .from('freight_proposals')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h.toISOString());

    // Propostas aceitas
    const { count: acceptedProposals24h } = await supabaseAdmin
      .from('freight_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACCEPTED')
      .gte('created_at', last24h.toISOString());

    const proposalConversionRate = (proposals24h && proposals24h > 0) 
      ? Math.round(((acceptedProposals24h || 0) / proposals24h) * 100) 
      : 0;

    if (proposalConversionRate < 10 && (proposals24h || 0) > 20) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`Taxa de conversão de propostas baixa (${proposalConversionRate}%)`);
    }

    // ==========================================
    // 6. CONTRA-PROPOSTAS PENDENTES DE RESPOSTA
    // ==========================================
    logStep('Verificando contra-propostas');
    const { count: pendingCounterProposals } = await supabaseAdmin
      .from('freight_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COUNTER_PROPOSED');

    // Contra-propostas pendentes há mais de 6h
    const { count: staleCounterProposals } = await supabaseAdmin
      .from('freight_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COUNTER_PROPOSED')
      .lt('updated_at', last6h.toISOString());

    if ((staleCounterProposals || 0) > 5) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${staleCounterProposals} contra-propostas sem resposta há +6h`);
    }

    // ==========================================
    // 7. FRETES TRAVADOS POR ERRO DE STATUS
    // ==========================================
    logStep('Verificando fretes com status inconsistente');
    
    // Fretes "IN_TRANSIT" sem atualização há mais de 48h
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const { count: stuckInTransit } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_TRANSIT')
      .lt('updated_at', twoDaysAgo.toISOString());

    // Fretes "DELIVERED" mas não confirmados há mais de 48h
    const { count: unconfirmedDeliveries } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'DELIVERED')
      .eq('delivery_confirmed', false)
      .lt('updated_at', twoDaysAgo.toISOString());

    const stuckFreightsTotal = (stuckInTransit || 0) + (unconfirmedDeliveries || 0);
    if (stuckFreightsTotal > 3) {
      overallStatus = 'CRITICO';
      issues.push(`${stuckFreightsTotal} fretes possivelmente travados`);
    } else if (stuckFreightsTotal > 0) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${stuckFreightsTotal} fretes possivelmente travados`);
    }

    // ==========================================
    // 8. ENTREGAS ATRASADAS
    // ==========================================
    logStep('Verificando entregas atrasadas');
    const { count: overdueDeliveries } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .in('status', ['IN_TRANSIT', 'WAITING_PICKUP'])
      .lt('estimated_delivery_date', now.toISOString());

    if ((overdueDeliveries || 0) > 5) {
      if (overallStatus !== 'CRITICO') overallStatus = 'ATENCAO';
      issues.push(`${overdueDeliveries} entregas atrasadas`);
    }

    // ==========================================
    // 9. COMPARAÇÃO COM DASHBOARD (sanity check)
    // ==========================================
    // Aqui verificamos se os números são consistentes
    const { count: dashboardOpenFreights } = await supabaseAdmin
      .from('freights')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'WAITING_PICKUP', 'PENDING']);

    const divergence = Math.abs((dashboardOpenFreights || 0) - totalOpenFreights);
    const hasDivergence = divergence > 0;

    // ==========================================
    // BUILD MESSAGE - FORMATO OBRIGATÓRIO
    // ==========================================
    const statusEmoji = overallStatus === 'CRITICO' ? '🔴' : overallStatus === 'ATENCAO' ? '🟡' : '🟢';

    let message = `🚚 <b>STATUS OPERACIONAL — FRETES & SERVIÇOS</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // STATUS GERAL
    message += `📊 <b>Status Geral:</b> ${statusEmoji} ${overallStatus}\n\n`;

    // FRETES ABERTOS POR TIPO
    message += `📦 <b>FRETES ABERTOS</b> (Total: <b>${totalOpenFreights}</b>)\n`;
    message += `├ 🚛 Caminhão: ${freightsByType['CAMINHAO']}\n`;
    message += `├ 🏍️ Moto: ${freightsByType['MOTO']}\n`;
    message += `├ 🚗 Guincho: ${freightsByType['GUINCHO']}\n`;
    message += `├ 🔧 Serviços: ${freightsByType['SERVICO']}\n`;
    message += `└ 📋 Outros: ${freightsByType['OUTROS']}\n\n`;

    // STATUS DOS FRETES
    message += `🔄 <b>MOVIMENTAÇÃO</b>\n`;
    message += `├ Em Andamento: <b>${inTransitFreights || 0}</b>\n`;
    message += `├ Próximos de Cancelamento (+24h): ${staleFreightsCount}${staleFreightsCount > 0 ? ' ⚠️' : ''}\n`;
    message += `├ Entregas Atrasadas: ${overdueDeliveries || 0}${(overdueDeliveries || 0) > 0 ? ' ⚠️' : ''}\n`;
    message += `└ Travados por Erro: ${stuckFreightsTotal}${stuckFreightsTotal > 0 ? ' 🚨' : ''}\n\n`;

    // SERVIÇOS
    message += `🔧 <b>SERVIÇOS</b>\n`;
    message += `└ Serviços Abertos: <b>${openServices || 0}</b>\n\n`;

    // PROPOSTAS
    message += `💼 <b>PROPOSTAS (24h)</b>\n`;
    message += `├ Propostas Enviadas: <b>${proposals24h || 0}</b>\n`;
    message += `├ Propostas Aceitas: ${acceptedProposals24h || 0} (${proposalConversionRate}%)\n`;
    message += `├ Contra-Propostas Pendentes: ${pendingCounterProposals || 0}\n`;
    message += `└ Contra-Propostas s/ Resposta (+6h): ${staleCounterProposals || 0}${(staleCounterProposals || 0) > 0 ? ' ⚠️' : ''}\n\n`;

    // DIVERGÊNCIA
    if (hasDivergence) {
      message += `⚠️ <b>DIVERGÊNCIA DETECTADA:</b>\n`;
      message += `├ Contagem API: ${totalOpenFreights}\n`;
      message += `├ Contagem Dashboard: ${dashboardOpenFreights}\n`;
      message += `└ Diferença: ${divergence}\n\n`;
    }

    // ISSUES
    if (issues.length > 0) {
      message += `⚠️ <b>ALERTAS ATIVOS:</b>\n`;
      issues.forEach(issue => {
        message += `• ${issue}\n`;
      });
      message += `\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 Gerado em: ${cuiabaTime}`;

    // Send to Telegram
    const sent = await sendTelegramMessage(message);
    logStep('Relatório enviado', { sent, status: overallStatus, issues: issues.length });

    // Log to audit
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        operation: 'HOURLY_OPERATIONAL_REPORT',
        table_name: 'system',
        new_data: {
          status: overallStatus,
          totalOpenFreights,
          freightsByType,
          inTransitFreights,
          staleFreightsCount,
          openServices,
          proposals24h,
          acceptedProposals24h,
          pendingCounterProposals,
          stuckFreightsTotal,
          overdueDeliveries,
          hasDivergence,
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
        totalOpenFreights,
        freightsByType,
        inTransitFreights,
        proposals24h,
        stuckFreightsTotal
      },
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
