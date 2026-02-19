/**
 * ReportsDashboardPanel.tsx
 * 
 * Painel de relatórios unificado que usa a RPC get_reports_dashboard.
 * Compatível com todos os painéis (PRODUTOR, MOTORISTA, TRANSPORTADORA, PRESTADOR).
 * Integra: filtros, refresh controlado (10min + botão), e seções organizadas.
 */
import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, RefreshCw, DollarSign, Truck, Wrench, MapPin, Star, Fuel, Clock, TrendingUp, Users, Percent, Package, CheckCircle, BarChart3, PieChart as PieChartIcon, Activity, Route, Weight, Timer, XCircle, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ReportPeriodFilter,
  ReportKPICards,
  ReportCharts,
  ReportExportButton,
  ReportFiltersBar,
  formatBRL,
  type KPICardData,
  type ChartConfig,
} from '@/components/reports';
import { useReportsDashboardUnified } from '@/hooks/useReportsDashboardUnified';
import type { PanelType } from '@/hooks/useReportsDashboard';

interface ReportsDashboardPanelProps {
  panel: PanelType;
  profileId: string | undefined;
  title: string;
}

// Helper to format number
const formatNum = (v: number, decimals = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Helper to format hours
const formatHours = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${formatNum(hours, 1)}h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  return `${days}d ${Math.round(remaining)}h`;
};

