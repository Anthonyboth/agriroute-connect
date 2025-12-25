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
  avg_service_time_hours: 0,
};

const DEFAULT_CHARTS: ProviderReportCharts = {
  revenue_by_month: [],
  by_status: [],
  by_category: [],
  ratings_trend: [],
  by_day_of_week: [],
  emergency_vs_regular: { emergency: 0, regular: 0 },
};

export function useProviderReportData(
  profileId: string | undefined,
  dateRange: DateRange
): UseProviderReportDataResult {
  
  const summaryQuery = useQuery({
    queryKey: ['provider-report-summary', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) return DEFAULT_SUMMARY;
      
      const { data, error } = await supabase.rpc('get_provider_report_summary', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return (data as unknown as ProviderReportSummary) || DEFAULT_SUMMARY;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const chartsQuery = useQuery({
    queryKey: ['provider-report-charts', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) return DEFAULT_CHARTS;
      
      const { data, error } = await supabase.rpc('get_provider_report_charts', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return (data as unknown as ProviderReportCharts) || DEFAULT_CHARTS;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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
