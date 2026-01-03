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

// Fallback: calcular dados diretamente das tabelas
async function fetchReportDataFallback(
  companyId: string,
  dateRange: DateRange
): Promise<{ summary: CompanyReportSummary; charts: CompanyReportCharts }> {
  const startDate = dateRange.from.toISOString();
  const endDate = dateRange.to.toISOString();

  // Buscar fretes da empresa
  const { data: freights, error: freightsError } = await supabase
    .from('freights')
    .select('id, status, price, cargo_type, created_at')
    .eq('company_id', companyId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (freightsError) {
    console.warn('Fallback freights error:', freightsError);
  }

  // Buscar motoristas da empresa
  const { data: drivers, error: driversError } = await supabase
    .from('company_drivers')
    .select('id, status, affiliation_type, driver_profile_id')
    .eq('company_id', companyId);

  if (driversError) {
    console.warn('Fallback drivers error:', driversError);
  }

  // Buscar veículos via assignments
  const { data: vehicleAssignments, error: vehiclesError } = await supabase
    .from('company_vehicle_assignments')
    .select('id, vehicle_id, removed_at')
    .eq('company_id', companyId)
    .is('removed_at', null);

  if (vehiclesError) {
    console.warn('Fallback vehicles error:', vehiclesError);
  }

  const freightList = freights || [];
  const driverList = drivers || [];
  const vehicleList = vehicleAssignments || [];

  // Calcular sumário
  const activeStatuses = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'];
  const completedStatuses = ['DELIVERED', 'COMPLETED'];
  const cancelledStatuses = ['CANCELLED'];

  const activeCount = freightList.filter(f => activeStatuses.includes(f.status)).length;
  const completedCount = freightList.filter(f => completedStatuses.includes(f.status)).length;
  const cancelledCount = freightList.filter(f => cancelledStatuses.includes(f.status)).length;
  const totalRevenue = freightList
    .filter(f => completedStatuses.includes(f.status))
    .reduce((sum, f) => sum + (f.price || 0), 0);

  const activeDrivers = driverList.filter(d => d.status === 'ACTIVE').length;
  const ownDrivers = driverList.filter(d => d.affiliation_type === 'PROPRIO' || d.affiliation_type === 'OWN').length;
  const thirdPartyDrivers = driverList.filter(d => d.affiliation_type === 'TERCEIRO' || d.affiliation_type === 'THIRD_PARTY').length;

  // Calcular gráficos
  const byStatus = [
    { name: 'Abertos', value: freightList.filter(f => f.status === 'OPEN').length },
    { name: 'Ativos', value: activeCount },
    { name: 'Concluídos', value: completedCount },
    { name: 'Cancelados', value: cancelledCount },
  ].filter(s => s.value > 0);

  // Agrupar por tipo de carga
  const cargoTypeMap: Record<string, number> = {};
  freightList.forEach(f => {
    const type = f.cargo_type || 'Outros';
    cargoTypeMap[type] = (cargoTypeMap[type] || 0) + 1;
  });
  const byCargoType = Object.entries(cargoTypeMap).map(([name, value]) => ({ name, value }));

  const summary: CompanyReportSummary = {
    freights: {
      total: freightList.length,
      active: activeCount,
      completed: completedCount,
      cancelled: cancelledCount,
      total_revenue: totalRevenue,
      avg_revenue: completedCount > 0 ? totalRevenue / completedCount : 0,
    },
    drivers: {
      total: driverList.length,
      active: activeDrivers,
      own: ownDrivers,
      third_party: thirdPartyDrivers,
    },
    vehicles: {
      total: vehicleList.length,
      active: vehicleList.length,
    },
    delay_rate: 0,
    cancellation_rate: freightList.length > 0 ? (cancelledCount / freightList.length) * 100 : 0,
  };

  const charts: CompanyReportCharts = {
    revenue_by_month: [],
    by_status: byStatus,
    by_cargo_type: byCargoType,
    drivers_performance: [],
    own_vs_third_party: { own: ownDrivers, third_party: thirdPartyDrivers },
  };

  return { summary, charts };
}

export function useCompanyReportData(
  companyId: string | undefined,
  dateRange: DateRange
): UseCompanyReportDataResult {
  
  const combinedQuery = useQuery({
    queryKey: ['company-report-combined', companyId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!companyId) return { summary: DEFAULT_SUMMARY, charts: DEFAULT_CHARTS };
      
      // Tentar usar RPC primeiro
      try {
        const [summaryResult, chartsResult] = await Promise.all([
          supabase.rpc('get_company_report_summary', {
            p_company_id: companyId,
            p_start_at: dateRange.from.toISOString(),
            p_end_at: dateRange.to.toISOString(),
          }),
          supabase.rpc('get_company_report_charts', {
            p_company_id: companyId,
            p_start_at: dateRange.from.toISOString(),
            p_end_at: dateRange.to.toISOString(),
          }),
        ]);

        // Se ambos funcionarem, usar os dados
        if (!summaryResult.error && !chartsResult.error && summaryResult.data && chartsResult.data) {
          return {
            summary: (summaryResult.data as unknown as CompanyReportSummary) || DEFAULT_SUMMARY,
            charts: (chartsResult.data as unknown as CompanyReportCharts) || DEFAULT_CHARTS,
          };
        }
        
        // Se houver erro, usar fallback
        console.warn('RPC failed, using fallback:', summaryResult.error || chartsResult.error);
        return await fetchReportDataFallback(companyId, dateRange);
      } catch (error) {
        console.warn('RPC exception, using fallback:', error);
        return await fetchReportDataFallback(companyId, dateRange);
      }
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    summary: combinedQuery.data?.summary || null,
    charts: combinedQuery.data?.charts || null,
    isLoading: combinedQuery.isLoading,
    isError: combinedQuery.isError,
    error: combinedQuery.error,
    refetch: () => combinedQuery.refetch(),
  };
}
