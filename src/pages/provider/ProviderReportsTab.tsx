import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, DollarSign, Wrench, Star, TrendingUp, Percent, Clock } from 'lucide-react';
import { subDays, endOfDay, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useProviderReportData } from '@/hooks/useProviderReportData';
import { 
  ReportPeriodFilter, 
  ReportKPICards, 
  ReportCharts, 
  ReportExportButton,
  formatBRL,
  type KPICardData,
  type ChartConfig 
} from '@/components/reports';
import type { DateRange } from '@/types/reports';

interface ProviderReportsTabProps {
  providerId?: string;
}

export const ProviderReportsTab: React.FC<ProviderReportsTabProps> = ({ providerId }) => {
  const { profile } = useAuth();

  // RPC espera profiles.id do prestador logado (ou providerId quando o componente é usado em contexto admin)
  const profileId = providerId ?? (profile?.role === 'PRESTADOR_SERVICOS' ? profile.id : undefined);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const { summary, charts, isLoading, isError, refetch } = useProviderReportData(
    profileId,
    dateRange
  );

  // KPIs
  const kpiCards: KPICardData[] = useMemo(() => {
    if (!summary) return [];

    const avgServicePrice =
      (summary.services as any)?.avg_price ?? (summary.services as any)?.avg_revenue ?? 0;

    return [
      {
        title: 'Receita Total',
        value: summary.services?.total_revenue || 0,
        format: 'currency',
        subtitle: `${summary.services?.completed || 0} serviços concluídos`,
        icon: DollarSign,
      },
      {
        title: 'Total de Serviços',
        value: summary.services?.total || 0,
        format: 'number',
        subtitle: `${summary.services?.pending || 0} pendentes`,
        icon: Wrench,
      },
      {
        title: 'Avaliação Média',
        value: summary.ratings?.average || 0,
        format: 'number',
        subtitle: `${summary.ratings?.total || 0} avaliações`,
        icon: Star,
      },
      {
        title: 'Taxa de Conversão',
        value: summary.conversion_rate || 0,
        format: 'percent',
        icon: TrendingUp,
      },
      {
        title: 'Taxa de Cancelamento',
        value: (summary as any).cancellation_rate || 0,
        format: 'percent',
        icon: Percent,
      },
      {
        title: 'Receita Média',
        value: avgServicePrice,
        format: 'currency',
        subtitle: 'por serviço',
        icon: Clock,
      },
    ];
  }, [summary]);

  // Charts
  const chartConfigs: ChartConfig[] = useMemo(() => {
    if (!charts) return [];

    // Alguns RPCs retornam `by_category` (legado) ao invés de `by_service_type`
    const serviceTypeData =
      (charts.by_service_type && charts.by_service_type.length > 0
        ? charts.by_service_type
        : (charts as any).by_category) || [];

    return [
      {
        title: 'Receita por Mês',
        type: 'bar',
        data: charts.revenue_by_month || [],
        dataKeys: [{ key: 'revenue', label: 'Receita' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      },
      {
        title: 'Serviços por Status',
        type: 'pie',
        data: charts.by_status || [],
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
      },
      {
        title: 'Tipos de Serviço',
        type: 'bar',
        data: (serviceTypeData || []).slice(0, 5),
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        xAxisKey: 'name',
      },
      {
        title: 'Avaliações por Nota',
        type: 'bar',
        data: charts.ratings_distribution || [],
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        xAxisKey: 'name',
      },
    ];
  }, [charts]);

  // Export sections
  const exportSections = useMemo(() => {
    if (!summary || !charts) return [];

    const serviceTypeData =
      (charts.by_service_type && charts.by_service_type.length > 0
        ? charts.by_service_type
        : (charts as any).by_category) || [];

    return [
      {
        title: 'Resumo Geral',
        type: 'kpi' as const,
        data: kpiCards.map(k => ({ label: k.title, value: k.value })),
      },
      {
        title: 'Tipos de Serviço',
        type: 'table' as const,
        data: serviceTypeData,
        columns: [
          { key: 'name', label: 'Tipo' },
          { key: 'value', label: 'Quantidade' },
        ],
      },
      {
        title: 'Principais Cidades',
        type: 'table' as const,
        data: charts.top_cities || [],
        columns: [
          { key: 'name', label: 'Cidade' },
          { key: 'value', label: 'Serviços' },
        ],
      },
    ];
  }, [summary, charts, kpiCards]);

  if (!profileId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Usuário não autenticado</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
        <p className="text-muted-foreground font-medium">Erro ao carregar relatórios</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">Relatórios do Prestador</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <ReportExportButton
                reportTitle="Relatório do Prestador"
                dateRange={dateRange}
                sections={exportSections}
                disabled={isLoading}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <ReportKPICards cards={kpiCards} isLoading={isLoading} columns={6} />

      {/* Charts */}
      <ReportCharts charts={chartConfigs} isLoading={isLoading} columns={2} />

      {/* Rankings */}
      {!isLoading && charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Principais Cidades */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Principais Cidades</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.top_cities?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cidade encontrada</p>
              ) : (
                <div className="space-y-3">
                  {charts.top_cities?.map((city, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <p className="font-medium">{city.name}</p>
                      <p className="font-semibold">{city.value} serviços</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tipos de Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipos de Serviço Mais Frequentes</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.by_service_type?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço encontrado</p>
              ) : (
                <div className="space-y-3">
                  {charts.by_service_type?.slice(0, 5).map((service, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <p className="font-medium">{service.name}</p>
                      <p className="font-semibold">{service.value} serviços</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProviderReportsTab;
