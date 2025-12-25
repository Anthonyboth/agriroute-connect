import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, DollarSign, Truck, Wrench, Clock, TrendingUp, Package } from 'lucide-react';
import { subDays, endOfDay, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useProducerReportData } from '@/hooks/useProducerReportData';
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

export const ProducerReportsTab: React.FC = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const { summary, charts, isLoading, isError, refetch } = useProducerReportData(
    user?.id,
    dateRange
  );

  // KPIs
  const kpiCards: KPICardData[] = useMemo(() => {
    if (!summary) return [];
    
    const totalSpent = (summary.freights?.total_spent || 0) + (summary.services?.total_spent || 0);
    
    return [
      {
        title: 'Total Gasto',
        value: totalSpent,
        format: 'currency',
        subtitle: 'Fretes + Serviços',
        icon: DollarSign,
      },
      {
        title: 'Total de Fretes',
        value: summary.freights?.total || 0,
        format: 'number',
        subtitle: `${summary.freights?.completed || 0} concluídos`,
        icon: Truck,
      },
      {
        title: 'Total de Serviços',
        value: summary.services?.total || 0,
        format: 'number',
        subtitle: `${summary.services?.completed || 0} concluídos`,
        icon: Wrench,
      },
      {
        title: 'Ticket Médio Frete',
        value: summary.freights?.avg_price || 0,
        format: 'currency',
        icon: TrendingUp,
      },
      {
        title: 'Ticket Médio Serviço',
        value: summary.services?.avg_price || 0,
        format: 'currency',
        icon: Package,
      },
      {
        title: 'Tempo Médio Conclusão',
        value: `${(summary.avg_completion_time_hours || 0).toFixed(1)}h`,
        icon: Clock,
      },
    ];
  }, [summary]);

  // Charts
  const chartConfigs: ChartConfig[] = useMemo(() => {
    if (!charts) return [];
    
    return [
      {
        title: 'Gastos por Mês',
        type: 'bar',
        data: charts.spending_by_month || [],
        dataKeys: [
          { key: 'freight_spending', label: 'Fretes' },
          { key: 'service_spending', label: 'Serviços' },
        ],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      },
      {
        title: 'Fretes por Status',
        type: 'pie',
        data: charts.by_status || [],
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
      },
      {
        title: 'Tipos de Carga',
        type: 'bar',
        data: (charts.by_cargo_type || []).slice(0, 5),
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        xAxisKey: 'name',
      },
      {
        title: 'Top Motoristas',
        type: 'horizontal-bar',
        data: (charts.top_drivers || []).map(d => ({
          name: d.driver_name,
          trips: d.trips,
          rating: d.avg_rating,
        })),
        dataKeys: [{ key: 'trips', label: 'Viagens' }],
        xAxisKey: 'name',
      },
    ];
  }, [charts]);

  // Export sections
  const exportSections = useMemo(() => {
    if (!summary || !charts) return [];
    
    return [
      {
        title: 'Resumo Geral',
        type: 'kpi' as const,
        data: kpiCards.map(k => ({ label: k.title, value: k.value })),
      },
      {
        title: 'Top Motoristas',
        type: 'table' as const,
        data: charts.top_drivers || [],
        columns: [
          { key: 'driver_name', label: 'Motorista' },
          { key: 'trips', label: 'Viagens' },
          { key: 'avg_rating', label: 'Avaliação' },
        ],
      },
      {
        title: 'Principais Rotas',
        type: 'table' as const,
        data: charts.top_routes || [],
        columns: [
          { key: 'origin', label: 'Origem' },
          { key: 'destination', label: 'Destino' },
          { key: 'count', label: 'Viagens' },
        ],
      },
    ];
  }, [summary, charts, kpiCards]);

  if (!user?.id) {
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
            <CardTitle className="text-lg">Relatórios do Produtor</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <ReportExportButton
                reportTitle="Relatório do Produtor"
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
          {/* Top Prestadores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Prestadores de Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.top_providers?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum prestador encontrado</p>
              ) : (
                <div className="space-y-3">
                  {charts.top_providers?.map((provider, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{provider.provider_name}</p>
                        <p className="text-sm text-muted-foreground">{provider.services} serviços</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatBRL(provider.total_spent)}</p>
                        <p className="text-sm text-muted-foreground">⭐ {provider.avg_rating.toFixed(1)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Principais Rotas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Principais Rotas</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.top_routes?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma rota encontrada</p>
              ) : (
                <div className="space-y-3">
                  {charts.top_routes?.map((route, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{route.origin} → {route.destination}</p>
                        <p className="text-sm text-muted-foreground">{route.count} viagens</p>
                      </div>
                      <p className="font-semibold">{formatBRL(route.total_value || 0)}</p>
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
