import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Monitora a tabela city_id_mismatch_logs e envia alertas Telegram
 * quando o trigger do banco corrige automaticamente um city_id errado.
 * Roda a cada 60s, apenas para admins (falha silenciosamente para outros).
 */
export function useCityIdMismatchMonitor() {
  const lastCheckedRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    const checkMismatches = async () => {
      try {
        const { data, error } = await supabase
          .from('city_id_mismatch_logs')
          .select('*')
          .gt('corrected_at', lastCheckedRef.current)
          .order('corrected_at', { ascending: false })
          .limit(10);

        if (error || !data || data.length === 0) return;

        lastCheckedRef.current = new Date().toISOString();

        // Enviar alerta Telegram para cada mismatch
        for (const log of data) {
          const message = [
            `🚨 CITY_ID MISMATCH CORRIGIDO`,
            ``,
            `Frete: ${log.freight_id}`,
            `Campo: ${log.field_name}`,
            `Cidade: ${log.city_name}/${log.state}`,
            `ID errado: ${log.wrong_city_id}`,
            `ID correto: ${log.correct_city_id}`,
            `Operação: ${log.operation}`,
            ``,
            `⚠️ O trigger corrigiu automaticamente, mas isso indica um bug no frontend que precisa ser investigado.`,
          ].join('\n');

          await supabase.functions.invoke('report-error', {
            body: {
              errorType: 'RUNTIME_ERROR',
              errorCategory: 'CRITICAL',
              errorMessage: `CITY_ID MISMATCH: ${log.city_name}/${log.state} - wrong=${log.wrong_city_id} correct=${log.correct_city_id}`,
              module: 'backfill_freight_city_ids_trigger',
              route: '/database-trigger',
              metadata: {
                freight_id: log.freight_id,
                field_name: log.field_name,
                city_name: log.city_name,
                state: log.state,
                wrong_city_id: log.wrong_city_id,
                correct_city_id: log.correct_city_id,
                operation: log.operation,
                telegram_message: message,
              },
            },
          }).catch(() => {});
        }
      } catch {
        // Silenciar - não é crítico se o monitoramento falhar
      }
    };

    // Check imediato + a cada 60s
    checkMismatches();
    const interval = setInterval(checkMismatches, 60_000);
    return () => clearInterval(interval);
  }, []);
}
