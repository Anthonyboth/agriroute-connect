import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ProducerReportSummary, 
  ProducerReportCharts,
  DateRange 
} from '@/types/reports';

interface UseProducerReportDataResult {
  summary: ProducerReportSummary | null;
  charts: ProducerReportCharts | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEFAULT_SUMMARY: ProducerReportSummary = {
  freights: {
    total: 0,
    pending: 0,
    in_transit: 0,
    completed: 0,
    cancelled: 0,
    total_spent: 0,
    avg_price: 0,
    avg_distance_km: 0,
    total_distance_km: 0,
  },
  services: {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    total_spent: 0,
    avg_price: 0,
  },
  avg_completion_time_hours: 0,
};

const DEFAULT_CHARTS: ProducerReportCharts = {
  spending_by_month: [],
  by_status: [],
  by_cargo_type: [],
  top_drivers: [],
  top_providers: [],
  top_routes: [],
};

export function useProducerReportData(
  profileId: string | undefined,
  dateRange: DateRange
): UseProducerReportDataResult {
  
  const summaryQuery = useQuery({
    queryKey: ['producer-report-summary', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) return DEFAULT_SUMMARY;
      
      const { data, error } = await supabase.rpc('get_producer_report_summary', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return (data as unknown as ProducerReportSummary) || DEFAULT_SUMMARY;
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const chartsQuery = useQuery({
    queryKey: ['producer-report-charts', profileId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!profileId) return DEFAULT_CHARTS;
      
      const { data, error } = await supabase.rpc('get_producer_report_charts', {
        p_profile_id: profileId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return (data as unknown as ProducerReportCharts) || DEFAULT_CHARTS;
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
