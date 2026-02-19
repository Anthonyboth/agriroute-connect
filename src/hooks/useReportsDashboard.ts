/**
 * useReportsDashboard.ts
 * 
 * Hook unificado para relatórios de todos os painéis.
 * Chama a RPC `get_reports_dashboard` com o painel e perfil corretos.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, endOfDay } from 'date-fns';
import { useState } from 'react';
import type { DateRange } from '@/types/reports';

// Tipos de retorno da RPC
export interface ReportsDashboardKPIs {
  [key: string]: number | string;
}

export interface ReportsDashboardChartEntry {
  name?: string;
  value?: number;
  dia?: string;
  total?: number;
  valor?: number;
  mes?: string;
  receita?: number;
  origem?: string;
  destino?: string;
  motorista?: string;
  viagens?: number;
  [key: string]: any;
}

export interface ReportsDashboardTableEntry {
  [key: string]: any;
}

export interface ReportsDashboardData {
  kpis: ReportsDashboardKPIs;
  charts: Record<string, ReportsDashboardChartEntry[]>;
  tables: Record<string, ReportsDashboardTableEntry[]>;
}

export type PanelType = 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' | 'PRESTADOR';

interface UseReportsDashboardOptions {
  panel: PanelType;
  profileId: string | undefined;
  dateRange?: DateRange;
  filters?: Record<string, any>;
  /**
   * Quando false, o hook NÃO busca automaticamente.
   * Útil para fluxos com botão "Atualizar" e auto-refresh controlado.
   */
  enabled?: boolean;
}

const DEFAULT_DATA: ReportsDashboardData = {
  kpis: {},
  charts: {},
  tables: {},
};

export function useReportsDashboard({
  panel,
  profileId,
  dateRange,
  filters = {},
  enabled,
}: UseReportsDashboardOptions) {
  const [localDateRange, setLocalDateRange] = useState<DateRange>(
    dateRange || {
      from: startOfDay(subDays(new Date(), 30)),
      to: endOfDay(new Date()),
    }
  );

  const effectiveDateRange = dateRange || localDateRange;

  const query = useQuery({
    queryKey: ['reports-dashboard', panel, profileId, effectiveDateRange.from?.toISOString(), effectiveDateRange.to?.toISOString(), JSON.stringify(filters)],
    queryFn: async () => {
      if (!profileId) return DEFAULT_DATA;

      const { data, error } = await supabase.rpc('get_reports_dashboard', {
        p_panel: panel,
        p_profile_id: profileId,
        p_date_from: effectiveDateRange.from.toISOString(),
        p_date_to: effectiveDateRange.to.toISOString(),
        p_filters: filters,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error('[useReportsDashboard] Erro RPC:', error);
        }
        throw error;
      }

      return (data as unknown as ReportsDashboardData) || DEFAULT_DATA;
    },
    enabled: (enabled ?? !!profileId) && !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data || DEFAULT_DATA,
    kpis: query.data?.kpis || {},
    charts: query.data?.charts || {},
    tables: query.data?.tables || {},
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    dateRange: effectiveDateRange,
    setDateRange: dateRange ? undefined : setLocalDateRange,
  };
}
