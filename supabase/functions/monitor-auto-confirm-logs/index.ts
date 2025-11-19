import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Buscar logs recentes (últimas 24h)
    const { data: recentLogs, error } = await supabase
      .from('auto_confirm_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Detectar padrões suspeitos
    const suspiciousPatterns = [];

    // Padrão 1: Muitos logs em curto período (>10 por hora = >240 por 24h)
    if (recentLogs.length > 240) {
      suspiciousPatterns.push(`🚨 Volume alto: ${recentLogs.length} confirmações automáticas nas últimas 24h`);
    }

    // Padrão 2: Confirmações de mesmo usuário repetidas
    const userCounts: Record<string, number> = {};
    recentLogs.forEach(log => {
      if (log.freight_id) {
        userCounts[log.freight_id] = (userCounts[log.freight_id] || 0) + 1;
      }
    });
    const repeatedFreights = Object.entries(userCounts).filter(([_, count]) => count > 5);
    if (repeatedFreights.length > 0) {
      repeatedFreights.forEach(([freightId, count]) => {
        suspiciousPatterns.push(`⚠️ Frete ${freightId.substring(0, 8)} com ${count} confirmações automáticas`);
      });
    }

    // Se houver padrões suspeitos, notificar Telegram
    if (suspiciousPatterns.length > 0) {
      let message = `🔍 <b>MONITORAMENTO: Confirmações Automáticas</b>\n\n`;
      message += `<b>Padrões Detectados:</b>\n`;
      suspiciousPatterns.forEach(pattern => {
        message += `  ${pattern}\n`;
      });
      message += `\n<b>Timestamp:</b> ${new Date().toISOString()}\n`;
      message += `\n💡 <i>Revise os logs no painel de administração</i>`;

      await supabase.functions.invoke('send-telegram-alert', {
        body: { 
          errorData: {
            errorType: 'MONITORING',
            errorCategory: 'AUTO_CONFIRM_PATTERN',
            errorMessage: 'Padrões suspeitos detectados em confirmações automáticas',
            metadata: {
              patterns: suspiciousPatterns,
              total_logs: recentLogs.length,
              timestamp: new Date().toISOString()
            }
          }
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      logs_checked: recentLogs.length,
      suspicious_patterns: suspiciousPatterns.length 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error monitoring auto-confirm logs:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
