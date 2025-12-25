import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  CompanyReportSummary, 
  CompanyReportCharts,
  DateRange 
} from '@/types/reports';

interface UseCompanyReportDataResult {
  summary: CompanyReportSummary | null;
  charts: CompanyReportCharts | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEFAULT_SUMMARY: CompanyReportSummary = {
  freights: {
    total: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    total_revenue: 0,
    avg_revenue: 0,
  },
  drivers: {
    total: 0,
    active: 0,
    own: 0,
    third_party: 0,
  },
  vehicles: {
    total: 0,
    active: 0,
  },
  delay_rate: 0,
  cancellation_rate: 0,
};

const DEFAULT_CHARTS: CompanyReportCharts = {
  revenue_by_month: [],
  by_status: [],
  by_cargo_type: [],
  drivers_performance: [],
  own_vs_third_party: { own: 0, third_party: 0 },
};

export function useCompanyReportData(
  companyId: string | undefined,
  dateRange: DateRange
): UseCompanyReportDataResult {
  
  const summaryQuery = useQuery({
    queryKey: ['company-report-summary', companyId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!companyId) return DEFAULT_SUMMARY;
      
      const { data, error } = await supabase.rpc('get_company_report_summary', {
        p_company_id: companyId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return (data as unknown as CompanyReportSummary) || DEFAULT_SUMMARY;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const chartsQuery = useQuery({
    queryKey: ['company-report-charts', companyId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!companyId) return DEFAULT_CHARTS;
      
      const { data, error } = await supabase.rpc('get_company_report_charts', {
        p_company_id: companyId,
        p_start_at: dateRange.from.toISOString(),
        p_end_at: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return (data as unknown as CompanyReportCharts) || DEFAULT_CHARTS;
    },
    enabled: !!companyId,
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
