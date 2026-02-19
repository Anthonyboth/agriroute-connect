/**
 * ReportsDashboardPanel.tsx
 *
 * Painel de relatórios premium — layout profissional mobile-first.
 * Compatível com MOTORISTA, TRANSPORTADORA, PRODUTOR, PRESTADOR.
 * ⚠️ Sem alterações de lógica/cálculo — apenas layout e UX.
 */
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertCircle, RefreshCw, DollarSign, Truck, Wrench, MapPin, Star,
  Fuel, Clock, TrendingUp, Users, Percent, Package, CheckCircle,
  BarChart3, Activity, Route, Weight, Timer, XCircle, ArrowUpRight,
  ArrowDownRight, Minus, CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ReportCharts,
  ReportExportButton,
  ReportFiltersBar,
  formatBRL,
  type KPICardData,
  type ChartConfig,
} from '@/components/reports';
import { ReportPeriodFilter } from '@/components/reports/ReportPeriodFilter';
import { useReportsDashboardUnified } from '@/hooks/useReportsDashboardUnified';
import type { PanelType } from '@/hooks/useReportsDashboard';
import { toTons, formatTonsPtBR, formatMonthLabelPtBR, formatRouteLabel } from '@/lib/reports-formatters';
import { cn } from '@/lib/utils';

interface ReportsDashboardPanelProps {
  panel: PanelType;
  profileId: string | undefined;
  title: string;
}

