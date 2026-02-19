/**
 * useReportsDashboardUnified.ts
 *
 * Hook unificado para relatórios MOTORISTA e TRANSPORTADORA.
 * Integra: useReportsDashboard + useControlledRefresh + filtros.
 * Auto-refresh 10 min + botão manual "Atualizar".
 */
import { useState, useCallback, useMemo } from 'react';
import { startOfDay, subDays, endOfDay } from 'date-fns';
import { useReportsDashboard, type PanelType } from './useReportsDashboard';
import { useControlledRefresh } from './useControlledRefresh';
import type { DateRange } from '@/types/reports';
import type { ReportFilters } from '@/components/reports/ReportFiltersBar';

interface UseReportsDashboardUnifiedOptions {
  panel: PanelType;
  profileId: string | undefined;
}

export function useReportsDashboardUnified({ panel, profileId }: UseReportsDashboardUnifiedOptions) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const [filters, setFilters] = useState<ReportFilters>({});

  // Mapeia filtros do componente para o formato da RPC
  const rpcFilters = useMemo(() => {
    const f: Record<string, any> = {};
    if (filters.tipo?.length) f.tipo = filters.tipo;
    if (filters.status_final?.length) f.status_final = filters.status_final;
    if (filters.uf) f.uf = filters.uf;
    if (filters.motoristas?.length) f.motoristas = filters.motoristas;
    return f;
  }, [filters]);

  const {
    data,
    kpis,
    charts,
    tables,
    isLoading,
    isError,
    error,
    refetch,
  } = useReportsDashboard({
    panel,
    profileId,
    dateRange,
    filters: rpcFilters,
    enabled: false, // controlado pelo useControlledRefresh
  });

  const {
    refreshNow,
    isRefreshing,
    lastRefreshLabel,
  } = useControlledRefresh({
    refreshKey: `reports-${panel}`,
    refetchFn: async () => { await refetch(); },
    enabled: !!profileId,
  });

  const handleFiltersChange = useCallback((newFilters: ReportFilters) => {
    setFilters(newFilters);
  }, []);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  return {
    // Data
    data,
    kpis,
    charts,
    tables,

    // State
    isLoading: isLoading || isRefreshing,
    isError,
    error,

    // Filters
    filters,
    setFilters: handleFiltersChange,
    dateRange,
    setDateRange: handleDateRangeChange,

    // Refresh
    refreshNow,
    isRefreshing,
    lastRefreshLabel,
    refetch,
  };
}
