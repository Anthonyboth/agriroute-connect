/**
 * ReportsDashboardPanel.tsx
 *
 * Painel de relatórios premium — layout profissional mobile-first.
 * Compatível com MOTORISTA, TRANSPORTADORA, PRODUTOR, PRESTADOR.
 * ⚠️ Sem alterações de lógica/cálculo — apenas layout e UX.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertCircle, RefreshCw, DollarSign, Truck, Wrench, MapPin, Star,
  Fuel, Clock, TrendingUp, Users, Percent, Package, CheckCircle,
  BarChart3, Activity, Route, Weight, Timer, XCircle, ArrowUpRight,
  ArrowDownRight, Minus, CalendarDays, Filter, Search, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { useProducerReportData } from '@/hooks/useProducerReportData';
import type { PanelType } from '@/hooks/useReportsDashboard';
import { toTons, formatTonsPtBR, formatMonthLabelPtBR, formatRouteLabel } from '@/lib/reports-formatters';
import { supabase } from '@/integrations/supabase/client';
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

// ─── Tipos e helpers para Insights rápidos (PowerBI-like) ────────────────────
type Insight = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'bad' | 'neutral';
};

const compactText = (s: string, max = 18) => (s.length > max ? `${s.slice(0, max)}…` : s);

function pickBestWorstMonths(receitaMes: { month: string; receita: number; viagens: number }[]) {
  const rows = receitaMes.filter((r) => r.month);
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (b.receita > a.receita ? b : a));
  const worst = rows.reduce((a, b) => (b.receita < a.receita ? b : a));
  return { best, worst };
}

const HighlightsGrid: React.FC<{ items: Insight[]; isLoading: boolean }> = ({ items, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.slice(0, 6).map((it, i) => (
        <div
          key={i}
          className={cn(
            'rounded-2xl border p-3 bg-card',
            it.tone === 'good' && 'border-[rgba(22,163,74,0.28)] bg-[rgba(22,163,74,0.06)]',
            it.tone === 'bad' && 'border-destructive/25 bg-destructive/5'
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {it.label}
          </p>
          <p
            className={cn(
              'mt-1 text-base font-extrabold tabular-nums',
              it.tone === 'good' && 'text-[#16a34a]',
              it.tone === 'bad' && 'text-destructive'
            )}
          >
            {it.value}
          </p>
          {it.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
};

// ─── Componente: Bloco de Insights do Motorista ─────────────────────────────
const MotoristaInsightsBlock: React.FC<{ kpis: any; charts: any; tables?: any; isLoading: boolean }> = ({ kpis, charts, tables, isLoading }) => {
  const insights = useMemo(() => {
    const receitaTotal = Number(kpis.receita_total) || 0;
    const kmTotal = Number(kpis.km_total) || 0;
    const rpmMedio = Number(kpis.rpm_medio) || 0;
    const taxaConclusao = Number(kpis.taxa_conclusao) || 0;
    const taxaCancel = Number(kpis.taxa_cancelamento) || 0;
    const viagens = Number(kpis.viagens_concluidas) || 0;
    const avgCycle = Number(kpis.avg_cycle_hours) || 0;
    const lucro = Number(kpis.lucro_liquido) || 0;

    const receitaMes = (charts?.receita_por_mes || []).map((m: any) => ({
      month: formatMonthLabelPtBR(m.mes),
      receita: Number(m.receita) || 0,
      viagens: Math.round(Number(m.viagens) || 0),
    }));

    const bw = pickBestWorstMonths(receitaMes);
    const primary: Insight[] = [];
    const optional: Insight[] = [];

    // ── Primary insights (priority order) ──
    if (bw?.best) {
      primary.push({ label: 'Melhor mês', value: `${bw.best.month} — ${formatBRL(bw.best.receita)}`, hint: `Viagens: ${bw.best.viagens}`, tone: 'good' });
    }
    if (bw && receitaMes.length >= 2 && bw.worst) {
      primary.push({ label: 'Pior mês', value: `${bw.worst.month} — ${formatBRL(bw.worst.receita)}`, hint: `Viagens: ${bw.worst.viagens}`, tone: 'bad' });
    }
    if (rpmMedio > 0) {
      primary.push({ label: 'R$/km', value: `R$ ${rpmMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, hint: 'Média no período', tone: 'neutral' });
    }
    if (taxaConclusao > 0) {
      const tone: Insight['tone'] = taxaConclusao >= 90 ? 'good' : taxaConclusao >= 70 ? 'neutral' : 'bad';
      primary.push({ label: 'Conclusão', value: `${taxaConclusao.toFixed(1)}%`, hint: `Cancel.: ${taxaCancel.toFixed(1)}%`, tone });
    }
    const topRotas = (charts?.top_rotas || []).map((r: any) => ({ rota: formatRouteLabel(r.rota || (r.origem && r.destino ? `${r.origem} → ${r.destino}` : '')), receita: Number(r.receita) || 0 })).sort((a: any, b: any) => b.receita - a.receita);
    if (topRotas.length) {
      primary.push({ label: 'Top rota', value: compactText(topRotas[0].rota, 20), hint: formatBRL(topRotas[0].receita), tone: 'good' });
    }
    if (receitaTotal > 0 && kmTotal > 0) {
      primary.push({ label: 'Receita/km', value: `R$ ${(receitaTotal / kmTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, hint: 'Receita total ÷ km', tone: 'neutral' });
    }

    // ── Optional insights (fill up to 6) ──
    // 1) Maior km
    const viagensMes = (charts?.viagens_por_mes || []).map((d: any) => ({ month: formatMonthLabelPtBR(d.mes), km: Number(d.km) || 0, viagens: Math.round(Number(d.viagens) || 0) }));
    if (viagensMes.length) {
      const bestKm = viagensMes.reduce((a: any, b: any) => (b.km > a.km ? b : a));
      if (bestKm.km > 0) optional.push({ label: 'Maior km', value: `${bestKm.month} — ${bestKm.km.toLocaleString('pt-BR')} km`, hint: `Viagens: ${bestKm.viagens}`, tone: 'neutral' });
    }
    // 2) Ticket médio
    if (receitaTotal > 0 && viagens > 0) {
      optional.push({ label: 'Ticket médio', value: `R$ ${(receitaTotal / viagens).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, hint: 'Receita ÷ viagens', tone: 'neutral' });
    }
    // 3) R$/hora
    if (receitaTotal > 0 && viagens > 0 && avgCycle > 0) {
      const rph = receitaTotal / (avgCycle * viagens);
      optional.push({ label: 'R$/hora', value: `R$ ${rph.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, hint: 'Estimado (ciclo médio)', tone: 'good' });
    }
    // 4) Margem
    if (receitaTotal > 0) {
      const margem = (lucro / receitaTotal) * 100;
      optional.push({ label: 'Margem', value: `${margem.toFixed(1)}%`, hint: 'Lucro ÷ receita', tone: margem >= 10 ? 'good' : margem >= 0 ? 'neutral' : 'bad' });
    }
    // 5) Melhor R$/km (rota)
    const topLucr = tables?.top_lucrativos?.[0];
    if (topLucr?.rs_km) {
      optional.push({ label: 'Melhor R$/km', value: `R$ ${Number(topLucr.rs_km).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`, hint: compactText(String(topLucr.rota || '—'), 20), tone: 'good' });
    }
    // 6) Data quality alert
    const pointsTotal = (charts?.receita_por_mes || []).length + (charts?.viagens_por_mes || []).length;
    if (pointsTotal > 0 && pointsTotal < 3) {
      optional.push({ label: 'Qualidade dos dados', value: 'Poucos registros', hint: 'Amplie o período para ver tendências', tone: 'bad' });
    }

    // Fill primary up to 6 with optionals (no duplicates by label)
    const usedLabels = new Set(primary.map((p) => p.label));
    for (const opt of optional) {
      if (primary.length >= 6) break;
      if (!usedLabels.has(opt.label)) {
        primary.push(opt);
        usedLabels.add(opt.label);
      }
    }

    return primary.slice(0, 6);
  }, [kpis, charts, tables]);

  if (!insights.length && !isLoading) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        Insights rápidos
      </p>
      <HighlightsGrid items={insights} isLoading={isLoading} />
    </div>
  );
};

// ─── Tipos: Slicers MOTORISTA ────────────────────────────────────────────────
type MotoristaSlicers = {
  status: string[];
  cargoTypes: string[];
  routes: string[];
  minKm?: number;
  maxKm?: number;
  minRevenue?: number;
  maxRevenue?: number;
  searchRoute?: string;
};

const EMPTY_SLICERS: MotoristaSlicers = {
  status: [], cargoTypes: [], routes: [],
  minKm: undefined, maxKm: undefined,
  minRevenue: undefined, maxRevenue: undefined,
  searchRoute: '',
};

// ─── Toggle chip ─────────────────────────────────────────────────────────────
const ToggleChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    type="button"
    className={cn(
      'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
      active
        ? 'bg-[rgba(22,163,74,0.15)] border-[rgba(22,163,74,0.3)] text-[#16a34a]'
        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
    )}
  >
    {children}
  </button>
);

// ─── Status label map ────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  DELIVERED: 'Concluído', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
  IN_TRANSIT: 'Em Trânsito', ACCEPTED: 'Aceito', OPEN: 'Aberto',
};

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
  const isProdutor = panel === 'PRODUTOR';

  const producerLegacy = useProducerReportData(isProdutor ? profileId : undefined, dateRange);
  const hasUnifiedProducerData = useMemo(() => {
    if (!isProdutor) return false;

    const hasKpiData = Object.values(kpis || {}).some((v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0;
    });

    const hasChartData = Object.values(charts || {}).some((v: any) => Array.isArray(v) && v.length > 0);
    const hasTableData = Object.values(tables || {}).some((v: any) => Array.isArray(v) && v.length > 0);

    return hasKpiData || hasChartData || hasTableData;
  }, [isProdutor, kpis, charts, tables]);

  const producerHistoryQuery = useQuery({
    queryKey: ['producer-history-fallback', profileId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!profileId) return [] as any[];
      const { data, error } = await supabase
        .from('freight_history')
        .select('status_final, completed_at, cancelled_at, created_at, distance_km, price_total, origin_city, destination_city')
        .eq('producer_id', profileId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: isProdutor && !!profileId,
    staleTime: 60 * 1000,
  });

  const producerHistoryRows = useMemo(() => {
    if (!isProdutor) return [] as any[];
    const fromTs = dateRange.from.getTime();
    const toTs = dateRange.to.getTime();
    return (producerHistoryQuery.data || []).filter((r: any) => {
      const dt = new Date(r.completed_at || r.cancelled_at || r.created_at).getTime();
      return Number.isFinite(dt) && dt >= fromTs && dt <= toTs;
    });
  }, [producerHistoryQuery.data, dateRange.from, dateRange.to, isProdutor]);

  const producerHistoryAgg = useMemo(() => {
    const rows = producerHistoryRows;
    const isDone = (s: string) => ['DELIVERED', 'COMPLETED'].includes(String(s || '').toUpperCase());
    const isCancelled = (s: string) => String(s || '').toUpperCase() === 'CANCELLED';

    let completed = 0;
    let cancelled = 0;
    let revenue = 0;
    let distance = 0;
    const statusMap = new Map<string, number>();
    const monthMap = new Map<string, number>();
    const dayMap = new Map<string, number>();

    for (const r of rows) {
      const status = String(r.status_final || '').toUpperCase();
      const dtRaw = r.completed_at || r.cancelled_at || r.created_at;
      const dt = new Date(dtRaw);
      if (!Number.isFinite(dt.getTime())) continue;

      statusMap.set(status || 'OUTROS', (statusMap.get(status || 'OUTROS') || 0) + 1);
      const monthKey = format(dt, 'yyyy-MM');
      const dayKey = format(dt, 'dd/MM');
      dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);

      if (isDone(status)) {
        const price = Number(r.price_total) || 0;
        const km = Number(r.distance_km) || 0;
        completed += 1;
        revenue += price;
        distance += km;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + price);
      } else if (isCancelled(status)) {
        cancelled += 1;
      }
    }

    const total = rows.length;
    const avgPrice = completed > 0 ? revenue / completed : 0;
    const avgDistance = completed > 0 ? distance / completed : 0;

    return {
      total,
      completed,
      cancelled,
      pending: 0,
      revenue,
      distance,
      avgPrice,
      avgDistance,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
      monthly: Array.from(monthMap.entries()).map(([month, total]) => ({ month, receita: total })),
      daily: Array.from(dayMap.entries()).map(([day, fretes]) => ({ day, fretes, servicos: 0 })),
      status: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [producerHistoryRows]);

  // ── Slicers state (MOTORISTA only) ────────────────────────────────────────
  const [slicers, setSlicers] = useState<MotoristaSlicers>(EMPTY_SLICERS);
  const resetSlicers = () => setSlicers(EMPTY_SLICERS);

  const toggleSlicer = (field: 'status' | 'cargoTypes' | 'routes', value: string) => {
    setSlicers((prev) => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  // ── Normalize extrato rows ────────────────────────────────────────────────
  const extratoRows = useMemo(() => {
    if (!isMotorista) return [];
    return (tables?.extrato_ganhos || []).map((r: any) => {
      const rota = r.rota || (r.origin_city && r.destination_city ? `${r.origin_city} → ${r.destination_city}` : '—');
      return {
        ...r,
        __rota: formatRouteLabel(rota),
        __status: String(r.status_final || r.status || '').toUpperCase(),
        __tipo: String(r.tipo || '').toLowerCase(),
        __km: Number(r.km) || 0,
        __receita: Number(r.receita) || 0,
      };
    });
  }, [tables?.extrato_ganhos, isMotorista]);

  // ── Slicer options ────────────────────────────────────────────────────────
  const slicerOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const cargoSet = new Set<string>();
    const routeSet = new Set<string>();
    for (const r of extratoRows) {
      if (r.__status) statusSet.add(r.__status);
      if (r.__tipo) cargoSet.add(r.__tipo);
      if (r.__rota && r.__rota !== '—') routeSet.add(r.__rota);
    }
    const kmVals = extratoRows.map((r: any) => r.__km).filter(Number.isFinite);
    const revVals = extratoRows.map((r: any) => r.__receita).filter(Number.isFinite);
    return {
      statuses: Array.from(statusSet).sort(),
      cargoTypes: Array.from(cargoSet).sort(),
      routes: Array.from(routeSet).sort(),
      kmMin: kmVals.length ? Math.min(...kmVals) : 0,
      kmMax: kmVals.length ? Math.max(...kmVals) : 0,
      revMin: revVals.length ? Math.min(...revVals) : 0,
      revMax: revVals.length ? Math.max(...revVals) : 0,
    };
  }, [extratoRows]);

  // ── Filter extrato rows ───────────────────────────────────────────────────
  const filteredExtratoRows = useMemo(() => {
    const { status, cargoTypes, routes, minKm, maxKm, minRevenue, maxRevenue, searchRoute } = slicers;
    const q = (searchRoute || '').trim().toLowerCase();
    return extratoRows.filter((r: any) => {
      if (status.length && !status.includes(r.__status)) return false;
      if (cargoTypes.length && !cargoTypes.includes(r.__tipo)) return false;
      if (routes.length && !routes.includes(r.__rota)) return false;
      if (q && !r.__rota.toLowerCase().includes(q)) return false;
      if (minKm != null && r.__km < minKm) return false;
      if (maxKm != null && r.__km > maxKm) return false;
      if (minRevenue != null && r.__receita < minRevenue) return false;
      if (maxRevenue != null && r.__receita > maxRevenue) return false;
      return true;
    });
  }, [extratoRows, slicers]);

  // ── Computed top/bottom from filtered rows ────────────────────────────────
  const computedTopBottom = useMemo(() => {
    const rows = filteredExtratoRows
      .filter((r: any) => r.__km > 0 && r.__receita > 0)
      .map((r: any) => ({ rota: r.__rota, km: r.__km, receita: r.__receita, rs_km: r.__receita / r.__km }));
    rows.sort((a, b) => b.rs_km - a.rs_km);
    return { top: rows.slice(0, 10), bottom: rows.slice(-10).reverse() };
  }, [filteredExtratoRows]);

  const activeFiltersCount =
    (slicers.status.length ? 1 : 0) + (slicers.cargoTypes.length ? 1 : 0) +
    (slicers.routes.length ? 1 : 0) + (slicers.minKm != null || slicers.maxKm != null ? 1 : 0) +
    (slicers.minRevenue != null || slicers.maxRevenue != null ? 1 : 0) +
    (slicers.searchRoute?.trim() ? 1 : 0);

  const hasSlicerFilters = activeFiltersCount > 0;

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

  // ── KPIs PRODUTOR ─────────────────────────────────────────────────────────
  const produtorHero = useMemo(() => {
    if (!isProdutor) return null;

    const legacySummary = !hasUnifiedProducerData ? producerLegacy.summary : null;
    const useHistoryFallback = !hasUnifiedProducerData && producerHistoryAgg.total > 0;

    const receitaTotal = Number(kpis.receita_total)
      || Number(legacySummary?.freights?.total_spent)
      || (useHistoryFallback ? producerHistoryAgg.revenue : 0);

    const fretesConcluidos = Number(kpis.fretes_concluidos || kpis.viagens_concluidas)
      || Number(legacySummary?.freights?.completed)
      || (useHistoryFallback ? producerHistoryAgg.completed : 0);

    const totalFretes = Number(kpis.total_fretes)
      || Number(legacySummary?.freights?.total)
      || (useHistoryFallback ? producerHistoryAgg.total : 0);

    const ticketMedio = Number(kpis.ticket_medio)
      || Number(legacySummary?.freights?.avg_price)
      || (useHistoryFallback ? producerHistoryAgg.avgPrice : 0);

    const taxaConclusao = Number(kpis.taxa_conclusao)
      || (totalFretes > 0 ? (fretesConcluidos / totalFretes) * 100 : 0)
      || (useHistoryFallback ? producerHistoryAgg.completionRate : 0);

    return {
      value: receitaTotal,
      subtitle: `${fretesConcluidos} fretes concluídos no período`,
      secondary: [
        { label: 'Ticket médio', value: formatBRL(ticketMedio) },
        { label: 'Taxa conclusão', value: `${taxaConclusao.toFixed(1)}%` },
        { label: 'Fretes concluídos', value: fmtNum(fretesConcluidos) },
        { label: 'Total fretes', value: fmtNum(totalFretes) },
      ],
    };
  }, [kpis, isProdutor, producerLegacy.summary, hasUnifiedProducerData, producerHistoryAgg]);

  const produtorOp = useMemo(() => {
    if (!isProdutor) return [];

    const legacySummary = !hasUnifiedProducerData ? producerLegacy.summary : null;
    const useHistoryFallback = !hasUnifiedProducerData && producerHistoryAgg.total > 0;

    const totalFretes = Number(kpis.total_fretes) || Number(legacySummary?.freights?.total) || (useHistoryFallback ? producerHistoryAgg.total : 0);
    const fretesConcluidos = Number(kpis.fretes_concluidos || kpis.viagens_concluidas) || Number(legacySummary?.freights?.completed) || (useHistoryFallback ? producerHistoryAgg.completed : 0);
    const fretesAbertos = Number(kpis.fretes_abertos) || Number(legacySummary?.freights?.pending) || 0;
    const taxaCancel = Number(kpis.taxa_cancelamento) || (totalFretes > 0 ? ((Number(legacySummary?.freights?.cancelled) || (useHistoryFallback ? producerHistoryAgg.cancelled : 0)) / totalFretes) * 100 : 0);
    const avgKm = Number(kpis.km_medio || kpis.distancia_media_km) || Number(legacySummary?.freights?.avg_distance_km) || (useHistoryFallback ? producerHistoryAgg.avgDistance : 0);
    const avaliacao = Number(kpis.avaliacao_media) || 0;
    const rsPorKm = Number(kpis.rs_por_km)
      || (legacySummary?.freights?.total_distance_km ? (Number(legacySummary?.freights?.total_spent) || 0) / Number(legacySummary?.freights?.total_distance_km) : 0)
      || (useHistoryFallback && producerHistoryAgg.distance > 0 ? producerHistoryAgg.revenue / producerHistoryAgg.distance : 0);

    return [
      { label: 'Concluídos', value: fmtNum(fretesConcluidos), icon: CheckCircle, highlight: true },
      { label: 'Abertos', value: fmtNum(fretesAbertos), icon: Package },
      { label: 'Km médio', value: avgKm > 0 ? `${fmtNum(avgKm, 1)} km` : '—', icon: MapPin },
      { label: 'R$/km', value: rsPorKm > 0 ? `R$ ${fmtNum(rsPorKm, 2)}` : '—', icon: TrendingUp, highlight: true },
      { label: 'Cancelamento', value: `${taxaCancel.toFixed(1)}%`, icon: XCircle },
      { label: 'Avaliação', value: avaliacao > 0 ? `${fmtNum(avaliacao, 1)} ★` : '—', icon: Star },
    ] satisfies OpKPI[];
  }, [kpis, isProdutor, producerLegacy.summary, hasUnifiedProducerData, producerHistoryAgg]);

  // ── Gráficos PRODUTOR ──────────────────────────────────────────────────────
  const produtorCharts: ChartConfig[] = useMemo(() => {
    if (!isProdutor) return [];

    const configs: ChartConfig[] = [];
    const legacyCharts = !hasUnifiedProducerData ? producerLegacy.charts : null;
    const useHistoryFallback = !hasUnifiedProducerData
      && producerHistoryAgg.total > 0;

    if (charts?.receita_por_mes?.length) {
      configs.push({
        title: 'Receita por mês',
        type: 'area',
        data: charts.receita_por_mes.map((m: any) => ({ month: formatMonthLabelPtBR(m.mes), receita: Number(m.receita) || 0 })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: 'hsl(var(--chart-1))' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    } else if (legacyCharts?.spending_by_month?.length) {
      configs.push({
        title: 'Receita por mês',
        type: 'area',
        data: legacyCharts.spending_by_month.map((m: any) => ({
          month: formatMonthLabelPtBR(m.month),
          receita: (Number(m.freight_spending) || 0) + (Number(m.service_spending) || 0),
        })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: 'hsl(var(--chart-1))' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    } else if (useHistoryFallback && producerHistoryAgg.monthly.length) {
      configs.push({
        title: 'Receita por mês',
        type: 'area',
        data: producerHistoryAgg.monthly.map((m: any) => ({ month: formatMonthLabelPtBR(m.month), receita: Number(m.receita) || 0 })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: 'hsl(var(--chart-1))' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    }

    if (charts?.volume_por_dia?.length) {
      configs.push({
        title: 'Operações por dia',
        type: 'bar',
        data: charts.volume_por_dia.map((d: any) => ({ day: d.dia, fretes: d.fretes || 0, servicos: d.servicos || 0 })),
        dataKeys: [
          { key: 'fretes', label: 'Fretes', color: 'hsl(var(--chart-1))' },
          { key: 'servicos', label: 'Serviços', color: 'hsl(var(--chart-2))' },
        ],
        xAxisKey: 'day',
      });
    } else if (useHistoryFallback && producerHistoryAgg.daily.length) {
      configs.push({
        title: 'Operações por dia',
        type: 'bar',
        data: producerHistoryAgg.daily,
        dataKeys: [
          { key: 'fretes', label: 'Fretes', color: 'hsl(var(--chart-1))' },
          { key: 'servicos', label: 'Serviços', color: 'hsl(var(--chart-2))' },
        ],
        xAxisKey: 'day',
      });
    }

    if (charts?.por_status?.length) {
      configs.push({ title: 'Por status', type: 'pie', data: charts.por_status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    } else if (legacyCharts?.by_status?.length) {
      configs.push({ title: 'Por status', type: 'pie', data: legacyCharts.by_status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    } else if (useHistoryFallback && producerHistoryAgg.status.length) {
      configs.push({ title: 'Por status', type: 'pie', data: producerHistoryAgg.status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    }

    return configs;
  }, [charts, isProdutor, producerLegacy.charts, producerLegacy.summary, hasUnifiedProducerData, producerHistoryAgg]);

  // ── Gráficos genéricos (fallback) ──────────────────────────────────────────
  const genericCharts: ChartConfig[] = useMemo(() => {
    if (isMotorista || isTransportadora || isPrestador || isProdutor || !charts) return [];
    const configs: ChartConfig[] = [];
    if (charts.receita_por_mes?.length) configs.push({ title: 'Receita por mês', type: 'bar', data: charts.receita_por_mes.map((m: any) => ({ month: formatMonthLabelPtBR(m.mes), revenue: m.receita })), dataKeys: [{ key: 'revenue', label: 'Receita' }], xAxisKey: 'month', valueFormatter: formatBRL });
    if (charts.por_status?.length) configs.push({ title: 'Por status', type: 'pie', data: charts.por_status, dataKeys: [{ key: 'value', label: 'Quantidade' }] });
    return configs;
  }, [charts, isMotorista, isTransportadora, isPrestador, isProdutor]);

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

            {/* Insights rápidos (PowerBI-like) — acima dos gráficos */}
            <MotoristaInsightsBlock kpis={kpis} charts={charts} tables={tables} isLoading={isLoading} />

            <ReportCharts charts={motoristaCharts} isLoading={isLoading} columns={2} />
          </div>

          {/* ── PowerBI Slicers ──────────────────────────────────────── */}
          {!isLoading && extratoRows.length > 0 && (
            <div className="space-y-3">
              <SectionTitle icon={Filter} title="Filtros analíticos" subtitle="Slicers PowerBI — filtre extrato e lucratividade" />
              <div className="rounded-2xl border bg-card p-4 space-y-4">
                {/* Header: count + clear */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{filteredExtratoRows.length}</span>
                    {' de '}
                    <span className="font-semibold text-foreground">{extratoRows.length}</span>
                    {' registros'}
                    {hasSlicerFilters && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(22,163,74,0.1)] text-[#16a34a] text-[10px] font-semibold">
                        <Filter className="h-2.5 w-2.5" /> {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => setSlicers((p) => ({ ...p, status: ['COMPLETED', 'DELIVERED'] }))}
                    >
                      <CheckCircle className="h-3 w-3" /> Concluídos
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => setSlicers((p) => ({ ...p, status: ['CANCELLED'] }))}
                    >
                      <XCircle className="h-3 w-3" /> Cancelados
                    </Button>
                    {hasSlicerFilters && (
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-destructive" onClick={resetSlicers}>
                        <X className="h-3 w-3" /> Limpar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status chips */}
                  {slicerOptions.statuses.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {slicerOptions.statuses.map((s) => (
                          <ToggleChip key={s} active={slicers.status.includes(s)} onClick={() => toggleSlicer('status', s)}>
                            {STATUS_LABELS[s] || s}
                          </ToggleChip>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cargo type chips */}
                  {slicerOptions.cargoTypes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tipo de carga</p>
                      <div className="flex flex-wrap gap-1.5">
                        {slicerOptions.cargoTypes.slice(0, 8).map((t) => (
                          <ToggleChip key={t} active={slicers.cargoTypes.includes(t)} onClick={() => toggleSlicer('cargoTypes', t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </ToggleChip>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Route search + chips */}
                  {slicerOptions.routes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rota</p>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          className="h-7 text-[11px] pl-7"
                          placeholder="Buscar rota..."
                          value={slicers.searchRoute || ''}
                          onChange={(e) => setSlicers((p) => ({ ...p, searchRoute: e.target.value }))}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {slicerOptions.routes
                          .filter((r) => !slicers.searchRoute?.trim() || r.toLowerCase().includes(slicers.searchRoute.trim().toLowerCase()))
                          .slice(0, 10)
                          .map((r) => (
                            <ToggleChip key={r} active={slicers.routes.includes(r)} onClick={() => toggleSlicer('routes', r)}>
                              {compactText(r, 25)}
                            </ToggleChip>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Range: km + receita */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Faixa de Km <span className="font-normal">({fmtNum(slicerOptions.kmMin)}–{fmtNum(slicerOptions.kmMax)})</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" className="h-7 text-[11px] w-24" placeholder="Mín"
                          value={slicers.minKm ?? ''} onChange={(e) => setSlicers((p) => ({ ...p, minKm: e.target.value ? Number(e.target.value) : undefined }))}
                        />
                        <span className="text-muted-foreground text-[10px]">—</span>
                        <Input
                          type="number" className="h-7 text-[11px] w-24" placeholder="Máx"
                          value={slicers.maxKm ?? ''} onChange={(e) => setSlicers((p) => ({ ...p, maxKm: e.target.value ? Number(e.target.value) : undefined }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Faixa de Receita <span className="font-normal">({formatBRL(slicerOptions.revMin)}–{formatBRL(slicerOptions.revMax)})</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" className="h-7 text-[11px] w-24" placeholder="Mín"
                          value={slicers.minRevenue ?? ''} onChange={(e) => setSlicers((p) => ({ ...p, minRevenue: e.target.value ? Number(e.target.value) : undefined }))}
                        />
                        <span className="text-muted-foreground text-[10px]">—</span>
                        <Input
                          type="number" className="h-7 text-[11px] w-24" placeholder="Máx"
                          value={slicers.maxRevenue ?? ''} onChange={(e) => setSlicers((p) => ({ ...p, maxRevenue: e.target.value ? Number(e.target.value) : undefined }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Extrato */}
          {!isLoading && extratoRows.length > 0 && (
            <div className="space-y-3">
              <SectionTitle icon={DollarSign} title="Extrato de ganhos" subtitle="Histórico detalhado por viagem" />
              {filteredExtratoRows.length > 0 ? (
                <ExtratoTable data={filteredExtratoRows} />
              ) : (
                <Card className="rounded-2xl p-6 flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">Nenhum registro com esses filtros</p>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={resetSlicers}>
                    <X className="h-3 w-3" /> Limpar filtros
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Top/Bottom lucrativos (computed from filtered rows when slicers active) */}
          {!isLoading && (hasSlicerFilters ? (computedTopBottom.top.length > 0 || computedTopBottom.bottom.length > 0) : (tables?.top_lucrativos?.length > 0 || tables?.bottom_lucrativos?.length > 0)) && (
            <div className="space-y-3">
              <SectionTitle icon={TrendingUp} title="Fretes por lucratividade" subtitle="R$/km — melhores e piores" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(hasSlicerFilters ? computedTopBottom.top : tables?.top_lucrativos || []).length > 0 && (
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
                          {(hasSlicerFilters ? computedTopBottom.top : tables?.top_lucrativos || []).map((r: any, i: number) => (
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
                {(hasSlicerFilters ? computedTopBottom.bottom : tables?.bottom_lucrativos || []).length > 0 && (
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
                          {(hasSlicerFilters ? computedTopBottom.bottom : tables?.bottom_lucrativos || []).map((r: any, i: number) => (
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

      {/* ── PRODUTOR ─────────────────────────────────────────────────── */}
      {isProdutor && produtorHero && (
        <>
          <HeroFinanceBlock
            label="Receita do período"
            value={produtorHero.value}
            subtitle={produtorHero.subtitle}
            secondary={produtorHero.secondary}
            isLoading={isLoading}
          />

          <div className="space-y-3">
            <SectionTitle icon={Activity} title="Operacional" subtitle="Volume, qualidade e eficiência" />
            <OperationalGrid items={produtorOp} isLoading={isLoading} />
          </div>

          <div className="space-y-3">
            <SectionTitle icon={BarChart3} title="Análise gráfica" subtitle="Receita e distribuição operacional" />
            {produtorCharts.length > 0 ? (
              <ReportCharts charts={produtorCharts} isLoading={isLoading} columns={2} />
            ) : isLoading ? (
              <ReportCharts charts={[]} isLoading={true} columns={2} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {['Receita por mês', 'Operações por dia', 'Por status'].map((t) => (
                  <Card key={t} className="rounded-2xl">
                    <CardHeader><CardTitle className="text-base">{t}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                        Sem dados para exibir
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Outros painéis (fallback) ─────────────────────────────────── */}
      {!isMotorista && !isTransportadora && !isPrestador && !isProdutor && (
        <ReportCharts charts={genericCharts} isLoading={isLoading} columns={2} />
      )}

      {/* ── Aviso sem dados ────────────────────────────────────────────── */}
      {!isLoading && (isMotorista || isTransportadora || isPrestador || isProdutor) &&
        Number(kpis.receita_total || produtorHero?.value || 0) === 0 &&
        Number(kpis.servicos_concluidos || kpis.viagens_concluidas || kpis.fretes_concluidos || 0) === 0 &&
        (!isProdutor || producerHistoryAgg.total === 0) && (
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
