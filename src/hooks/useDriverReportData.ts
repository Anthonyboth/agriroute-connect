import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  DriverReportSummary, 
  DriverReportCharts,
  DateRange 
} from '@/types/reports';

interface UseDriverReportDataResult {
  summary: DriverReportSummary | null;
  charts: DriverReportCharts | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEFAULT_SUMMARY: DriverReportSummary = {
  freights: {
    total: 0,
    accepted: 0,
    completed: 0,
    in_transit: 0,
    cancelled: 0,
    total_revenue: 0,
    avg_revenue: 0,
  },
  distance: {
    total_km: 0,
    avg_per_freight: 0,
  },
  ratings: {
    average: 0,
    total: 0,
    five_star: 0,
    four_star: 0,
    three_star: 0,
    two_star: 0,
    one_star: 0,
  },
  expenses: {
    total: 0,
    fuel: 0,
    maintenance: 0,
    toll: 0,
    tire: 0,
    other: 0,
  },
};

const DEFAULT_CHARTS: DriverReportCharts = {
  revenue_by_month: [],
  by_status: [],
  by_cargo_type: [],
  expenses_by_type: [],
  ratings_trend: [],
  top_routes: [],
  top_states: [],
};

export function useDriverReportData(
  profileId: string | undefined,
  dateRange: DateRange
): UseDriverReportDataResult {
  
  // DEV LOGS - Diagnóstico (Fase 7 - Item 13)
  if (import.meta.env.DEV) {
    console.log('[useDriverReportData] 📊 Parâmetros:', {
      profileId,
      dateRangeFrom: dateRange.from?.toISOString(),
      dateRangeTo: dateRange.to?.toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  const summaryQuery = useQuery({
    queryKey: ['driver-report-summary', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) {
        if (import.meta.env.DEV) {
          console.warn('[useDriverReportData] ⚠️ profileId não fornecido');
        }
        return DEFAULT_SUMMARY;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useDriverReportData] 🔄 Chamando RPC get_driver_report_summary...', { profileId });
      }
      
      const { data, error } = await supabase.rpc('get_driver_report_summary', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useDriverReportData] ❌ Erro RPC summary:', error);
        }
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useDriverReportData] ✅ Summary recebido:', data);
      }
      
      return (data as unknown as DriverReportSummary) || DEFAULT_SUMMARY;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const chartsQuery = useQuery({
    queryKey: ['driver-report-charts', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) {
        if (import.meta.env.DEV) {
          console.warn('[useDriverReportData] ⚠️ profileId não fornecido para charts');
        }
        return DEFAULT_CHARTS;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useDriverReportData] 🔄 Chamando RPC get_driver_report_charts...', { profileId });
      }
      
      const { data, error } = await supabase.rpc('get_driver_report_charts', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useDriverReportData] ❌ Erro RPC charts:', error);
        }
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useDriverReportData] ✅ Charts recebido:', data);
      }
      
      return (data as unknown as DriverReportCharts) || DEFAULT_CHARTS;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // DEV LOG - Estado final
  if (import.meta.env.DEV && (summaryQuery.isError || chartsQuery.isError)) {
    console.error('[useDriverReportData] ❌ Erro geral:', {
      summaryError: summaryQuery.error,
      chartsError: chartsQuery.error
    });
  }

  return {
    summary: summaryQuery.data || null,
    charts: chartsQuery.data || null,
    isLoading: summaryQuery.isLoading || chartsQuery.isLoading,
    isError: summaryQuery.isError || chartsQuery.isError,
    error: summaryQuery.error || chartsQuery.error,
    refetch: () => {
      summaryQuery.refetch();
      chartsQuery.refetch();
    },
  };
}