// ─── Formatadores locais ─────────────────────────────────────────────────────
const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${fmtNum(h, 1)}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${Math.round(h % 24)}h`;
};

// ─── Componente: Bloco Principal de Faturamento ──────────────────────────────
interface HeroFinanceProps {
  label: string;
  value: number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  secondary: { label: string; value: string }[];
  isLoading: boolean;
}

const HeroFinanceBlock: React.FC<HeroFinanceProps> = ({ label, value, subtitle, trend, secondary, isLoading }) => (
  <div className="rounded-2xl bg-[rgba(22,163,74,0.08)] border border-[rgba(22,163,74,0.18)] p-5 sm:p-6">
    {isLoading ? (
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      </div>
    ) : (
      <>
        {/* Label principal */}
        <p className="text-xs font-semibold uppercase tracking-widest text-[#16a34a] mb-1">{label}</p>

        {/* Valor destaque */}
        <div className="flex items-end gap-3 mb-1">
          <span className="text-4xl sm:text-5xl font-extrabold text-foreground leading-none">
            {formatBRL(value)}
          </span>
          {trend && trend.value !== 0 && (
            <span className={cn(
              'flex items-center gap-0.5 text-sm font-semibold mb-1',
              trend.isPositive ? 'text-[#16a34a]' : 'text-destructive'
            )}>
              {trend.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}

        {/* Grid secundário */}
        {secondary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {secondary.map((s, i) => (
              <div key={i} className="bg-white/70 dark:bg-card/60 rounded-xl px-3 py-2.5 backdrop-blur-sm">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{s.label}</p>
                <p className="text-sm font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
);

// ─── Componente: Grid de KPIs Operacionais ───────────────────────────────────
interface OpKPI { label: string; value: string; icon: React.ElementType; highlight?: boolean }

const OperationalGrid: React.FC<{ items: OpKPI[]; isLoading: boolean }> = ({ items, isLoading }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
    {isLoading
      ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
      : items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={cn(
                'rounded-2xl border p-3.5 flex flex-col gap-1.5 bg-card',
                item.highlight && 'border-[rgba(22,163,74,0.3)] bg-[rgba(22,163,74,0.04)]'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">
                  {item.label}
                </p>
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', item.highlight ? 'text-[#16a34a]' : 'text-muted-foreground/60')} />
              </div>
              <p className={cn('text-xl font-extrabold', item.highlight ? 'text-[#16a34a]' : 'text-foreground')}>
                {item.value}
              </p>
            </div>
          );
        })}
  </div>
);

// ─── Componente: Badge de Status ─────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = String(status).toUpperCase();
  const map: Record<string, { label: string; cls: string }> = {
    DELIVERED: { label: 'Concluído', cls: 'bg-[rgba(22,163,74,0.12)] text-[#16a34a]' },
    COMPLETED: { label: 'Concluído', cls: 'bg-[rgba(22,163,74,0.12)] text-[#16a34a]' },
    CANCELLED: { label: 'Cancelado', cls: 'bg-destructive/10 text-destructive' },
    IN_TRANSIT: { label: 'Em Trânsito', cls: 'bg-blue-50 text-blue-600' },
    ACCEPTED: { label: 'Aceito', cls: 'bg-amber-50 text-amber-600' },
    OPEN: { label: 'Aberto', cls: 'bg-muted text-muted-foreground' },
  };
  const cfg = map[s] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', cfg.cls)}>
      {cfg.label}
    </span>
  );
};

// ─── Componente: Seção de título ─────────────────────────────────────────────
const SectionTitle: React.FC<{ icon: React.ElementType; title: string; subtitle?: string }> = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-2.5 pt-2">
    <div className="h-8 w-8 rounded-xl bg-[rgba(22,163,74,0.1)] flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4 text-[#16a34a]" />
    </div>
    <div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

// ─── Componente principal ────────────────────────────────────────────────────
export const ReportsDashboardPanel: React.FC<ReportsDashboardPanelProps> = ({ panel, profileId, title }) => {
  const {
    kpis, charts, tables,
    isLoading, isError, error: dashboardError,
    filters, setFilters, dateRange, setDateRange,
    refreshNow, isRefreshing, lastRefreshLabel, refetch,
  } = useReportsDashboardUnified({ panel, profileId });

  const isMotorista = panel === 'MOTORISTA';
  const isTransportadora = panel === 'TRANSPORTADORA';
  const isPrestador = panel === 'PRESTADOR';

  // ── KPIs MOTORISTA ────────────────────────────────────────────────────────
  const motoristaHero = useMemo(() => {
    if (!isMotorista) return null;
    const receitaTotal   = Number(kpis.receita_total)   || 0;
    const lucroLiquido   = Number(kpis.lucro_liquido)   || 0;
    const despesasTotal  = Number(kpis.despesas_total)  || 0;
    const ticketMedio    = Number(kpis.ticket_medio)    || 0;
    const rpmMedio       = Number(kpis.rpm_medio)       || 0;
    const trend = receitaTotal > 0
      ? { value: (lucroLiquido / receitaTotal) * 100, isPositive: lucroLiquido >= 0 }
      : undefined;
    return {
      value: receitaTotal,
      trend,
      secondary: [
        { label: 'Lucro líquido',   value: formatBRL(lucroLiquido) },
        { label: 'Despesas',        value: formatBRL(despesasTotal) },
        { label: 'Ticket médio',    value: formatBRL(ticketMedio) },
        { label: 'R$/km médio',     value: rpmMedio > 0 ? `R$ ${fmtNum(rpmMedio, 2)}` : '—' },
      ],
    };
  }, [kpis, isMotorista]);

  const motoristaOp = useMemo(() => {
    if (!isMotorista) return [];
    const kmTotal         = Number(kpis.km_total)          || 0;
    const viagens         = Number(kpis.viagens_concluidas) || 0;
    const avgCycle        = Number(kpis.avg_cycle_hours)    || 0;
    const taxaConclusao   = Number(kpis.taxa_conclusao)     || 0;
    const taxaCancel      = Number(kpis.taxa_cancelamento)  || 0;
    const avaliacao       = Number(kpis.avaliacao_media)    || 0;
    return [
      { label: 'Viagens',        value: fmtNum(viagens),                          icon: Truck,       highlight: true },
      { label: 'Km rodados',     value: `${fmtNum(kmTotal)} km`,                  icon: MapPin },
      { label: 'Tempo médio',    value: avgCycle > 0 ? fmtHours(avgCycle) : '—',  icon: Timer },
      { label: 'Conclusão',      value: `${taxaConclusao.toFixed(1)}%`,            icon: CheckCircle, highlight: true },
      { label: 'Cancelamento',   value: `${taxaCancel.toFixed(1)}%`,              icon: XCircle },
      { label: 'Avaliação',      value: avaliacao > 0 ? fmtNum(avaliacao, 1) : '—', icon: Star },
    ] satisfies OpKPI[];
  }, [kpis, isMotorista]);

  // ── KPIs TRANSPORTADORA ───────────────────────────────────────────────────
  const transportadoraHero = useMemo(() => {
    if (!isTransportadora) return null;
    const receitaTotal       = Number(kpis.receita_total)          || 0;
    const fretesConcluidos   = Number(kpis.fretes_concluidos)      || 0;
    const receitaMotorista   = Number(kpis.receita_por_motorista)  || 0;
    const ticketMedio        = Number(kpis.ticket_medio)           || 0;
    const rsPorKm            = Number(kpis.rs_por_km)              || 0;
    return {
      value: receitaTotal,
      subtitle: `${fretesConcluidos} fretes concluídos`,
      secondary: [
        { label: 'Receita/motorista', value: formatBRL(receitaMotorista) },
        { label: 'Ticket médio',      value: formatBRL(ticketMedio) },
        { label: 'R$/km médio',       value: rsPorKm > 0 ? `R$ ${fmtNum(rsPorKm, 2)}` : '—' },
        { label: 'Total fretes',      value: fmtNum(Number(kpis.total_fretes) || 0) },
      ],
    };
  }, [kpis, isTransportadora]);

  const transportadoraOp = useMemo(() => {
    if (!isTransportadora) return [];
    const totalMotoristas  = Number(kpis.total_motoristas)   || 0;
    const distanciaTotal   = Number(kpis.distancia_total_km) || 0;
    const utilizacao       = Number(kpis.utilizacao_frota)   || 0;
    const sla              = Number(kpis.sla_medio_horas)    || 0;
    const taxaCancel       = Number(kpis.taxa_cancelamento)  || 0;
    const avaliacao        = Number(kpis.avaliacao_media)    || 0;
    return [
      { label: 'Motoristas ativos', value: fmtNum(totalMotoristas),              icon: Users,      highlight: true },
      { label: 'Km total (frota)',  value: `${fmtNum(distanciaTotal)} km`,       icon: MapPin },
      { label: 'Utilização frota',  value: `${utilizacao.toFixed(0)}%`,          icon: Activity,   highlight: true },
      { label: 'SLA médio',         value: sla > 0 ? fmtHours(sla) : '—',       icon: Timer },
      { label: 'Cancelamento',      value: `${taxaCancel.toFixed(1)}%`,          icon: XCircle },
      { label: 'Avaliação média',   value: avaliacao > 0 ? fmtNum(avaliacao, 1) : '—', icon: Star },
    ] satisfies OpKPI[];
  }, [kpis, isTransportadora]);

  // ── Gráficos MOTORISTA ────────────────────────────────────────────────────
  const motoristaCharts: ChartConfig[] = useMemo(() => {
    if (!isMotorista) return [];
    const receitaMes = (charts?.receita_por_mes || []).map((m: any) => ({
      month: formatMonthLabelPtBR(m.mes),
      receita: Number(m.receita) || 0,
      viagens: Math.round(Number(m.viagens) || 0),
    }));
    const viagensMes = (charts?.viagens_por_mes || []).map((d: any) => ({
      month: formatMonthLabelPtBR(d.mes),
      viagens: Math.round(Number(d.viagens) || 0),
      km: Number(d.km) || 0,
    }));
    const topRotas = (charts?.top_rotas || []).map((r: any) => ({
      name: formatRouteLabel(r.rota || (r.origem && r.destino ? `${r.origem} → ${r.destino}` : '')),
      receita: Number(r.receita) || 0,
    }));
    const dispersao = (charts?.dispersao_receita_km || []).map((d: any) => ({
      km: Number(d.km) || 0,
      receita: Number(d.receita) || 0,
      name: formatRouteLabel(d.rota) || d.cargo || '',
    }));
    const acc = (() => {
      let a = 0;
      return receitaMes.map((m: any) => { a += m.receita; return { month: m.month, acumulado: a }; });
    })();

    return [
      { title: 'Receita por mês', type: 'area', data: receitaMes, dataKeys: [{ key: 'receita', label: 'Receita', color: '#16a34a' }], xAxisKey: 'month', valueFormatter: formatBRL },
      { title: 'Receita acumulada no período', type: 'area', data: acc, dataKeys: [{ key: 'acumulado', label: 'Acumulado', color: 'hsl(var(--chart-3))' }], xAxisKey: 'month', valueFormatter: formatBRL },
      { title: 'Km rodados por mês', type: 'bar', data: viagensMes, dataKeys: [{ key: 'km', label: 'Km', color: 'hsl(var(--chart-4))' }], xAxisKey: 'month' },
      { title: 'Top rotas por receita', type: 'horizontal-bar', data: topRotas, dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#16a34a' }], xAxisKey: 'name', valueFormatter: formatBRL, height: 320 },
      ...(dispersao.length > 0 ? [{ title: 'Receita vs distância', type: 'scatter' as const, data: dispersao, dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: 'hsl(var(--chart-5))' }], xAxisKey: 'km', yAxisKey: 'receita', valueFormatter: formatBRL }] : []),
    ];
  }, [charts, isMotorista]);

  // ── Gráficos TRANSPORTADORA ───────────────────────────────────────────────
  const transportadoraCharts: ChartConfig[] = useMemo(() => {
    if (!isTransportadora || !charts) return [];
    const configs: ChartConfig[] = [];
    if (charts.receita_por_mes?.length) configs.push({ title: 'Receita mensal', type: 'area', data: charts.receita_por_mes.map((m: any) => ({ month: formatMonthLabelPtBR(m.mes), receita: m.receita || 0 })), dataKeys: [{ key: 'receita', label: 'Receita', color: '#16a34a' }], xAxisKey: 'month', valueFormatter: formatBRL });
    if (charts.por_motorista?.length) configs.push({ title: 'Motoristas por receita', type: 'horizontal-bar', data: charts.por_motorista.slice(0, 10).map((d: any) => ({ name: d.motorista || 'Sem nome', receita: d.receita || 0 })), dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#16a34a' }], xAxisKey: 'name', valueFormatter: formatBRL, height: 320 });
    if (charts.por_status?.length) configs.push({ title: 'Status dos fretes', type: 'pie', data: charts.por_status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    if (charts.top_rotas?.length) configs.push({ title: 'Top rotas por receita', type: 'horizontal-bar', data: charts.top_rotas.slice(0, 8).map((r: any) => ({ name: formatRouteLabel(r.rota || (r.origem && r.destino ? `${r.origem} → ${r.destino}` : '')), receita: r.receita || 0 })), dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#1976D2' }], xAxisKey: 'name', valueFormatter: formatBRL, height: 320 });
    return configs;
  }, [charts, isTransportadora]);

  // ── KPIs PRESTADOR ────────────────────────────────────────────────────────
  const prestadorHero = useMemo(() => {
    if (!isPrestador) return null;
    const receitaTotal   = Number(kpis.receita_total)    || 0;
    const servicosConcluidos = Number(kpis.servicos_concluidos) || 0;
    const ticketMedio    = Number(kpis.ticket_medio)     || 0;
    const avaliacao      = Number(kpis.avaliacao_media)  || 0;
    return {
      value: receitaTotal,
      subtitle: `${servicosConcluidos} serviços concluídos no período`,
      secondary: [
        { label: 'Ticket médio',   value: formatBRL(ticketMedio) },
        { label: 'Avaliação',      value: avaliacao > 0 ? `${fmtNum(avaliacao, 1)} ★` : '—' },
        { label: 'Concluídos',     value: fmtNum(servicosConcluidos) },
        { label: 'Total',          value: fmtNum(Number(kpis.total_servicos) || 0) },
      ],
    };
  }, [kpis, isPrestador]);

  const prestadorOp = useMemo(() => {
    if (!isPrestador) return [];
    const servicosConcluidos = Number(kpis.servicos_concluidos)   || 0;
    const taxaConclusao      = Number(kpis.taxa_conclusao)         || 0;
    const taxaCancel         = Number(kpis.taxa_cancelamento)      || 0;
    const avgTempo           = Number(kpis.avg_service_time_hours) || 0;
    const avaliacao          = Number(kpis.avaliacao_media)        || 0;
    const pendentes          = Number(kpis.servicos_pendentes)     || 0;
    return [
      { label: 'Concluídos',   value: fmtNum(servicosConcluidos),                    icon: CheckCircle, highlight: true },
      { label: 'Pendentes',    value: fmtNum(pendentes),                              icon: Clock },
      { label: 'Tempo médio',  value: avgTempo > 0 ? fmtHours(avgTempo) : '—',       icon: Timer },
      { label: 'Conclusão',    value: `${taxaConclusao.toFixed(1)}%`,                 icon: Percent,     highlight: true },
      { label: 'Cancelamento', value: `${taxaCancel.toFixed(1)}%`,                   icon: XCircle },
      { label: 'Avaliação',    value: avaliacao > 0 ? fmtNum(avaliacao, 1) : '—',    icon: Star },
    ] satisfies OpKPI[];
  }, [kpis, isPrestador]);

  // ── Gráficos PRESTADOR ────────────────────────────────────────────────────
  const prestadorCharts: ChartConfig[] = useMemo(() => {
    if (!isPrestador || !charts) return [];
    const configs: ChartConfig[] = [];
    if (charts.receita_por_mes?.length)
      configs.push({
        title: 'Receita por mês',
        type: 'area',
        data: charts.receita_por_mes.map((m: any) => ({
          month: formatMonthLabelPtBR(m.mes),
          receita: Number(m.receita) || 0,
          servicos: Math.round(Number(m.servicos) || 0),
        })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: '#16a34a' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    if (charts.por_categoria?.length)
      configs.push({
        title: 'Serviços por categoria',
        type: 'pie',
        data: charts.por_categoria,
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
      });
    if (charts.por_status?.length)
      configs.push({
        title: 'Status dos serviços',
        type: 'pie',
        data: charts.por_status,
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
      });
    if (charts.top_cidades?.length)
      configs.push({
        title: 'Top cidades',
        type: 'horizontal-bar',
        data: charts.top_cidades.slice(0, 8).map((c: any) => ({
          name: c.cidade || c.city || '—',
          servicos: Number(c.servicos || c.value) || 0,
        })),
        dataKeys: [{ key: 'servicos', label: 'Serviços', color: '#16a34a' }],
        xAxisKey: 'name',
        height: 320,
      });
    return configs;
  }, [charts, isPrestador]);

  // ── Gráficos outros painéis ───────────────────────────────────────────────
  const genericCharts: ChartConfig[] = useMemo(() => {
    if (isMotorista || isTransportadora || isPrestador || !charts) return [];
    const configs: ChartConfig[] = [];
    if (charts.receita_por_mes?.length) configs.push({ title: 'Receita por mês', type: 'bar', data: charts.receita_por_mes.map((m: any) => ({ month: formatMonthLabelPtBR(m.mes), revenue: m.receita })), dataKeys: [{ key: 'revenue', label: 'Receita' }], xAxisKey: 'month', valueFormatter: formatBRL });
    if (charts.volume_por_dia?.length && panel === 'PRODUTOR') configs.push({ title: 'Operações por dia', type: 'bar', data: charts.volume_por_dia.map((d: any) => ({ day: d.dia, fretes: d.fretes || 0, servicos: d.servicos || 0 })), dataKeys: [{ key: 'fretes', label: 'Fretes', color: '#16a34a' }, { key: 'servicos', label: 'Serviços', color: '#1976D2' }], xAxisKey: 'day' });
    if (charts.por_status?.length) configs.push({ title: 'Por status', type: 'pie', data: charts.por_status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    return configs;
  }, [charts, isMotorista, isTransportadora, isPrestador, panel]);

  // ── Exportação ────────────────────────────────────────────────────────────
  const exportSections = useMemo(() => [{
    title: 'Resumo Geral', type: 'kpi' as const,
    data: [
      { label: 'Faturamento Bruto', value: Number(kpis.receita_total) || 0 },
      { label: 'Viagens/Fretes', value: Number(kpis.viagens_concluidas || kpis.fretes_concluidos) || 0 },
    ],
  }], [kpis]);

  // ── Guard: sem perfil ─────────────────────────────────────────────────────
  if (!profileId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Usuário não autenticado</p>
      </div>
    );
  }

  // ── Guard: erro ───────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <p className="font-medium">Erro ao carregar relatórios</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {(dashboardError as any)?.message || 'Verifique sua conexão e tente novamente.'}
        </p>
        <Button onClick={() => refreshNow('retry')} variant="outline" size="sm" className="gap-2 mt-1">
          <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
        </Button>
      </div>
    );
  }

  // ── Extrato (tabela estilo financeiro) ────────────────────────────────────
  const ExtratoTable: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data?.length) return null;
    return (
      <Card className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs font-semibold">Data</TableHead>
                <TableHead className="text-xs font-semibold">Rota</TableHead>
                <TableHead className="text-xs font-semibold hidden sm:table-cell">Tipo</TableHead>
                <TableHead className="text-xs font-semibold hidden sm:table-cell text-right">Km</TableHead>
                <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.data ? format(new Date(row.data), 'dd/MM/yy', { locale: ptBR }) : '—'}
                  </TableCell>
                  <TableCell className="text-xs max-w-[120px] sm:max-w-none truncate">
                    {row.origin_city && row.destination_city
                      ? `${row.origin_city} → ${row.destination_city}`
                      : row.rota || '—'}
                  </TableCell>
                  <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">{row.tipo || '—'}</TableCell>
                  <TableCell className="text-xs hidden sm:table-cell text-right">{row.km ? fmtNum(Number(row.km)) : '—'}</TableCell>
                  <TableCell className="text-xs text-right font-semibold text-[#16a34a] whitespace-nowrap">
                    {row.receita ? formatBRL(Number(row.receita)) : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.status_final || row.status || ''} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-6">

      {/* ── Cabeçalho Premium ─────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
        {/* Título + ações */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Relatórios</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Resumo financeiro e operacional</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ReportExportButton reportTitle={title} dateRange={dateRange} sections={exportSections} disabled={isLoading} />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={() => refreshNow('manual')}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Filtro de período */}
        <ReportPeriodFilter dateRange={dateRange} onDateRangeChange={setDateRange} />

        {/* Data exibida */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          <span>
            {format(dateRange.from, "dd 'de' MMM yyyy", { locale: ptBR })}
            {' – '}
            {format(dateRange.to, "dd 'de' MMM yyyy", { locale: ptBR })}
          </span>
          {lastRefreshLabel && <span className="ml-2 hidden sm:inline">· {lastRefreshLabel}</span>}
        </div>

        {/* Filtros adicionais (MOTORISTA / TRANSPORTADORA / PRESTADOR) */}
        {(isMotorista || isTransportadora || isPrestador) && (
          <ReportFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={() => refreshNow('manual')}
            isLoading={isLoading}
            panel={panel}
          />
        )}
      </div>

      {/* ── MOTORISTA ─────────────────────────────────────────────────── */}
      {isMotorista && motoristaHero && (
        <>
          {/* Bloco financeiro destaque */}
          <HeroFinanceBlock
            label="Faturamento Bruto"
            value={motoristaHero.value}
            trend={motoristaHero.trend}
            subtitle="Fretes no período"
            secondary={motoristaHero.secondary}
            isLoading={isLoading}
          />

          {/* Bloco operacional */}
          <div className="space-y-3">
            <SectionTitle icon={Activity} title="Operacional" subtitle="Volume, eficiência e avaliação" />
            <OperationalGrid items={motoristaOp} isLoading={isLoading} />
          </div>

          {/* Gráficos */}
          <div className="space-y-3">
            <SectionTitle icon={BarChart3} title="Análise gráfica" subtitle="Evolução e comparativos" />
            <ReportCharts charts={motoristaCharts} isLoading={isLoading} columns={2} />
          </div>

          {/* Extrato */}
          {!isLoading && (tables?.extrato_ganhos?.length > 0) && (
            <div className="space-y-3">
              <SectionTitle icon={DollarSign} title="Extrato de ganhos" subtitle="Histórico detalhado por viagem" />
              <ExtratoTable data={tables.extrato_ganhos} />
            </div>
          )}

          {/* Top/Bottom lucrativos */}
          {!isLoading && (tables?.top_lucrativos?.length > 0 || tables?.bottom_lucrativos?.length > 0) && (
            <div className="space-y-3">
              <SectionTitle icon={TrendingUp} title="Fretes por lucratividade" subtitle="R$/km — melhores e piores" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {tables?.top_lucrativos?.length > 0 && (
                  <Card className="rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b bg-[rgba(22,163,74,0.05)]">
                      <p className="text-xs font-semibold text-[#16a34a]">🏆 Top 10 mais lucrativos</p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead className="text-xs">Rota</TableHead><TableHead className="text-xs text-right">Km</TableHead><TableHead className="text-xs text-right">Valor</TableHead><TableHead className="text-xs text-right">R$/km</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {tables.top_lucrativos.map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[100px] truncate">{r.rota || '—'}</TableCell>
                              <TableCell className="text-xs text-right">{fmtNum(r.km || 0)}</TableCell>
                              <TableCell className="text-xs text-right font-medium">{formatBRL(r.receita || 0)}</TableCell>
                              <TableCell className="text-xs text-right text-[#16a34a] font-bold">{fmtNum(r.rs_km || 0, 2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
                {tables?.bottom_lucrativos?.length > 0 && (
                  <Card className="rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b bg-destructive/5">
                      <p className="text-xs font-semibold text-destructive">⚠️ Top 10 menos lucrativos</p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead className="text-xs">Rota</TableHead><TableHead className="text-xs text-right">Km</TableHead><TableHead className="text-xs text-right">Valor</TableHead><TableHead className="text-xs text-right">R$/km</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                          {tables.bottom_lucrativos.map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs max-w-[100px] truncate">{r.rota || '—'}</TableCell>
                              <TableCell className="text-xs text-right">{fmtNum(r.km || 0)}</TableCell>
                              <TableCell className="text-xs text-right font-medium">{formatBRL(r.receita || 0)}</TableCell>
                              <TableCell className="text-xs text-right text-destructive font-bold">{fmtNum(r.rs_km || 0, 2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TRANSPORTADORA ────────────────────────────────────────────── */}
      {isTransportadora && transportadoraHero && (
        <>
          <HeroFinanceBlock
            label="Faturamento Total"
            value={transportadoraHero.value}
            subtitle={transportadoraHero.subtitle}
            secondary={transportadoraHero.secondary}
            isLoading={isLoading}
          />

          <div className="space-y-3">
            <SectionTitle icon={Activity} title="Operacional da frota" subtitle="Motoristas, distância e eficiência" />
            <OperationalGrid items={transportadoraOp} isLoading={isLoading} />
          </div>

          <div className="space-y-3">
            <SectionTitle icon={BarChart3} title="Análise gráfica" subtitle="Receita, rotas e motoristas" />
            <ReportCharts charts={transportadoraCharts} isLoading={isLoading} columns={2} />
          </div>

          {!isLoading && tables?.resumo_por_motorista?.length > 0 && (
            <div className="space-y-3">
              <SectionTitle icon={Users} title="Desempenho por motorista" />
              <Card className="rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs">Motorista</TableHead>
                        <TableHead className="text-xs text-right">Viagens</TableHead>
                        <TableHead className="text-xs text-right">Receita</TableHead>
                        <TableHead className="text-xs text-right hidden sm:table-cell">Km</TableHead>
                        <TableHead className="text-xs text-right hidden sm:table-cell">R$/km</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.resumo_por_motorista.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">{r.motorista || '—'}</TableCell>
                          <TableCell className="text-xs text-right">{fmtNum(r.viagens || 0)}</TableCell>
                          <TableCell className="text-xs text-right font-semibold text-[#16a34a]">{formatBRL(r.receita || 0)}</TableCell>
                          <TableCell className="text-xs text-right hidden sm:table-cell">{fmtNum(r.km || 0)}</TableCell>
                          <TableCell className="text-xs text-right hidden sm:table-cell">{fmtNum(r.rs_km || 0, 2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── PRESTADOR DE SERVIÇOS ─────────────────────────────────────── */}
      {isPrestador && prestadorHero && (
        <>
          <HeroFinanceBlock
            label="Faturamento Bruto"
            value={prestadorHero.value}
            subtitle={prestadorHero.subtitle}
            secondary={prestadorHero.secondary}
            isLoading={isLoading}
          />

          <div className="space-y-3">
            <SectionTitle icon={Activity} title="Operacional" subtitle="Volume, eficiência e avaliação" />
            <OperationalGrid items={prestadorOp} isLoading={isLoading} />
          </div>

          <div className="space-y-3">
            <SectionTitle icon={BarChart3} title="Análise gráfica" subtitle="Evolução e comparativos" />
            {prestadorCharts.length > 0 ? (
              <ReportCharts charts={prestadorCharts} isLoading={isLoading} columns={2} />
            ) : isLoading ? (
              <ReportCharts charts={[]} isLoading={true} columns={2} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[
                  'Receita por mês',
                  'Serviços por categoria',
                  'Status dos serviços',
                  'Top cidades',
                ].map((title) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle className="text-base">{title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                        Sem dados para exibir
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {!isLoading && tables?.extrato_servicos?.length > 0 && (
            <div className="space-y-3">
              <SectionTitle icon={DollarSign} title="Extrato de serviços" subtitle="Histórico detalhado por serviço" />
              <Card className="rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs font-semibold">Data</TableHead>
                        <TableHead className="text-xs font-semibold">Serviço</TableHead>
                        <TableHead className="text-xs font-semibold hidden sm:table-cell">Categoria</TableHead>
                        <TableHead className="text-xs font-semibold hidden sm:table-cell">Avaliação</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.extrato_servicos.map((row: any, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {row.data ? format(new Date(row.data), 'dd/MM/yy', { locale: ptBR }) : '—'}
                          </TableCell>
                          <TableCell className="text-xs max-w-[120px] sm:max-w-none truncate">
                            {row.titulo || row.service_type || '—'}
                          </TableCell>
                          <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">
                            {row.categoria || row.category || '—'}
                          </TableCell>
                          <TableCell className="text-xs hidden sm:table-cell text-center">
                            {row.avaliacao ? `${Number(row.avaliacao).toFixed(1)} ★` : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold text-[#16a34a] whitespace-nowrap">
                            {row.receita ? formatBRL(Number(row.receita)) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={row.status || ''} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ── Outros painéis (PRODUTOR) ─────────────────────────────────── */}
      {!isMotorista && !isTransportadora && !isPrestador && (
        <ReportCharts charts={genericCharts} isLoading={isLoading} columns={2} />
      )}

      {/* ── Aviso sem dados ────────────────────────────────────────────── */}
      {!isLoading && (isMotorista || isTransportadora || isPrestador) &&
        Number(kpis.receita_total) === 0 && Number(kpis.servicos_concluidos || kpis.viagens_concluidas || kpis.fretes_concluidos) === 0 && (
        <Card className="rounded-2xl">
          <CardContent className="py-10 text-center">
            <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="text-base font-semibold mb-1">Nenhum serviço no período</h3>
            <p className="text-sm text-muted-foreground">
              Quando você concluir serviços, os dados aparecerão aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
