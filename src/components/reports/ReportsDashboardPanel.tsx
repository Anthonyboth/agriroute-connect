/**
 * ReportsDashboardPanel.tsx
 * 
 * Painel de relatórios unificado que usa a RPC get_reports_dashboard.
 * Compatível com todos os painéis (PRODUTOR, MOTORISTA, TRANSPORTADORA, PRESTADOR).
 */
import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, DollarSign, Truck, Wrench, MapPin, Star, Fuel, Clock, TrendingUp, Users, Percent, Package, CheckCircle } from 'lucide-react';
import { subDays, endOfDay, startOfDay } from 'date-fns';
import {
  ReportPeriodFilter,
  ReportKPICards,
  ReportCharts,
  ReportExportButton,
  formatBRL,
  type KPICardData,
  type ChartConfig,
} from '@/components/reports';
import { useReportsDashboard, type PanelType } from '@/hooks/useReportsDashboard';
import type { DateRange } from '@/types/reports';

interface ReportsDashboardPanelProps {
  panel: PanelType;
  profileId: string | undefined;
  title: string;
}

export const ReportsDashboardPanel: React.FC<ReportsDashboardPanelProps> = ({ panel, profileId, title }) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  });

  const { kpis, charts, tables, isLoading, isError, refetch } = useReportsDashboard({
    panel,
    profileId,
    dateRange,
  });

  // Build KPI cards based on panel
  const kpiCards: KPICardData[] = useMemo(() => {
    if (!kpis || Object.keys(kpis).length === 0) return [];

    switch (panel) {
      case 'PRODUTOR':
        return [
          { title: 'Total Gasto', value: (Number(kpis.freights_total_value) || 0) + (Number(kpis.services_total_value) || 0), format: 'currency', subtitle: 'Fretes + Serviços', icon: DollarSign },
          { title: 'Fretes Concluídos', value: Number(kpis.freights_completed) || 0, format: 'number', subtitle: `${kpis.freights_total || 0} total`, icon: Truck },
          { title: 'Serviços Concluídos', value: Number(kpis.services_completed) || 0, format: 'number', subtitle: `${kpis.services_total || 0} total`, icon: Wrench },
          { title: 'Ticket Médio Frete', value: Number(kpis.ticket_medio_frete) || 0, format: 'currency', icon: TrendingUp },
          { title: 'Ticket Médio Serviço', value: Number(kpis.ticket_medio_servico) || 0, format: 'currency', icon: Package },
          { title: 'Cancelados', value: Number(kpis.freights_cancelled) || 0, format: 'number', icon: Clock },
        ];

      case 'MOTORISTA':
        return [
          { title: 'Receita Total', value: Number(kpis.receita_total) || 0, format: 'currency', subtitle: `${kpis.fretes_concluidos || 0} fretes concluídos`, icon: DollarSign },
          { title: 'Total de Fretes', value: Number(kpis.total_fretes) || 0, format: 'number', icon: Truck },
          { title: 'Distância Percorrida', value: Number(kpis.distancia_total_km) || 0, format: 'distance', icon: MapPin },
          { title: 'Avaliação Média', value: Number(kpis.avaliacao_media) || 0, format: 'number', subtitle: `${kpis.total_avaliacoes || 0} avaliações`, icon: Star },
          { title: 'Despesas', value: Number(kpis.despesas_total) || 0, format: 'currency', icon: Fuel },
          { title: 'Receita Serviços', value: Number(kpis.servicos_receita) || 0, format: 'currency', subtitle: `${kpis.servicos_total || 0} serviços`, icon: Wrench },
        ];

      case 'TRANSPORTADORA':
        return [
          { title: 'Receita Total', value: Number(kpis.receita_total) || 0, format: 'currency', subtitle: `${kpis.fretes_concluidos || 0} fretes`, icon: DollarSign },
          { title: 'Total de Fretes', value: Number(kpis.total_fretes) || 0, format: 'number', icon: Truck },
          { title: 'Motoristas Ativos', value: Number(kpis.total_motoristas) || 0, format: 'number', icon: Users },
          { title: 'Ticket Médio', value: Number(kpis.ticket_medio) || 0, format: 'currency', icon: TrendingUp },
        ];

      case 'PRESTADOR':
        return [
          { title: 'Receita Total', value: Number(kpis.receita_total) || 0, format: 'currency', subtitle: `${kpis.servicos_concluidos || 0} concluídos`, icon: DollarSign },
          { title: 'Total de Serviços', value: Number(kpis.total_servicos) || 0, format: 'number', subtitle: `${kpis.servicos_em_andamento || 0} em andamento`, icon: Wrench },
          { title: 'Avaliação Média', value: Number(kpis.avaliacao_media) || 0, format: 'number', subtitle: `${kpis.total_avaliacoes || 0} avaliações`, icon: Star },
          { title: 'Ticket Médio', value: Number(kpis.ticket_medio) || 0, format: 'currency', icon: TrendingUp },
          { title: 'Concluídos', value: Number(kpis.servicos_concluidos) || 0, format: 'number', icon: CheckCircle },
          { title: 'Cancelados', value: Number(kpis.servicos_cancelados) || 0, format: 'number', icon: Percent },
        ];

      default:
        return [];
    }
  }, [kpis, panel]);

  // Build chart configs based on panel
  const chartConfigs: ChartConfig[] = useMemo(() => {
    if (!charts || Object.keys(charts).length === 0) return [];

    const configs: ChartConfig[] = [];

    // Receita por mês (all panels)
    if (charts.receita_por_mes?.length) {
      configs.push({
        title: 'Receita por Mês',
        type: 'bar',
        data: charts.receita_por_mes.map((m: any) => ({ month: m.mes, revenue: m.receita })),
        dataKeys: [{ key: 'revenue', label: 'Receita' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    }

    // Volume por dia (produtor - fretes + serviços separados)
    if (charts.volume_por_dia?.length && panel === 'PRODUTOR') {
      configs.push({
        title: 'Operações por Dia',
        type: 'bar',
        data: charts.volume_por_dia.map((d: any) => ({ 
          day: d.dia, 
          fretes: d.fretes || 0, 
          servicos: d.servicos || 0,
          total: d.total || 0 
        })),
        dataKeys: [
          { key: 'fretes', label: 'Fretes', color: '#2E7D32' },
          { key: 'servicos', label: 'Serviços', color: '#1976D2' },
        ],
        xAxisKey: 'day',
      });
    }

    // Volume por dia (prestador - concluidos + cancelados)
    if (charts.volume_por_dia?.length && panel === 'PRESTADOR') {
      configs.push({
        title: 'Serviços por Dia',
        type: 'bar',
        data: charts.volume_por_dia.map((d: any) => ({ 
          day: d.dia, 
          concluidos: d.concluidos || 0, 
          cancelados: d.cancelados || 0,
          total: d.total || 0 
        })),
        dataKeys: [
          { key: 'concluidos', label: 'Concluídos', color: '#2E7D32' },
          { key: 'cancelados', label: 'Cancelados', color: '#D32F2F' },
        ],
        xAxisKey: 'day',
      });
    }

    // Valor por dia (produtor - gastos)
    if (charts.valor_por_dia?.length) {
      configs.push({
        title: 'Valor Gasto por Dia',
        type: 'bar',
        data: charts.valor_por_dia.map((d: any) => ({ day: d.dia, valor: d.valor || 0 })),
        dataKeys: [{ key: 'valor', label: 'Valor (R$)', color: '#FF9800' }],
        xAxisKey: 'day',
        valueFormatter: formatBRL,
      });
    }

    // Por status
    if (charts.por_status?.length) {
      configs.push({
        title: 'Por Status',
        type: 'pie',
        data: charts.por_status,
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
      });
    }

    // Por tipo de carga
    if (charts.por_tipo_carga?.length) {
      configs.push({
        title: 'Tipos de Carga',
        type: 'bar',
        data: charts.por_tipo_carga.slice(0, 5),
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        xAxisKey: 'name',
      });
    }

    // Por tipo (produtor)
    if (charts.por_tipo?.length) {
      configs.push({
        title: 'Tipos de Carga',
        type: 'bar',
        data: charts.por_tipo.slice(0, 5),
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        xAxisKey: 'name',
      });
    }

    // Despesas (motorista)
    if (charts.despesas_por_tipo?.length) {
      configs.push({
        title: 'Despesas por Categoria',
        type: 'pie',
        data: charts.despesas_por_tipo,
        dataKeys: [{ key: 'value', label: 'Valor' }],
      });
    }

    // Por tipo de serviço (prestador)
    if (charts.por_tipo_servico?.length) {
      configs.push({
        title: 'Tipos de Serviço',
        type: 'bar',
        data: charts.por_tipo_servico.slice(0, 5),
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        xAxisKey: 'name',
      });
    }

    // Por cidade (prestador)
    if (charts.por_cidade?.length) {
      configs.push({
        title: 'Principais Cidades',
        type: 'bar',
        data: charts.por_cidade.slice(0, 5),
        dataKeys: [{ key: 'value', label: 'Serviços' }],
        xAxisKey: 'name',
      });
    }

    return configs;
  }, [charts]);

  // Export sections
  const exportSections = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        title: 'Resumo Geral',
        type: 'kpi' as const,
        data: kpiCards.map(k => ({ label: k.title, value: k.value })),
      },
    ];
  }, [kpis, kpiCards]);

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
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground font-medium">Nenhum dado encontrado</p>
        <p className="text-sm text-muted-foreground mt-2">Tente ajustar o período ou verifique se há operações registradas.</p>
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
            <CardTitle className="text-lg">{title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
              <ReportExportButton
                reportTitle={title}
                dateRange={dateRange}
                sections={exportSections}
                disabled={isLoading}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <ReportKPICards cards={kpiCards} isLoading={isLoading} columns={kpiCards.length > 4 ? 6 : 4} />

      {/* Charts */}
      <ReportCharts charts={chartConfigs} isLoading={isLoading} columns={2} />

      {/* Top Rotas (motorista/transportadora) */}
      {!isLoading && charts.top_rotas?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Principais Rotas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {charts.top_rotas.map((route: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{route.origem} → {route.destino}</p>
                    <p className="text-sm text-muted-foreground">{route.total} viagens</p>
                  </div>
                  <p className="font-semibold">{formatBRL(route.receita || 0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Por Motorista (transportadora) */}
      {!isLoading && charts.por_motorista?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desempenho por Motorista</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {charts.por_motorista.map((d: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{d.motorista}</p>
                    <p className="text-sm text-muted-foreground">{d.viagens} viagens</p>
                  </div>
                  <p className="font-semibold">{formatBRL(d.receita || 0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos Serviços (prestador) */}
      {!isLoading && panel === 'PRESTADOR' && tables.ultimas_operacoes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Serviços Prestados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tables.ultimas_operacoes.map((op: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{op.service_type}</p>
                    <p className="text-xs text-muted-foreground">{op.city} • {op.cliente || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">{op.data ? new Date(op.data).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                  <div className="text-right ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      op.status_final === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      op.status_final === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {op.status_final === 'COMPLETED' ? 'Concluído' : op.status_final === 'CANCELLED' ? 'Cancelado' : op.status_final}
                    </span>
                    {op.final_price > 0 && (
                      <p className="text-sm font-semibold mt-1">{formatBRL(op.final_price)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sem dados */}
      {!isLoading && kpiCards.every(k => (typeof k.value === 'number' ? k.value === 0 : !k.value)) && (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Sem dados de relatório</h3>
            <p className="text-muted-foreground">
              Operações concluídas serão refletidas aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
