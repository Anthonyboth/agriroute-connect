import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, DollarSign, Truck, Users, TrendingUp, Percent, Clock } from 'lucide-react';
import { subDays, endOfDay, startOfDay } from 'date-fns';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useCompanyReportData } from '@/hooks/useCompanyReportData';
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

export const CompanyReportsTab: React.FC = () => {
  const { company, isLoadingCompany } = useTransportCompany();
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const { summary, charts, isLoading, isError, refetch } = useCompanyReportData(
    company?.id,
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
        subtitle: `${summary.freights?.active || 0} ativos`,
        icon: Truck,
      },
      {
        title: 'Motoristas',
        value: summary.drivers?.total || 0,
        format: 'number',
        subtitle: `${summary.drivers?.active || 0} ativos`,
        icon: Users,
      },
      {
        title: 'Veículos',
        value: summary.vehicles?.total || 0,
        format: 'number',
        subtitle: `${summary.vehicles?.active || 0} ativos`,
        icon: Truck,
      },
      {
        title: 'Taxa de Atraso',
        value: summary.delay_rate || 0,
        format: 'percent',
        icon: Clock,
      },
      {
        title: 'Taxa de Cancelamento',
        value: summary.cancellation_rate || 0,
        format: 'percent',
        icon: Percent,
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
        title: 'Desempenho por Motorista',
        type: 'horizontal-bar',
        data: (charts.drivers_performance || []).map(d => ({
          name: d.driver_name || 'Desconhecido',
          value: d.trips || 0,
          revenue: d.revenue || 0,
        })),
        dataKeys: [{ key: 'value', label: 'Viagens' }],
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
        title: 'Desempenho por Motorista',
        type: 'table' as const,
        data: charts.drivers_performance || [],
        columns: [
          { key: 'driver_name', label: 'Motorista' },
          { key: 'trips', label: 'Viagens' },
          { key: 'revenue', label: 'Receita' },
        ],
      },
    ];
  }, [summary, charts, kpiCards]);

  if (isLoadingCompany) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-4 animate-spin" />
        <p className="text-muted-foreground">Carregando dados da empresa...</p>
      </div>
    );
  }

  if (!company?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Empresa não encontrada</p>
      </div>
    );
  }

  // ✅ Se isError mas não temos dados, mostrar estado vazio ao invés de erro
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
            <CardTitle className="text-lg">Relatórios da Transportadora</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <ReportExportButton
                reportTitle="Relatório da Transportadora"
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
          {/* Desempenho por Motorista */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por Motorista</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.drivers_performance?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum motorista encontrado</p>
              ) : (
                <div className="space-y-3">
                  {charts.drivers_performance?.map((driver, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{driver.driver_name}</p>
                        <p className="text-sm text-muted-foreground">{driver.trips} viagens</p>
                      </div>
                      <p className="font-semibold">{formatBRL(driver.revenue || 0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próprios vs Terceiros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Motoristas Próprios vs Terceiros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <p className="font-medium">Motoristas Próprios</p>
                  <p className="font-semibold">{charts.own_vs_third_party?.own || 0} fretes</p>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <p className="font-medium">Motoristas Terceiros</p>
                  <p className="font-semibold">{charts.own_vs_third_party?.third_party || 0} fretes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CompanyReportsTab;