export const ReportsDashboardPanel: React.FC<ReportsDashboardPanelProps> = ({ panel, profileId, title }) => {
  const {
    kpis,
    charts,
    tables,
    isLoading,
    isError,
    error: dashboardError,
    filters,
    setFilters,
    dateRange,
    setDateRange,
    refreshNow,
    isRefreshing,
    lastRefreshLabel,
    refetch,
  } = useReportsDashboardUnified({ panel, profileId });

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

      case 'MOTORISTA': {
        // Campos retornados pela RPC get_reports_dashboard (MOTORISTA)
        const receitaTotal = Number(kpis.receita_total) || 0;
        const receitaFretes = Number(kpis.receita_fretes) || 0;
        const receitaServicos = Number(kpis.receita_servicos) || 0;
        const lucroLiquido = Number(kpis.lucro_liquido) || 0;
        const despesasTotal = Number(kpis.despesas_total) || 0;
        const viagensConcluidas = Number(kpis.viagens_concluidas) || 0;
        const kmTotal = Number(kpis.km_total) || 0;
        const pesoTotal = Number(kpis.peso_total) || 0;
        const rpmMedio = Number(kpis.rpm_medio) || 0;
        const rtonMedio = kpis.rton_medio != null ? Number(kpis.rton_medio) : null;
        const ticketMedio = Number(kpis.ticket_medio) || 0;
        const avgCycleHours = Number(kpis.avg_cycle_hours) || 0;
        const avaliacaoMedia = Number(kpis.avaliacao_media) || 0;
        const totalAvaliacoes = Number(kpis.total_avaliacoes) || 0;
        const taxaConclusao = Number(kpis.taxa_conclusao) || 0;
        const taxaCancelamento = Number(kpis.taxa_cancelamento) || 0;
        
        return [
          { title: 'Faturamento Bruto', value: receitaTotal, format: 'currency', subtitle: 'Fretes + Serviços', icon: DollarSign },
          { title: 'Lucro Líquido', value: lucroLiquido, format: 'currency', subtitle: `Despesas: ${formatBRL(despesasTotal)}`, icon: TrendingUp, trend: receitaTotal > 0 ? { value: ((lucroLiquido / receitaTotal) * 100), isPositive: lucroLiquido > 0 } : undefined },
          { title: 'Viagens Concluídas', value: viagensConcluidas, format: 'number', subtitle: `${viagensConcluidas} total`, icon: Truck },
          { title: 'Km Rodados', value: kmTotal, format: 'distance', subtitle: `Média: ${formatNum(viagensConcluidas > 0 ? kmTotal / viagensConcluidas : 0, 0)} km/viagem`, icon: MapPin },
          { title: 'R$/km Médio', value: `R$ ${formatNum(rpmMedio, 2)}`, icon: Route },
          { title: 'R$/ton Médio', value: rtonMedio != null && rtonMedio > 0 ? `R$ ${formatNum(rtonMedio, 2)}` : '—', subtitle: pesoTotal > 0 ? `${formatNum(pesoTotal, 0)} ton total` : undefined, icon: Weight },
          { title: 'Ticket Médio', value: ticketMedio, format: 'currency', subtitle: 'Por carreta/assignment', icon: Package },
          { title: 'Tempo Médio Ciclo', value: avgCycleHours > 0 ? formatHours(avgCycleHours) : '—', subtitle: 'Aceito → Entregue', icon: Timer },
          { title: 'Taxa Conclusão', value: `${taxaConclusao.toFixed(1)}%`, icon: CheckCircle },
          { title: 'Taxa Cancelamento', value: `${taxaCancelamento.toFixed(1)}%`, icon: XCircle },
          { title: 'Avaliação Média', value: avaliacaoMedia, format: 'number', subtitle: `${totalAvaliacoes} avaliações`, icon: Star },
          { title: 'Despesas Totais', value: despesasTotal, format: 'currency', icon: Fuel },
        ];
      }

      case 'TRANSPORTADORA': {
        const receitaTotal = Number(kpis.receita_total) || 0;
        const fretesConcluidos = Number(kpis.fretes_concluidos) || 0;
        const totalMotoristas = Number(kpis.total_motoristas) || 0;
        const distanciaTotal = Number(kpis.distancia_total_km) || 0;
        const receitaPorMotorista = Number(kpis.receita_por_motorista) || 0;
        const taxaCancelamento = Number(kpis.taxa_cancelamento) || 0;
        const rsPorKm = Number(kpis.rs_por_km) || 0;
        const avaliacaoMedia = Number(kpis.avaliacao_media) || 0;
        const utilizacaoFrota = Number(kpis.utilizacao_frota) || 0;
        const slaMedio = Number(kpis.sla_medio_horas) || 0;
        const receitaPorCarreta = Number(kpis.receita_por_carreta) || 0;
        
        return [
          { title: 'Faturamento Total', value: receitaTotal, format: 'currency', subtitle: `${fretesConcluidos} concluídos`, icon: DollarSign },
          { title: 'Total de Fretes', value: Number(kpis.total_fretes) || 0, format: 'number', icon: Truck },
          { title: 'Motoristas Ativos', value: totalMotoristas, format: 'number', icon: Users },
          { title: 'Km Total (Frota)', value: distanciaTotal, format: 'distance', icon: MapPin },
          { title: 'Ticket Médio', value: Number(kpis.ticket_medio) || 0, format: 'currency', icon: TrendingUp },
          { title: 'Receita/Motorista', value: receitaPorMotorista, format: 'currency', subtitle: 'Média no período', icon: Users },
          { title: 'Receita/Carreta', value: receitaPorCarreta, format: 'currency', icon: Package },
          { title: 'R$/km Médio', value: `R$ ${formatNum(rsPorKm, 2)}`, icon: Route },
          { title: 'Utilização Frota', value: `${utilizacaoFrota.toFixed(0)}%`, subtitle: 'Motoristas com operação', icon: Activity },
          { title: 'SLA Médio', value: slaMedio > 0 ? formatHours(slaMedio) : '—', subtitle: 'Aceito → Entregue', icon: Timer },
          { title: 'Taxa Cancelamento', value: `${taxaCancelamento.toFixed(1)}%`, icon: XCircle },
          { title: 'Avaliação Média', value: avaliacaoMedia > 0 ? formatNum(avaliacaoMedia, 1) : '—', icon: Star },
        ];
      }

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

  // Build chart configs for NON-MOTORISTA, NON-TRANSPORTADORA panels
  const chartConfigs: ChartConfig[] = useMemo(() => {
    if (!charts || Object.keys(charts).length === 0) return [];
    if (panel === 'MOTORISTA' || panel === 'TRANSPORTADORA') return [];

    const configs: ChartConfig[] = [];

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

    if (charts.volume_por_dia?.length && panel === 'PRODUTOR') {
      configs.push({
        title: 'Operações por Dia',
        type: 'bar',
        data: charts.volume_por_dia.map((d: any) => ({ day: d.dia, fretes: d.fretes || 0, servicos: d.servicos || 0 })),
        dataKeys: [
          { key: 'fretes', label: 'Fretes', color: '#2E7D32' },
          { key: 'servicos', label: 'Serviços', color: '#1976D2' },
        ],
        xAxisKey: 'day',
      });
    }

    if (charts.volume_por_dia?.length && panel === 'PRESTADOR') {
      configs.push({
        title: 'Serviços por Dia',
        type: 'bar',
        data: charts.volume_por_dia.map((d: any) => ({ day: d.dia, concluidos: d.concluidos || 0, cancelados: d.cancelados || 0 })),
        dataKeys: [
          { key: 'concluidos', label: 'Concluídos', color: '#2E7D32' },
          { key: 'cancelados', label: 'Cancelados', color: '#D32F2F' },
        ],
        xAxisKey: 'day',
      });
    }

    if (charts.valor_por_dia?.length) {
      configs.push({
        title: 'Valor Gasto por Dia',
        type: 'bar',
        data: charts.valor_por_dia.map((d: any) => ({ day: d.dia, valor: d.valor || d.total || 0 })),
        dataKeys: [{ key: 'valor', label: 'Valor (R$)', color: '#FF9800' }],
        xAxisKey: 'day',
        valueFormatter: formatBRL,
      });
    }

    if (charts.por_status?.length) {
      configs.push({ title: 'Por Status', type: 'pie', data: charts.por_status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    }

    if (charts.por_tipo_carga?.length) {
      configs.push({ title: 'Tipos de Carga', type: 'bar', data: charts.por_tipo_carga.slice(0, 5), dataKeys: [{ key: 'value', label: 'Quantidade' }], xAxisKey: 'name' });
    }

    if (charts.por_tipo?.length) {
      configs.push({ title: 'Tipos de Carga', type: 'bar', data: charts.por_tipo.slice(0, 5), dataKeys: [{ key: 'value', label: 'Quantidade' }], xAxisKey: 'name' });
    }

    if (charts.por_tipo_servico?.length) {
      configs.push({ title: 'Tipos de Serviço', type: 'bar', data: charts.por_tipo_servico.slice(0, 5), dataKeys: [{ key: 'value', label: 'Quantidade' }], xAxisKey: 'name' });
    }

    if (charts.por_cidade?.length) {
      configs.push({ title: 'Principais Cidades', type: 'bar', data: charts.por_cidade.slice(0, 5), dataKeys: [{ key: 'value', label: 'Serviços' }], xAxisKey: 'name' });
    }

    return configs;
  }, [charts, panel]);

  // ====== MOTORISTA-specific chart sections ======
  // Usa os campos retornados pela RPC: receita_por_mes, viagens_por_mes, top_rotas, dispersao_receita_km
  const motoristaFinanceiroCharts: ChartConfig[] = useMemo(() => {
    if (panel !== 'MOTORISTA') return [];

    // receita_por_mes: [{ mes, receita, viagens }]
    const receitaMes = (charts?.receita_por_mes || []).map((m: any) => ({
      month: m.mes,
      receita: Number(m.receita) || 0,
      viagens: Number(m.viagens) || 0,
    }));

    const acumuladoData = (() => {
      let acc = 0;
      return receitaMes.map((m: any) => { acc += m.receita; return { month: m.month, acumulado: acc }; });
    })();

    return [
      {
        title: 'Receita Mensal',
        type: 'bar' as const,
        data: receitaMes,
        dataKeys: [{ key: 'receita', label: 'Receita', color: 'hsl(var(--primary))' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      },
      {
        title: 'Viagens por Mês',
        type: 'bar' as const,
        data: receitaMes,
        dataKeys: [{ key: 'viagens', label: 'Viagens', color: 'hsl(var(--chart-2))' }],
        xAxisKey: 'month',
      },
      {
        title: 'Receita Acumulada no Período',
        type: 'area' as const,
        data: acumuladoData,
        dataKeys: [{ key: 'acumulado', label: 'Acumulado', color: 'hsl(var(--chart-3))' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      },
    ];
  }, [charts, panel]);

  const motoristaOperacionalCharts: ChartConfig[] = useMemo(() => {
    if (panel !== 'MOTORISTA') return [];

    // viagens_por_mes: [{ mes, viagens, km }]
    const viagensMes = (charts?.viagens_por_mes || []).map((d: any) => ({
      month: d.mes,
      viagens: Number(d.viagens) || 0,
      km: Number(d.km) || 0,
    }));

    // top_rotas: [{ rota, receita, viagens, km_medio }]
    const topRotas = (charts?.top_rotas || []).map((r: any) => ({
      name: r.rota || `${r.origem} → ${r.destino}`,
      receita: Number(r.receita) || 0,
      viagens: Number(r.viagens) || 0,
    }));

    // dispersao_receita_km: [{ km, receita, cargo, rota }]
    const dispersao = (charts?.dispersao_receita_km || []).map((d: any) => ({
      km: Number(d.km) || 0,
      receita: Number(d.receita) || 0,
      name: d.rota || d.cargo || '',
    }));

    return [
      {
        title: 'Km Rodados por Mês',
        type: 'bar' as const,
        data: viagensMes,
        dataKeys: [{ key: 'km', label: 'Km', color: 'hsl(var(--chart-4))' }],
        xAxisKey: 'month',
      },
      {
        title: 'Top Rotas por Receita',
        type: 'horizontal-bar' as const,
        data: topRotas,
        dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: 'hsl(var(--primary))' }],
        xAxisKey: 'name',
        valueFormatter: formatBRL,
        height: 350,
      },
      {
        title: 'Receita vs Distância (dispersão)',
        type: 'scatter' as const,
        data: dispersao,
        dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: 'hsl(var(--chart-5))' }],
        xAxisKey: 'km',
        yAxisKey: 'receita',
        valueFormatter: formatBRL,
      },
    ];
  }, [charts, panel]);

  const motoristaAvaliacoesCharts: ChartConfig[] = useMemo(() => {
    if (panel !== 'MOTORISTA') return [];

    return [
      {
        title: 'Distribuição de Avaliações',
        type: 'bar' as const,
        data: (charts?.avaliacoes_distribuicao || []).map((r: any) => ({
          name: `${r.name || r.stars}★`,
          value: Number(r.value || r.count) || 0,
        })),
        dataKeys: [{ key: 'value', label: 'Avaliações', color: 'hsl(var(--chart-2))' }],
        xAxisKey: 'name',
      },
      {
        title: 'Evolução da Nota Média',
        type: 'line' as const,
        data: (charts?.avaliacoes_trend || []).map((d: any) => ({
          month: d.mes || d.month,
          media: Number(d.media || d.avg_rating) || 0,
        })),
        dataKeys: [{ key: 'media', label: 'Nota Média', color: 'hsl(var(--chart-1))' }],
        xAxisKey: 'month',
      },
    ];
  }, [charts, panel]);


  // ====== TRANSPORTADORA-specific chart sections ======
  const transportadoraFinanceiroCharts: ChartConfig[] = useMemo(() => {
    if (panel !== 'TRANSPORTADORA' || !charts || Object.keys(charts).length === 0) return [];
    const configs: ChartConfig[] = [];

    if (charts.receita_por_dia?.length) {
      configs.push({
        title: 'Faturamento por Dia',
        type: 'line',
        data: charts.receita_por_dia.map((d: any) => ({ day: d.dia, receita: d.receita || 0 })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: '#2E7D32' }],
        xAxisKey: 'day',
        valueFormatter: formatBRL,
      });
    }

    if (charts.receita_por_mes?.length) {
      configs.push({
        title: 'Receita Mensal',
        type: 'bar',
        data: charts.receita_por_mes.map((m: any) => ({ month: m.mes, revenue: m.receita })),
        dataKeys: [{ key: 'revenue', label: 'Receita', color: '#2E7D32' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    }

    if (charts.por_tipo_carga?.length) {
      configs.push({
        title: 'Receita por Tipo de Carga',
        type: 'horizontal-bar',
        data: charts.por_tipo_carga.slice(0, 8).map((c: any) => ({
          name: c.name,
          receita: c.receita || 0,
        })),
        dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#FF9800' }],
        xAxisKey: 'name',
        valueFormatter: formatBRL,
        height: 300,
      });
    }

    return configs;
  }, [charts, panel]);

  const transportadoraOperacionalCharts: ChartConfig[] = useMemo(() => {
    if (panel !== 'TRANSPORTADORA' || !charts || Object.keys(charts).length === 0) return [];
    const configs: ChartConfig[] = [];

    if (charts.volume_por_dia?.length) {
      configs.push({
        title: 'Operações por Dia',
        type: 'bar',
        data: charts.volume_por_dia.map((d: any) => ({
          day: d.dia, concluidos: d.concluidos || 0, cancelados: d.cancelados || 0,
        })),
        dataKeys: [
          { key: 'concluidos', label: 'Concluídos', color: '#2E7D32' },
          { key: 'cancelados', label: 'Cancelados', color: '#D32F2F' },
        ],
        xAxisKey: 'day',
      });
    }

    if (charts.por_motorista?.length) {
      configs.push({
        title: 'Ranking: Motoristas por Receita',
        type: 'horizontal-bar',
        data: charts.por_motorista.slice(0, 10).map((d: any) => ({
          name: d.motorista || 'Sem nome', receita: d.receita || 0,
        })),
        dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#2E7D32' }],
        xAxisKey: 'name',
        valueFormatter: formatBRL,
        height: 350,
      });
    }

    if (charts.por_status?.length) {
      configs.push({
        title: 'Status dos Fretes',
        type: 'pie',
        data: charts.por_status,
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
      });
    }

    if (charts.top_rotas?.length) {
      configs.push({
        title: 'Top Rotas por Receita',
        type: 'horizontal-bar',
        data: charts.top_rotas.slice(0, 8).map((r: any) => ({
          name: `${r.origem} → ${r.destino}`,
          receita: r.receita || 0,
        })),
        dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#1976D2' }],
        xAxisKey: 'name',
        valueFormatter: formatBRL,
        height: 350,
      });
    }

    if (charts.por_cidade?.length) {
      configs.push({
        title: 'Cidades com Mais Operações',
        type: 'horizontal-bar',
        data: charts.por_cidade.slice(0, 8),
        dataKeys: [{ key: 'value', label: 'Operações', color: '#00796B' }],
        xAxisKey: 'name',
        height: 300,
      });
    }

    return configs;
  }, [charts, panel]);

  const isMotorista = panel === 'MOTORISTA';
  const isTransportadora = panel === 'TRANSPORTADORA';
  const showFilters = isMotorista || isTransportadora;

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
        <AlertCircle className="h-12 w-12 text-destructive/60 mb-4" />
        <p className="text-foreground font-medium">Erro ao carregar relatórios</p>
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
          {(dashboardError as any)?.message || 'Verifique sua conexão e tente novamente.'}
        </p>
        <Button onClick={() => refreshNow('retry')} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Section header component
  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) => (
    <div className="flex items-center gap-3 pt-4 pb-2">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  // Render a data table
  const DataTable = ({ title, data, columns }: { title: string; data: any[]; columns: { key: string; label: string; format?: 'currency' | 'number' | 'date' | 'text' }[] }) => {
    if (!data?.length) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col.key} className="text-xs">{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  {columns.map(col => (
                    <TableCell key={col.key} className="text-sm">
                      {col.format === 'currency' ? formatBRL(Number(row[col.key]) || 0) :
                       col.format === 'number' ? formatNum(Number(row[col.key]) || 0) :
                       col.format === 'date' && row[col.key] ? format(new Date(row[col.key]), 'dd/MM/yy', { locale: ptBR }) :
                       row[col.key] ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header com período + exportação + refresh */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">{title}</CardTitle>
                {lastRefreshLabel && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshLabel}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ReportExportButton
                  reportTitle={title}
                  dateRange={dateRange}
                  sections={exportSections}
                  disabled={isLoading}
                />
              </div>
            </div>
            {/* Período */}
            <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
            {/* Filtros + Atualizar */}
            {showFilters && (
              <ReportFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                onRefresh={() => refreshNow('manual')}
                isLoading={isLoading}
                panel={panel}
              />
            )}
            {/* Botão Atualizar para painéis sem barra de filtros */}
            {!showFilters && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => refreshNow('manual')}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                {lastRefreshLabel && (
                  <span className="text-xs text-muted-foreground sm:hidden">{lastRefreshLabel}</span>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <ReportKPICards cards={kpiCards} isLoading={isLoading} columns={isMotorista ? 4 : (isTransportadora ? 4 : (kpiCards.length > 4 ? 6 : 4))} />

      {/* MOTORISTA: Seções organizadas */}
      {isMotorista && (
        <>
          {/* Seção Financeiro - sempre visível */}
          <SectionHeader icon={DollarSign} title="Financeiro" subtitle="Receitas, despesas e lucro" />
          <ReportCharts charts={motoristaFinanceiroCharts} isLoading={isLoading} columns={2} />

          {/* Seção Operacional - sempre visível */}
          <SectionHeader icon={Activity} title="Operacional" subtitle="Volume, rotas, tipos de carga e eficiência" />
          <ReportCharts charts={motoristaOperacionalCharts} isLoading={isLoading} columns={2} />

          {/* Seção Avaliações - sempre visível */}
          <SectionHeader icon={Star} title="Avaliações" subtitle="Desempenho e satisfação" />
          <ReportCharts charts={motoristaAvaliacoesCharts} isLoading={isLoading} columns={2} />

          {/* Tabelas do Motorista */}
          {!isLoading && (
            <>
              <SectionHeader icon={BarChart3} title="Extrato e Análise" subtitle="Detalhamento de ganhos e fretes" />
              
              <DataTable 
                title="Extrato de Ganhos" 
                data={tables?.extrato_ganhos || []}
                columns={[
                  { key: 'data', label: 'Data', format: 'date' },
                  { key: 'tipo', label: 'Tipo' },
                  { key: 'origin_city', label: 'Origem' },
                  { key: 'destination_city', label: 'Destino' },
                  { key: 'km', label: 'Km', format: 'number' },
                  { key: 'receita', label: 'Valor', format: 'currency' },
                  { key: 'rs_km', label: 'R$/km', format: 'number' },
                  { key: 'status_final', label: 'Status' },
                ]}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DataTable 
                  title="🏆 Top 10 Fretes Mais Lucrativos (R$/km)"
                  data={tables?.top_lucrativos || []}
                  columns={[
                    { key: 'rota', label: 'Rota' },
                    { key: 'km', label: 'Km', format: 'number' },
                    { key: 'receita', label: 'Valor', format: 'currency' },
                    { key: 'rs_km', label: 'R$/km', format: 'number' },
                  ]}
                />

                <DataTable 
                  title="⚠️ Top 10 Fretes Menos Lucrativos (R$/km)"
                  data={tables?.bottom_lucrativos || []}
                  columns={[
                    { key: 'rota', label: 'Rota' },
                    { key: 'km', label: 'Km', format: 'number' },
                    { key: 'receita', label: 'Valor', format: 'currency' },
                    { key: 'rs_km', label: 'R$/km', format: 'number' },
                  ]}
                />
              </div>
            </>
          )}
        </>
      )}


      {/* TRANSPORTADORA: Seções organizadas */}
      {isTransportadora && (
        <>
          {/* Seção Financeiro - sempre visível */}
          <SectionHeader icon={DollarSign} title="Financeiro" subtitle="Faturamento e receita por tipo" />
          <ReportCharts charts={transportadoraFinanceiroCharts} isLoading={isLoading} columns={2} />

          {/* Seção Operacional - sempre visível */}
          <SectionHeader icon={Activity} title="Operacional" subtitle="Volume, motoristas, rotas e cidades" />
          <ReportCharts charts={transportadoraOperacionalCharts} isLoading={isLoading} columns={2} />

          {/* Tabelas da Transportadora */}
          {!isLoading && (
            <>
              <SectionHeader icon={Users} title="Análise por Motorista" subtitle="Desempenho individual da frota" />
              
              <DataTable 
                title="Resumo por Motorista" 
                data={tables?.resumo_por_motorista || []}
                columns={[
                  { key: 'motorista', label: 'Motorista' },
                  { key: 'viagens', label: 'Viagens', format: 'number' },
                  { key: 'receita', label: 'Receita', format: 'currency' },
                  { key: 'km', label: 'Km', format: 'number' },
                  { key: 'rs_km', label: 'R$/km', format: 'number' },
                  { key: 'cancelamentos', label: 'Cancel.', format: 'number' },
                ]}
              />

              <SectionHeader icon={Route} title="Análise por Rota" subtitle="Rotas mais frequentes e rentáveis" />

              <DataTable 
                title="Resumo por Rota" 
                data={tables?.resumo_por_rota || []}
                columns={[
                  { key: 'rota', label: 'Rota' },
                  { key: 'frequencia', label: 'Freq.', format: 'number' },
                  { key: 'receita', label: 'Receita', format: 'currency' },
                  { key: 'km_medio', label: 'Km Médio', format: 'number' },
                  { key: 'rs_km', label: 'R$/km', format: 'number' },
                ]}
              />

              <DataTable 
                title="Histórico de Operações" 
                data={tables?.ultimas_operacoes || []}
                columns={[
                  { key: 'data', label: 'Data', format: 'date' },
                  { key: 'motorista', label: 'Motorista' },
                  { key: 'origin_city', label: 'Origem' },
                  { key: 'destination_city', label: 'Destino' },
                  { key: 'km', label: 'Km', format: 'number' },
                  { key: 'receita', label: 'Valor', format: 'currency' },
                  { key: 'status_final', label: 'Status' },
                ]}
              />
            </>
          )}
        </>
      )}

      {/* Other panels: flat chart list */}
      {!isMotorista && !isTransportadora && (
        <ReportCharts charts={chartConfigs} isLoading={isLoading} columns={2} />
      )}

      {/* Aviso sem dados operacionais (não esconde gráficos, apenas informa) */}
      {!isLoading && isMotorista && kpiCards.every(k => (typeof k.value === 'number' ? k.value === 0 : !k.value)) && (
        <Card>
          <CardContent className="py-6 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <h3 className="text-base font-semibold mb-1">Nenhuma operação registrada no período</h3>
            <p className="text-sm text-muted-foreground">
              Quando você concluir fretes ou serviços, os dados aparecerão automaticamente nos gráficos acima.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
