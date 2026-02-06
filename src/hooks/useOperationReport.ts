/**
 * useOperationReport.ts
 * 
 * Hook para consultar relatórios de operações via RPC `get_operation_report`.
 * Dados agregados por dia/região/tipo da tabela `reports_daily_metrics`.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OperationReportTotals {
  completed: number;
  cancelled: number;
  revenue: number;
  avg_price: number;
}

export interface OperationReportDayEntry {
  date: string;
  completed: number;
  revenue: number;
}

export interface OperationReportRegionEntry {
  region: string;
  completed: number;
  revenue: number;
}

export interface OperationReportTypeEntry {
  entity_type: string;
  completed: number;
  revenue: number;
}

export interface OperationReport {
  period: { start: string; end: string };
  totals: OperationReportTotals;
  by_day: OperationReportDayEntry[];
  by_region: OperationReportRegionEntry[];
  by_type: OperationReportTypeEntry[];
}

interface UseOperationReportOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  entityType?: 'FREIGHT' | 'SERVICE' | null;
}

export const useOperationReport = (options: UseOperationReportOptions = {}) => {
  const [report, setReport] = useState<OperationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    startDate,
    endDate,
    entityType = null,
  } = options;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, any> = {};
      if (startDate) params.p_start_date = startDate;
      if (endDate) params.p_end_date = endDate;
      if (entityType) params.p_entity_type = entityType;

      const { data, error: rpcError } = await supabase.rpc(
        'get_operation_report',
        params
      );

      if (rpcError) {
        console.error('[useOperationReport] Erro RPC:', rpcError);
        setError(rpcError.message);
        setReport(null);
        return;
      }

      setReport(data as unknown as OperationReport);
    } catch (err: any) {
      console.error('[useOperationReport] Erro inesperado:', err);
      setError(err.message || 'Erro ao carregar relatório');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, entityType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return {
    report,
    loading,
    error,
    refetch: fetchReport,
  };
};
