import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, DollarSign, Truck, MapPin, Star, Fuel, Clock } from 'lucide-react';
import { subDays, endOfDay, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDriverReportData } from '@/hooks/useDriverReportData';
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

interface DriverReportsTabProps {
  driverId?: string;
}

export const DriverReportsTab: React.FC<DriverReportsTabProps> = ({ driverId }) => {
  const { profile } = useAuth();
  // Use driverId prop se passado, senão usa profile.id (nunca user.id pois RPC espera profiles.id)
  const profileId = driverId || profile?.id;
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const { summary, charts, isLoading, isError, refetch } = useDriverReportData(
    profileId,
    dateRange
  );

  // KPIs
  const kpiCards: KPICardData[] = useMemo(() => {
    if (!summary) return [];
    
    return [
      {
        title: 'Receita Total',
        value: summary.freights?.total_revenue || 0,
        format: 'currency',
        subtitle: `${summary.freights?.completed || 0} fretes concluídos`,
        icon: DollarSign,
      },
      {
        title: 'Total de Fretes',
        value: summary.freights?.total || 0,
        format: 'number',
        subtitle: `${summary.freights?.in_transit || 0} em trânsito`,
        icon: Truck,
      },
      {
        title: 'Distância Percorrida',
        value: summary.distance?.total_km || 0,
        format: 'distance',
        subtitle: `Média ${(summary.distance?.avg_per_freight || 0).toFixed(0)} km/frete`,
        icon: MapPin,
      },
      {
        title: 'Avaliação Média',
        value: summary.ratings?.average || 0,
        format: 'number',
        subtitle: `${summary.ratings?.total || 0} avaliações`,
        icon: Star,
      },
      {
        title: 'Total de Despesas',
        value: summary.expenses?.total || 0,
        format: 'currency',
        subtitle: `Combustível: ${formatBRL(summary.expenses?.fuel || 0)}`,
        icon: Fuel,
      },
      {
        title: 'Receita Média',
        value: summary.freights?.avg_revenue || 0,
        format: 'currency',
        subtitle: 'por frete',
        icon: Clock,
      },
    ];
  }, [summary]);

  // Charts
  const chartConfigs: ChartConfig[] = useMemo(() => {
    if (!charts) return [];
    
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
        title: 'Despesas por Categoria',
        type: 'pie',
        data: charts.expenses_by_type || [],
        dataKeys: [{ key: 'value', label: 'Valor' }],
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
        title: 'Principais Rotas',
        type: 'table' as const,
        data: charts.top_routes || [],
        columns: [
          { key: 'origin', label: 'Origem' },
          { key: 'destination', label: 'Destino' },
          { key: 'count', label: 'Viagens' },
        ],
      },
      {
        title: 'Estados Mais Frequentes',
        type: 'table' as const,
        data: charts.top_states || [],
        columns: [
          { key: 'name', label: 'Estado' },
          { key: 'value', label: 'Viagens' },
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

  // ✅ Se isError mas não temos dados, mostrar estado vazio ao invés de erro
  // Isso evita "Erro ao carregar relatórios" quando RPC simplesmente não retornou nada
  const hasData = summary && (summary.freights?.total || 0) > 0;

  if (isError && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">Nenhum dado encontrado</p>
        <p className="text-sm text-muted-foreground mt-2">Tente ajustar o período ou verifique se há fretes registrados.</p>
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
            <CardTitle className="text-lg">Relatórios do Motorista</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <ReportExportButton
                reportTitle="Relatório do Motorista"
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
                      <p className="font-semibold">{formatBRL(route.total_revenue || 0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estados Mais Frequentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estados Mais Frequentes</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.top_states?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum estado encontrado</p>
              ) : (
                <div className="space-y-3">
                  {charts.top_states?.map((state, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <p className="font-medium">{state.name}</p>
                      <p className="font-semibold">{state.value} viagens</p>
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

export default DriverReportsTab;
