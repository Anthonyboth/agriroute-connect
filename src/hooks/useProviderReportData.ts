import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ProviderReportSummary, 
  ProviderReportCharts,
  DateRange 
} from '@/types/reports';

interface UseProviderReportDataResult {
  summary: ProviderReportSummary | null;
  charts: ProviderReportCharts | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEFAULT_SUMMARY: ProviderReportSummary = {
  services: {
    total: 0,
    pending: 0,
    accepted: 0,
    completed: 0,
    cancelled: 0,
    in_progress: 0,
    total_revenue: 0,
    avg_revenue: 0,
    avg_price: 0,
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
  conversion_rate: 0,
  cancellation_rate: 0,
  avg_service_time_hours: 0,
};

const DEFAULT_CHARTS: ProviderReportCharts = {
  revenue_by_month: [],
  by_status: [],
  by_category: [],
  by_service_type: [],
  ratings_trend: [],
  ratings_distribution: [],
  by_day_of_week: [],
  top_cities: [],
  emergency_vs_regular: { emergency: 0, regular: 0 },
};

export function useProviderReportData(
  profileId: string | undefined,
  dateRange: DateRange
): UseProviderReportDataResult {
  
  // DEV LOGS - Diagnóstico (Fase 7 - Item 13)
  if (import.meta.env.DEV) {
    console.log('[useProviderReportData] 📊 Parâmetros:', {
      profileId,
      dateRangeFrom: dateRange.from?.toISOString(),
      dateRangeTo: dateRange.to?.toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  const summaryQuery = useQuery({
    queryKey: ['provider-report-summary', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) {
        if (import.meta.env.DEV) {
          console.warn('[useProviderReportData] ⚠️ profileId não fornecido');
        }
        return DEFAULT_SUMMARY;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useProviderReportData] 🔄 Chamando RPC get_provider_report_summary...', { profileId });
      }
      
      const { data, error } = await supabase.rpc('get_provider_report_summary', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useProviderReportData] ❌ Erro RPC summary:', error);
        }
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useProviderReportData] ✅ Summary recebido:', data);
      }
      
      return (data as unknown as ProviderReportSummary) || DEFAULT_SUMMARY;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const chartsQuery = useQuery({
    queryKey: ['provider-report-charts', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) {
        if (import.meta.env.DEV) {
          console.warn('[useProviderReportData] ⚠️ profileId não fornecido para charts');
        }
        return DEFAULT_CHARTS;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useProviderReportData] 🔄 Chamando RPC get_provider_report_charts...', { profileId });
      }
      
      const { data, error } = await supabase.rpc('get_provider_report_charts', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useProviderReportData] ❌ Erro RPC charts:', error);
        }
        throw error;
      }
      
      if (import.meta.env.DEV) {
        console.log('[useProviderReportData] ✅ Charts recebido:', data);
      }
      
      return (data as unknown as ProviderReportCharts) || DEFAULT_CHARTS;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // DEV LOG - Estado final
  if (import.meta.env.DEV && (summaryQuery.isError || chartsQuery.isError)) {
    console.error('[useProviderReportData] ❌ Erro geral:', {
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
