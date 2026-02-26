/**
 * DriverEnterprise.tsx
 *
 * Enterprise PowerBI components for MOTORISTA panel — Control Tower level.
 * All state/logic derived locally with useMemo. No backend/hook changes.
 */
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, BarChart3, Activity, Star, Timer, Search, X,
  Filter, AlertTriangle, TrendingUp, CheckCircle, MapPin, Percent,
  Zap, XCircle, Truck, Route, Package, ArrowUpRight, ArrowDownRight,
  Target, Fuel,
} from 'lucide-react';
import { format, isValid, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BI } from './reports-enterprise-theme';
import { ReportCharts, formatBRL, type ChartConfig, type Drilldown } from '@/components/reports';
import { formatRouteLabel, formatMonthLabelPtBR } from '@/lib/reports-formatters';

// ═══════════════════════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════════════════════
const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const compactText = (s: string, max = 20) => (s.length > max ? `${s.slice(0, max)}…` : s);

function normRoute(s: string) { return (s || '').replace(/\s*→\s*/g, ' → ').trim(); }

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
export type DriverSlicers = {
  status: string[];
  cargoTypes: string[];
  routeQuery: string;
  minKm?: number; maxKm?: number;
  minRevenue?: number; maxRevenue?: number;
  minRpm?: number; maxRpm?: number;
  onlyBadRpm: boolean;
  onlyCancelled: boolean;
};

export const EMPTY_DRIVER_SLICERS: DriverSlicers = {
  status: [], cargoTypes: [], routeQuery: '',
  minKm: undefined, maxKm: undefined,
  minRevenue: undefined, maxRevenue: undefined,
  minRpm: undefined, maxRpm: undefined,
  onlyBadRpm: false, onlyCancelled: false,
};

interface DriverRow {
  [key: string]: any;
  __date: Date | null;
  __route: string;
  __cargo: string;
  __status: string;
  __km: number;
  __receita: number;
  __despesa: number;
  __lucro: number;
  __rpm: number;
  __lpkm: number;
}

const STATUS_LABELS: Record<string, string> = {
  DELIVERED: 'Concluído', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
  IN_TRANSIT: 'Em Trânsito', ACCEPTED: 'Aceito', OPEN: 'Aberto',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Row normalization — tries tables first, then charts (RPC may not return tables)
// ═══════════════════════════════════════════════════════════════════════════════
export function normalizeDriverRows(tables: any, charts: any): DriverRow[] {
  // Priority: tables.extrato_ganhos > tables.extrato_fretes_motorista > charts.dispersao_receita_km > charts.top_rotas (expanded)
  let src = (tables?.extrato_ganhos || tables?.extrato_fretes_motorista || []) as any[];

  // Fallback to charts data when tables are empty
  if (!src.length && charts) {
    // dispersao_receita_km has per-trip granularity
    if (Array.isArray(charts.dispersao_receita_km) && charts.dispersao_receita_km.length > 0) {
      src = charts.dispersao_receita_km;
    }
    // Expand top_rotas into individual "virtual" rows (1 per viagem) when no per-trip data exists
    else if (Array.isArray(charts.top_rotas) && charts.top_rotas.length > 0) {
      src = [];
      for (const route of charts.top_rotas) {
        const viagens = Number(route.viagens) || 1;
        const receitaPerTrip = (Number(route.receita) || 0) / viagens;
        const kmPerTrip = Number(route.km_medio) || 0;
        for (let i = 0; i < viagens; i++) {
          src.push({
            rota: route.rota,
            receita: receitaPerTrip,
            km: kmPerTrip,
            cargo: route.cargo || route.tipo || '',
            status_final: 'DELIVERED',
          });
        }
      }
    }
  }

  return src.map((r: any) => {
    const km = Number(r.km || r.distance_km || 0) || 0;
    const receita = Number(r.receita || r.valor || r.revenue || 0) || 0;
    const despesa = Number(r.despesa || r.expense || 0) || 0;
    const lucro = receita - despesa;
    const rpm = km > 0 ? receita / km : 0;
    const lpkm = km > 0 ? lucro / km : 0;
    const routeRaw = r.rota || (r.origin_city && r.destination_city ? `${r.origin_city} → ${r.destination_city}` : '');
    const date = r.data ? new Date(r.data) : (r.created_at ? new Date(r.created_at) : null);
    return {
      ...r,
      __date: date && isValid(date) ? date : null,
      __route: formatRouteLabel(normRoute(routeRaw)) || '—',
      __cargo: String(r.tipo || r.cargo_type || r.cargo || '').toLowerCase(),
      __status: String(r.status_final || r.status || '').toUpperCase(),
      __km: km,
      __receita: receita,
      __despesa: despesa,
      __lucro: lucro,
      __rpm: rpm,
      __lpkm: lpkm,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Filter logic
// ═══════════════════════════════════════════════════════════════════════════════
export function filterDriverRows(rows: DriverRow[], slicers: DriverSlicers, rpmTarget: number): DriverRow[] {
  let out = rows;
  if (slicers.status.length) out = out.filter(r => slicers.status.includes(r.__status));
  if (slicers.cargoTypes.length) out = out.filter(r => slicers.cargoTypes.includes(r.__cargo));
  if (slicers.routeQuery.trim()) {
    const q = slicers.routeQuery.trim().toLowerCase();
    out = out.filter(r => r.__route.toLowerCase().includes(q));
  }
  if (slicers.minKm != null) out = out.filter(r => r.__km >= slicers.minKm!);
  if (slicers.maxKm != null) out = out.filter(r => r.__km <= slicers.maxKm!);
  if (slicers.minRevenue != null) out = out.filter(r => r.__receita >= slicers.minRevenue!);
  if (slicers.maxRevenue != null) out = out.filter(r => r.__receita <= slicers.maxRevenue!);
  if (slicers.minRpm != null) out = out.filter(r => r.__rpm >= slicers.minRpm!);
  if (slicers.maxRpm != null) out = out.filter(r => r.__rpm <= slicers.maxRpm!);
  if (slicers.onlyBadRpm) out = out.filter(r => r.__rpm > 0 && r.__rpm < rpmTarget);
  if (slicers.onlyCancelled) out = out.filter(r => r.__status === 'CANCELLED');
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Aggregator helpers
// ═══════════════════════════════════════════════════════════════════════════════
function groupSum(rows: DriverRow[], keyGetter: (r: DriverRow) => string, valueGetter: (r: DriverRow) => number) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyGetter(r) || '—';
    map.set(k, (map.get(k) || 0) + (valueGetter(r) || 0));
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function groupCount(rows: DriverRow[], keyGetter: (r: DriverRow) => string) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyGetter(r) || '—';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function groupAvg(rows: DriverRow[], keyGetter: (r: DriverRow) => string, valueGetter: (r: DriverRow) => number) {
  const map = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const k = keyGetter(r) || '—';
    const cur = map.get(k) || { sum: 0, count: 0 };
    const val = valueGetter(r);
    if (val > 0) { cur.sum += val; cur.count += 1; }
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([name, { sum, count }]) => ({ name, value: count > 0 ? sum / count : 0 }));
}

function pickGranularity(from: Date, to: Date) {
  const diff = differenceInDays(to, from);
  return diff <= 31 ? 'day' : 'month';
}

function formatKeyDay(d: Date) { return format(d, 'dd/MM', { locale: ptBR }); }
function formatKeyMonth(d: Date) { return formatMonthLabelPtBR(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }

function buildTimeSeries(rows: DriverRow[], from: Date, to: Date) {
  const gran = pickGranularity(from, to);
  const keyFn = gran === 'day' ? formatKeyDay : formatKeyMonth;
  const map = new Map<string, { key: string; receita: number; lucro: number; km: number; count: number; sortKey: string }>();
  for (const r of rows) {
    if (!r.__date) continue;
    const k = keyFn(r.__date);
    const sortKey = r.__date.toISOString().slice(0, gran === 'day' ? 10 : 7);
    const cur = map.get(k) || { key: k, receita: 0, lucro: 0, km: 0, count: 0, sortKey };
    cur.receita += r.__receita;
    cur.lucro += r.__lucro;
    cur.km += r.__km;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ToggleChip
// ═══════════════════════════════════════════════════════════════════════════════
const ToggleChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} type="button" className={cn(
    'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
    active
      ? 'bg-[rgba(22,163,74,0.15)] border-[rgba(22,163,74,0.3)] text-[#16a34a]'
      : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
  )}>
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// StatusBadge
// ═══════════════════════════════════════════════════════════════════════════════
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = String(status).toUpperCase();
  const map: Record<string, { label: string; cls: string }> = {
    DELIVERED: { label: 'Concluído', cls: 'bg-[hsl(142,71%,45%)]/12 text-[hsl(142,71%,45%)]' },
    COMPLETED: { label: 'Concluído', cls: 'bg-[hsl(142,71%,45%)]/12 text-[hsl(142,71%,45%)]' },
    CANCELLED: { label: 'Cancelado', cls: 'bg-destructive/10 text-destructive' },
    IN_TRANSIT: { label: 'Em Trânsito', cls: 'bg-blue-500/10 text-blue-500' },
    ACCEPTED: { label: 'Aceito', cls: 'bg-amber-500/10 text-amber-500' },
    OPEN: { label: 'Aberto', cls: 'bg-muted text-muted-foreground' },
  };
  const cfg = map[s] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide', cfg.cls)}>{cfg.label}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SectionTitle
// ═══════════════════════════════════════════════════════════════════════════════
const SectionTitle: React.FC<{ icon: React.ElementType; title: string; subtitle?: string; actions?: React.ReactNode }> = ({ icon: Icon, title, subtitle, actions }) => (
  <div className="flex items-center justify-between gap-2 pt-1">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
      <div>
        <h3 className={BI.sectionTitle}>{title}</h3>
        {subtitle && <p className={BI.sectionSub}>{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-1.5">{actions}</div>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// BI Header mini stats for chart cards
// ═══════════════════════════════════════════════════════════════════════════════
const BiChartHeader: React.FC<{ total: number; avg: number; max: number; delta?: number | null; formatter?: (v: number) => string }> = ({ total, avg, max, delta, formatter = fmtNum }) => (
  <div className="flex items-center gap-3 flex-wrap px-1 pb-2">
    <span className="text-[10px] text-muted-foreground">Total: <span className="font-bold text-foreground">{formatter(total)}</span></span>
    <span className="text-[10px] text-muted-foreground">Média: <span className="font-bold text-foreground">{formatter(avg)}</span></span>
    <span className="text-[10px] text-muted-foreground">Máx: <span className="font-bold text-foreground">{formatter(max)}</span></span>
    {delta != null && delta !== 0 && (
      <span className={cn('text-[10px] font-semibold flex items-center gap-0.5', delta >= 0 ? BI.good : 'text-destructive')}>
        {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        Δ {Math.abs(delta).toFixed(1)}%
      </span>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Smart Alert card
// ═══════════════════════════════════════════════════════════════════════════════
type AlertItem = { icon: string; label: string; value: string; hint?: string; tone: 'good' | 'neutral' | 'bad'; onClick?: () => void };

const SmartAlertCard: React.FC<{ alert: AlertItem }> = ({ alert }) => (
  <button
    type="button"
    onClick={alert.onClick}
    className={cn(
      BI.radius, BI.cardSoft, 'p-3 text-left w-full transition-all duration-200',
      alert.onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-md',
      !alert.onClick && 'cursor-default',
      alert.tone === 'bad' && BI.badBg,
      alert.tone === 'good' && BI.goodBg,
      alert.tone === 'neutral' && 'bg-amber-400/5 border-amber-400/15',
    )}
  >
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-sm leading-none">{alert.icon}</span>
      <p className={BI.label}>{alert.label}</p>
    </div>
    <p className={cn(
      'text-base font-extrabold tabular-nums',
      alert.tone === 'bad' && BI.bad,
      alert.tone === 'good' && BI.good,
      alert.tone === 'neutral' && BI.warn,
    )}>{alert.value}</p>
    {alert.hint && <p className={cn(BI.sub, 'mt-0.5')}>{alert.hint}</p>}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Virtualized Driver Table
// ═══════════════════════════════════════════════════════════════════════════════
const VirtualizedDriverTable: React.FC<{ rows: DriverRow[] }> = ({ rows }) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 15,
  });

  useEffect(() => { parentRef.current?.scrollTo({ top: 0 }); }, [rows]);

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          const isEven = virtualRow.index % 2 === 0;
          return (
            <div
              key={virtualRow.index}
              className="absolute left-0 w-full"
              style={{ top: 0, transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
            >
              <div className={cn(
                'flex items-center h-full text-xs',
                BI.tableRow, BI.tableRowHover,
                isEven && BI.tableRowEven,
              )}>
                <div className="flex-none w-[70px] px-3 text-muted-foreground whitespace-nowrap tabular-nums">
                  {row.__date && isValid(row.__date) ? format(row.__date, 'dd/MM/yy', { locale: ptBR }) : '—'}
                </div>
                <div className="flex-1 min-w-0 px-3 truncate">{row.__route}</div>
                <div className="flex-none w-[70px] px-3 text-muted-foreground hidden sm:block truncate">
                  {row.__cargo ? row.__cargo.charAt(0).toUpperCase() + row.__cargo.slice(1) : '—'}
                </div>
                <div className="flex-none w-[55px] px-3 text-right tabular-nums hidden sm:block">
                  {row.__km > 0 ? fmtNum(row.__km) : '—'}
                </div>
                <div className={cn('flex-none w-[80px] px-3 text-right font-semibold whitespace-nowrap tabular-nums', BI.good)}>
                  {row.__receita > 0 ? formatBRL(row.__receita) : '—'}
                </div>
                <div className="flex-none w-[80px] px-3 text-right tabular-nums hidden md:block">
                  {row.__despesa > 0 ? formatBRL(row.__despesa) : '—'}
                </div>
                <div className={cn('flex-none w-[80px] px-3 text-right font-semibold tabular-nums hidden md:block', row.__lucro >= 0 ? BI.good : BI.bad)}>
                  {row.__receita > 0 ? formatBRL(row.__lucro) : '—'}
                </div>
                <div className="flex-none w-[60px] px-3 text-right tabular-nums hidden lg:block">
                  {row.__rpm > 0 ? `R$ ${fmtNum(row.__rpm, 2)}` : '—'}
                </div>
                <div className="flex-none w-[80px] px-3 text-center">
                  <StatusBadge status={row.__status} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
interface DriverEnterpriseProps {
  kpis: any;
  charts: any;
  tables: any;
  dateRange: { from: Date; to: Date };
  isLoading: boolean;
}

export const DriverEnterprise: React.FC<DriverEnterpriseProps> = ({
  kpis, charts, tables, dateRange, isLoading,
}) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [slicers, setSlicers] = useState<DriverSlicers>(EMPTY_DRIVER_SLICERS);
  const [rpmTarget, setRpmTarget] = useState<number>(3.5);
  const resetSlicers = useCallback(() => setSlicers(EMPTY_DRIVER_SLICERS), []);

  const toggleSlicer = useCallback((field: 'status' | 'cargoTypes', value: string) => {
    setSlicers(prev => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  }, []);

  // ── 1. Normalize rows ──────────────────────────────────────────────────────
  const driverRows = useMemo(() => normalizeDriverRows(tables, charts), [tables, charts]);

  // ── 2. Filter rows ────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => filterDriverRows(driverRows, slicers, rpmTarget), [driverRows, slicers, rpmTarget]);

  // ── Slicer options ────────────────────────────────────────────────────────
  const slicerOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const cargoSet = new Set<string>();
    for (const r of driverRows) {
      if (r.__status) statusSet.add(r.__status);
      if (r.__cargo && r.__cargo !== '') cargoSet.add(r.__cargo);
    }
    const kmVals = driverRows.map(r => r.__km).filter(Number.isFinite);
    const revVals = driverRows.map(r => r.__receita).filter(Number.isFinite);
    const rpmVals = driverRows.filter(r => r.__rpm > 0).map(r => r.__rpm);
    return {
      statuses: Array.from(statusSet).sort(),
      cargoTypes: Array.from(cargoSet).sort(),
      kmMin: kmVals.length ? Math.min(...kmVals) : 0,
      kmMax: kmVals.length ? Math.max(...kmVals) : 0,
      revMin: revVals.length ? Math.min(...revVals) : 0,
      revMax: revVals.length ? Math.max(...revVals) : 0,
      rpmMin: rpmVals.length ? Math.min(...rpmVals) : 0,
      rpmMax: rpmVals.length ? Math.max(...rpmVals) : 0,
    };
  }, [driverRows]);

  const hasFilters = useMemo(() => {
    const s = slicers;
    return s.status.length > 0 || s.cargoTypes.length > 0 || s.routeQuery.trim() !== '' ||
      s.minKm != null || s.maxKm != null || s.minRevenue != null || s.maxRevenue != null ||
      s.minRpm != null || s.maxRpm != null || s.onlyBadRpm || s.onlyCancelled;
  }, [slicers]);

  const activeFiltersCount = useMemo(() => {
    const s = slicers;
    let c = 0;
    if (s.status.length) c++;
    if (s.cargoTypes.length) c++;
    if (s.routeQuery.trim()) c++;
    if (s.minKm != null || s.maxKm != null) c++;
    if (s.minRevenue != null || s.maxRevenue != null) c++;
    if (s.minRpm != null || s.maxRpm != null) c++;
    if (s.onlyBadRpm) c++;
    if (s.onlyCancelled) c++;
    return c;
  }, [slicers]);

  // ── 3. Hero P&L (2x4) ─────────────────────────────────────────────────────
  const hero = useMemo(() => {
    const receitaTotal = Number(kpis.receita_total) || filteredRows.reduce((s, r) => s + r.__receita, 0);
    const despesasTotal = Number(kpis.despesas_total) || filteredRows.reduce((s, r) => s + r.__despesa, 0);
    const lucroLiquido = Number(kpis.lucro_liquido) || (receitaTotal - despesasTotal);
    const ticketMedio = Number(kpis.ticket_medio) || (filteredRows.length > 0 ? receitaTotal / filteredRows.length : 0);
    const rpmMedio = Number(kpis.rpm_medio) || (() => {
      const withKm = filteredRows.filter(r => r.__rpm > 0);
      return withKm.length > 0 ? withKm.reduce((s, r) => s + r.__rpm, 0) / withKm.length : 0;
    })();
    const kmTotal = Number(kpis.km_total) || filteredRows.reduce((s, r) => s + r.__km, 0);
    const viagens = Number(kpis.viagens_concluidas) || filteredRows.filter(r => ['DELIVERED', 'COMPLETED'].includes(r.__status)).length;
    const totalViagens = filteredRows.length || Number(kpis.total_fretes) || 0;
    const taxaConclusao = Number(kpis.taxa_conclusao) || (totalViagens > 0 ? (viagens / totalViagens) * 100 : 0);
    const avaliacao = Number(kpis.avaliacao_media) || 0;
    const trend = receitaTotal > 0 ? { value: (lucroLiquido / receitaTotal) * 100, isPositive: lucroLiquido >= 0 } : undefined;

    return {
      receitaTotal, lucroLiquido, despesasTotal, ticketMedio, rpmMedio, kmTotal, viagens, taxaConclusao, avaliacao, trend,
    };
  }, [kpis, filteredRows]);

  // ── 4. Smart Alerts (6+) ──────────────────────────────────────────────────
  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];
    const withRpm = filteredRows.filter(r => r.__rpm > 0);
    const badRpmCount = withRpm.filter(r => r.__rpm < rpmTarget).length;
    const badRpmPct = withRpm.length > 0 ? (badRpmCount / withRpm.length) * 100 : 0;

    // 1. R$/km baixo
    items.push({
      icon: '⚠️', label: 'R$/km abaixo da meta',
      value: `${fmtPct(badRpmPct)} (${badRpmCount}/${withRpm.length})`,
      hint: `Meta: R$ ${fmtNum(rpmTarget, 2)}/km`,
      tone: badRpmPct > 40 ? 'bad' : badRpmPct > 20 ? 'neutral' : 'good',
      onClick: badRpmCount > 0 ? () => setSlicers(s => ({ ...EMPTY_DRIVER_SLICERS, onlyBadRpm: true })) : undefined,
    });

    // 2. Pior rota por R$/km
    const routeRpm = groupAvg(filteredRows.filter(r => r.__rpm > 0), r => r.__route, r => r.__rpm).filter(x => x.name !== '—');
    const worstRoute = routeRpm.sort((a, b) => a.value - b.value)[0];
    if (worstRoute) {
      items.push({
        icon: '📉', label: 'Pior rota (R$/km)',
        value: `R$ ${fmtNum(worstRoute.value, 2)}/km`,
        hint: compactText(worstRoute.name, 22),
        tone: worstRoute.value < rpmTarget ? 'bad' : 'neutral',
        onClick: () => setSlicers(s => ({ ...EMPTY_DRIVER_SLICERS, routeQuery: worstRoute.name })),
      });
    }

    // 3. Cancelamento
    const cancelados = filteredRows.filter(r => r.__status === 'CANCELLED').length;
    const cancelPct = filteredRows.length > 0 ? (cancelados / filteredRows.length) * 100 : 0;
    items.push({
      icon: '🔴', label: 'Cancelamentos',
      value: `${fmtNum(cancelados)} (${fmtPct(cancelPct)})`,
      tone: cancelPct >= 10 ? 'bad' : cancelPct > 0 ? 'neutral' : 'good',
      onClick: cancelados > 0 ? () => setSlicers(s => ({ ...EMPTY_DRIVER_SLICERS, onlyCancelled: true })) : undefined,
    });

    // 4. Concentração alta (top rota > 60% receita)
    const routeRevenue = groupSum(filteredRows, r => r.__route, r => r.__receita).sort((a, b) => b.value - a.value);
    const totalRev = routeRevenue.reduce((s, x) => s + x.value, 0);
    const topRoute = routeRevenue[0];
    if (topRoute && totalRev > 0) {
      const topPct = (topRoute.value / totalRev) * 100;
      items.push({
        icon: topPct >= 60 ? '🟠' : '✅', label: 'Concentração top rota',
        value: `${fmtPct(topPct)}`,
        hint: compactText(topRoute.name, 22),
        tone: topPct >= 60 ? 'neutral' : 'good',
        onClick: () => setSlicers(s => ({ ...EMPTY_DRIVER_SLICERS, routeQuery: topRoute.name })),
      });
    }

    // 5. Outlier: muito km + baixo ticket
    const highKmLowTicket = filteredRows.filter(r => {
      const medianKm = hero.kmTotal / (filteredRows.length || 1);
      const medianRev = hero.receitaTotal / (filteredRows.length || 1);
      return r.__km > medianKm * 1.5 && r.__receita < medianRev * 0.5;
    }).length;
    items.push({
      icon: highKmLowTicket > 0 ? '⚡' : '✅', label: 'Outliers (km↑ ticket↓)',
      value: fmtNum(highKmLowTicket),
      tone: highKmLowTicket > 2 ? 'bad' : highKmLowTicket > 0 ? 'neutral' : 'good',
      onClick: highKmLowTicket > 0 ? () => {
        const medianKm = hero.kmTotal / (filteredRows.length || 1);
        const medianRev = hero.receitaTotal / (filteredRows.length || 1);
        setSlicers(s => ({ ...EMPTY_DRIVER_SLICERS, minKm: Math.round(medianKm * 1.5), maxRevenue: Math.round(medianRev * 0.5) }));
      } : undefined,
    });

    // 6. Margem líquida
    const margem = hero.receitaTotal > 0 ? (hero.lucroLiquido / hero.receitaTotal) * 100 : 0;
    items.push({
      icon: margem >= 15 ? '✅' : margem >= 0 ? '🟡' : '🔴', label: 'Margem líquida',
      value: fmtPct(margem),
      tone: margem >= 15 ? 'good' : margem >= 0 ? 'neutral' : 'bad',
    });

    return items;
  }, [filteredRows, rpmTarget, hero]);

  // ── 5. Drilldown ──────────────────────────────────────────────────────────
  const applyDrilldown = useCallback((d: Drilldown) => {
    if (d.kind === 'route') {
      setSlicers(() => ({ ...EMPTY_DRIVER_SLICERS, routeQuery: d.value }));
    } else if (d.kind === 'cargo') {
      setSlicers(() => ({ ...EMPTY_DRIVER_SLICERS, cargoTypes: [String(d.value).toLowerCase()] }));
    } else if (d.kind === 'status') {
      setSlicers(() => ({ ...EMPTY_DRIVER_SLICERS, status: [String(d.value).toUpperCase()] }));
    } else {
      // rpmBin or other: parse numbers from value
      const match = d.value.match(/(\d+(?:\.\d+)?)/g);
      if (match && d.value.includes('R$')) {
        const min = Number(match[0]);
        const max = match[1] ? Number(match[1]) : undefined;
        setSlicers(() => ({ ...EMPTY_DRIVER_SLICERS, minRpm: min, maxRpm: max }));
      }
    }
  }, []);

  // ── 6. Trend charts (3) — use RPC charts data directly when available ────
  const trendCharts: ChartConfig[] = useMemo(() => {
    const configs: ChartConfig[] = [];

    // Prefer RPC pre-aggregated monthly data
    const receitaMes = Array.isArray(charts?.receita_por_mes) ? charts.receita_por_mes : [];
    const viagensMes = Array.isArray(charts?.viagens_por_mes) ? charts.viagens_por_mes : [];

    if (receitaMes.length >= 1) {
      configs.push({
        title: 'Receita por período', type: receitaMes.length >= 2 ? 'area' : 'bar',
        data: receitaMes.map((x: any) => ({ period: formatMonthLabelPtBR(x.mes) || x.mes, receita: Number(x.receita) || 0 })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: '#16a34a' }],
        xAxisKey: 'period', valueFormatter: formatBRL,
      });
    }

    // Lucro trend from row-level data (if available)
    const series = buildTimeSeries(filteredRows, dateRange.from, dateRange.to);
    if (series.length >= 2) {
      configs.push({
        title: 'Lucro por período', type: 'area',
        data: series.map(x => ({ period: x.key, lucro: x.lucro })),
        dataKeys: [{ key: 'lucro', label: 'Lucro', color: '#2563eb' }],
        xAxisKey: 'period', valueFormatter: formatBRL,
      });
    }

    if (viagensMes.length >= 1) {
      configs.push({
        title: 'Km e viagens por período', type: 'bar',
        data: viagensMes.map((x: any) => ({
          period: formatMonthLabelPtBR(x.mes) || x.mes,
          km: Number(x.km) || 0,
          viagens: Number(x.viagens) || 0,
        })),
        dataKeys: [
          { key: 'km', label: 'Km', color: 'hsl(var(--chart-4))' },
          { key: 'viagens', label: 'Viagens', color: 'hsl(var(--chart-2))' },
        ],
        xAxisKey: 'period', yAxisAllowDecimals: false,
      });
    }

    return configs;
  }, [filteredRows, dateRange, charts]);

  // ── Trend BI headers ─────────────────────────────────────────────────────
  const trendHeaders = useMemo(() => {
    const receitaMes = Array.isArray(charts?.receita_por_mes) ? charts.receita_por_mes : [];
    const rev = receitaMes.map((x: any) => Number(x.receita) || 0);
    const totalRev = rev.reduce((s: number, v: number) => s + v, 0);
    const avgRev = rev.length > 0 ? totalRev / rev.length : 0;
    const maxRev = rev.length > 0 ? Math.max(...rev) : 0;
    return { totalRev, avgRev, maxRev };
  }, [charts]);

  // ── 7. Driver charts (PowerBI) — use RPC charts.top_rotas directly ────────
  const driverCharts: ChartConfig[] = useMemo(() => {
    const configs: ChartConfig[] = [];

    // Use RPC top_rotas for route-level charts
    const rpcRoutes = Array.isArray(charts?.top_rotas) ? charts.top_rotas : [];

    // Top rotas por receita (from RPC)
    const topRoutes = rpcRoutes
      .map((r: any) => ({ name: formatRouteLabel(r.rota) || r.rota, value: Number(r.receita) || 0 }))
      .filter((x: any) => x.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 10);
    if (topRoutes.length) {
      configs.push({
        title: 'Top rotas por receita', type: 'horizontal-bar',
        data: topRoutes, dataKeys: [{ key: 'value', label: 'Receita', color: '#16a34a' }],
        xAxisKey: 'name', valueFormatter: formatBRL, height: 320,
        onDrilldown: applyDrilldown, drilldownKind: 'route',
      });
    }

    // Top rotas por R$/km (from RPC)
    const routeRpm = rpcRoutes
      .filter((r: any) => Number(r.km_medio) > 0 && Number(r.receita) > 0)
      .map((r: any) => {
        const viagens = Number(r.viagens) || 1;
        const receitaPerTrip = Number(r.receita) / viagens;
        const km = Number(r.km_medio);
        return { name: formatRouteLabel(r.rota) || r.rota, value: Number((receitaPerTrip / km).toFixed(2)) };
      })
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 10);
    if (routeRpm.length) {
      configs.push({
        title: 'Top rotas por R$/km', type: 'horizontal-bar',
        data: routeRpm, dataKeys: [{ key: 'value', label: 'R$/km', color: '#FF9800' }],
        xAxisKey: 'name',
        valueFormatter: (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        height: 320, onDrilldown: applyDrilldown, drilldownKind: 'route',
      });
    }

    // Fallback: use filteredRows for cargo/status if available
    const byCargo = groupSum(filteredRows, r => r.__cargo || '—', r => r.__receita)
      .sort((a, b) => b.value - a.value).map(x => ({ name: x.name.charAt(0).toUpperCase() + x.name.slice(1), value: x.value }));
    if (byCargo.length > 1) {
      configs.push({
        title: 'Receita por tipo de carga', type: 'pie',
        data: byCargo, dataKeys: [{ key: 'value', label: 'Receita' }],
        onDrilldown: applyDrilldown, drilldownKind: 'cargo',
      });
    }

    // Status das viagens
    const byStatus = groupCount(filteredRows, r => r.__status)
      .sort((a, b) => b.value - a.value).map(x => ({ name: STATUS_LABELS[x.name] || x.name, value: x.value }));
    if (byStatus.length) {
      configs.push({
        title: 'Status das viagens', type: 'pie',
        data: byStatus, dataKeys: [{ key: 'value', label: 'Quantidade' }],
        onDrilldown: applyDrilldown, drilldownKind: 'status',
      });
    }

    // Scatter Receita vs Km
    const scatterData = filteredRows.filter(r => r.__km > 0 && r.__receita > 0);
    if (scatterData.length >= 10) {
      configs.push({
        title: 'Receita vs Km', type: 'scatter',
        data: scatterData.map(r => ({ km: r.__km, receita: r.__receita, name: r.__route })),
        dataKeys: [{ key: 'receita', label: 'Receita', color: 'hsl(var(--chart-5))' }],
        xAxisKey: 'km', yAxisKey: 'receita', valueFormatter: formatBRL,
        onDrilldown: applyDrilldown, drilldownKind: 'route',
      });
    }

    return configs;
  }, [filteredRows, applyDrilldown, charts]);

  // ── 8. Efficiency: R$/km bins + outliers ──────────────────────────────────
  const efficiencyCharts: ChartConfig[] = useMemo(() => {
    const withRpm = filteredRows.filter(r => r.__rpm > 0);
    if (withRpm.length < 3) return [];
    const configs: ChartConfig[] = [];

    const bins = [
      { label: '0–1', min: 0, max: 1 },
      { label: '1–2', min: 1, max: 2 },
      { label: '2–3', min: 2, max: 3 },
      { label: '3–4', min: 3, max: 4 },
      { label: '4+', min: 4, max: Infinity },
    ];
    const binData = bins.map(b => ({
      name: `R$ ${b.label}/km`,
      value: withRpm.filter(r => r.__rpm >= b.min && r.__rpm < b.max).length,
    })).filter(b => b.value > 0);

    if (binData.length > 1) {
      configs.push({
        title: 'Distribuição R$/km', type: 'bar',
        data: binData, dataKeys: [{ key: 'value', label: 'Viagens', color: '#FF9800' }],
        xAxisKey: 'name', yAxisAllowDecimals: false,
        onDrilldown: applyDrilldown, drilldownKind: 'rpmBin' as any,
      });
    }

    // R$/km tendência
    const series = buildTimeSeries(filteredRows, dateRange.from, dateRange.to);
    const rpmSeries = series.filter(x => x.km > 0).map(x => ({
      period: x.key, rs_km: x.receita / x.km,
    }));
    if (rpmSeries.length >= 2) {
      configs.push({
        title: 'R$/km tendência', type: 'line',
        data: rpmSeries,
        dataKeys: [{ key: 'rs_km', label: 'R$/km', color: '#FF9800' }],
        xAxisKey: 'period',
        valueFormatter: (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
    }

    return configs;
  }, [filteredRows, dateRange, applyDrilldown]);

  // ── Top/Bottom R$/km ──────────────────────────────────────────────────────
  const topBottom = useMemo(() => {
    const rows = filteredRows.filter(r => r.__km > 0 && r.__receita > 0)
      .map(r => ({ rota: r.__route, km: r.__km, receita: r.__receita, rs_km: r.__rpm, status: r.__status }));
    rows.sort((a, b) => b.rs_km - a.rs_km);
    return { top: rows.slice(0, 10), bottom: [...rows].sort((a, b) => a.rs_km - b.rs_km).slice(0, 10) };
  }, [filteredRows]);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 rounded-2xl" />
        <div className={cn('grid grid-cols-2 sm:grid-cols-4', BI.gridGap)}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ═══ 1. Hero Financeiro P&L ═══════════════════════════════════════════ */}
      <div className={cn(BI.radius, 'bg-[hsl(142,71%,45%)]/6 border border-[hsl(142,71%,45%)]/15 p-4 sm:p-5')}>
        <p className={cn(BI.label, BI.good, 'mb-1')}>Faturamento bruto</p>
        <div className="flex items-end gap-3 mb-0.5">
          <span className={cn(BI.valueLg, 'text-foreground')}>{formatBRL(hero.receitaTotal)}</span>
          {hero.trend && hero.trend.value !== 0 && (
            <span className={cn(
              'flex items-center gap-0.5 text-sm font-semibold mb-1',
              hero.trend.isPositive ? BI.good : 'text-destructive'
            )}>
              {hero.trend.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {Math.abs(hero.trend.value).toFixed(1)}% margem
            </span>
          )}
        </div>
        <p className={cn(BI.sub, 'mb-3')}>Control Tower · Motorista</p>

        {/* 2x4 KPI Grid */}
        <div className={cn('grid grid-cols-2 sm:grid-cols-4', BI.gridGap)}>
          {[
            { label: 'Lucro líquido', value: formatBRL(hero.lucroLiquido), icon: DollarSign, highlight: hero.lucroLiquido > 0, tone: hero.lucroLiquido >= 0 ? 'good' : 'bad' },
            { label: 'Despesas', value: formatBRL(hero.despesasTotal), icon: Fuel },
            { label: 'Ticket médio', value: formatBRL(hero.ticketMedio), icon: Package },
            { label: 'R$/km médio', value: hero.rpmMedio > 0 ? `R$ ${fmtNum(hero.rpmMedio, 2)}` : '—', icon: TrendingUp, highlight: hero.rpmMedio >= rpmTarget, tone: hero.rpmMedio >= rpmTarget ? 'good' : 'neutral' },
            { label: 'Km total', value: `${fmtNum(hero.kmTotal)} km`, icon: MapPin },
            { label: 'Viagens concluídas', value: fmtNum(hero.viagens), icon: Truck, highlight: true },
            { label: 'Conclusão', value: fmtPct(hero.taxaConclusao), icon: CheckCircle, highlight: hero.taxaConclusao >= 90, tone: hero.taxaConclusao >= 90 ? 'good' : hero.taxaConclusao >= 70 ? 'neutral' : 'bad' },
            { label: 'Avaliação', value: hero.avaliacao > 0 ? `${fmtNum(hero.avaliacao, 1)} ★` : '—', icon: Star },
          ].map((item, i) => {
            const Icon = item.icon;
            const isGood = (item as any).tone === 'good';
            const isBad = (item as any).tone === 'bad';
            return (
              <div key={i} className={cn(BI.radius, BI.cardGlass, 'px-3 py-2', item.highlight && 'ring-1 ring-[hsl(142,71%,45%)]/20')}>
                <div className="flex items-center justify-between mb-0.5">
                  <p className={BI.label}>{item.label}</p>
                  <Icon className={cn('h-3 w-3 flex-shrink-0', isGood ? BI.good : isBad ? BI.bad : 'text-muted-foreground/50')} />
                </div>
                <p className={cn('text-sm font-bold tabular-nums', isGood && BI.good, isBad && BI.bad)}>{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 2. Smart Alerts ══════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionTitle icon={AlertTriangle} title="Alertas inteligentes" subtitle="Clique para aplicar filtro" actions={
          <div className="flex items-center gap-2">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Meta R$/km:</span>
            <Input
              type="number" step="0.5" min="0" max="20"
              className="h-6 w-16 text-[11px] px-2"
              value={rpmTarget}
              onChange={e => setRpmTarget(Number(e.target.value) || 0)}
            />
          </div>
        } />
        <div className={cn('grid grid-cols-2 sm:grid-cols-3', BI.gridGap)}>
          {alerts.map((a, i) => <SmartAlertCard key={i} alert={a} />)}
        </div>
      </div>

      {/* ═══ 3. PowerBI Slicers ══════════════════════════════════════════════ */}
      {driverRows.length > 0 && (
        <div className="space-y-3">
          <SectionTitle icon={Filter} title="Filtros analíticos" subtitle="Slicers PowerBI — filtre tudo" />
          <div className={cn(BI.radius, 'border bg-card p-4 space-y-4')}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredRows.length}</span>
                {' de '}
                <span className="font-semibold text-foreground">{driverRows.length}</span>
                {' registros'}
                {hasFilters && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(22,163,74,0.1)] text-[#16a34a] text-[10px] font-semibold">
                    <Filter className="h-2.5 w-2.5" /> {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                  onClick={() => setSlicers(s => ({ ...s, status: ['COMPLETED', 'DELIVERED'] }))}>
                  <CheckCircle className="h-3 w-3" /> Concluídos
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                  onClick={() => setSlicers(s => ({ ...s, onlyCancelled: true }))}>
                  <XCircle className="h-3 w-3" /> Cancelados
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1"
                  onClick={() => setSlicers(s => ({ ...s, onlyBadRpm: true }))}>
                  <TrendingUp className="h-3 w-3" /> R$/km baixo
                </Button>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-destructive" onClick={resetSlicers}>
                    <X className="h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status */}
              {slicerOptions.statuses.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {slicerOptions.statuses.map(s => (
                      <ToggleChip key={s} active={slicers.status.includes(s)} onClick={() => toggleSlicer('status', s)}>
                        {STATUS_LABELS[s] || s}
                      </ToggleChip>
                    ))}
                  </div>
                </div>
              )}

              {/* Cargo */}
              {slicerOptions.cargoTypes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tipo de carga</p>
                  <div className="flex flex-wrap gap-1.5">
                    {slicerOptions.cargoTypes.slice(0, 10).map(t => (
                      <ToggleChip key={t} active={slicers.cargoTypes.includes(t)} onClick={() => toggleSlicer('cargoTypes', t)}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </ToggleChip>
                    ))}
                  </div>
                </div>
              )}

              {/* Route search */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Buscar rota</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    className="h-7 text-[11px] pl-7"
                    placeholder="Ex: São Paulo → Campinas"
                    value={slicers.routeQuery}
                    onChange={e => setSlicers(s => ({ ...s, routeQuery: e.target.value }))}
                  />
                </div>
              </div>

              {/* Range: km, receita, R$/km */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Faixa Km <span className="font-normal">({fmtNum(slicerOptions.kmMin)}–{fmtNum(slicerOptions.kmMax)})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="h-7 text-[11px] w-24" placeholder="Mín"
                      value={slicers.minKm ?? ''} onChange={e => setSlicers(s => ({ ...s, minKm: e.target.value ? Number(e.target.value) : undefined }))} />
                    <span className="text-muted-foreground text-[10px]">—</span>
                    <Input type="number" className="h-7 text-[11px] w-24" placeholder="Máx"
                      value={slicers.maxKm ?? ''} onChange={e => setSlicers(s => ({ ...s, maxKm: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Faixa Receita <span className="font-normal">({formatBRL(slicerOptions.revMin)}–{formatBRL(slicerOptions.revMax)})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="h-7 text-[11px] w-24" placeholder="Mín"
                      value={slicers.minRevenue ?? ''} onChange={e => setSlicers(s => ({ ...s, minRevenue: e.target.value ? Number(e.target.value) : undefined }))} />
                    <span className="text-muted-foreground text-[10px]">—</span>
                    <Input type="number" className="h-7 text-[11px] w-24" placeholder="Máx"
                      value={slicers.maxRevenue ?? ''} onChange={e => setSlicers(s => ({ ...s, maxRevenue: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Faixa R$/km <span className="font-normal">({fmtNum(slicerOptions.rpmMin, 2)}–{fmtNum(slicerOptions.rpmMax, 2)})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Input type="number" step="0.5" className="h-7 text-[11px] w-24" placeholder="Mín"
                      value={slicers.minRpm ?? ''} onChange={e => setSlicers(s => ({ ...s, minRpm: e.target.value ? Number(e.target.value) : undefined }))} />
                    <span className="text-muted-foreground text-[10px]">—</span>
                    <Input type="number" step="0.5" className="h-7 text-[11px] w-24" placeholder="Máx"
                      value={slicers.maxRpm ?? ''} onChange={e => setSlicers(s => ({ ...s, maxRpm: e.target.value ? Number(e.target.value) : undefined }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 4. Tendências (3 charts) ════════════════════════════════════════ */}
      {trendCharts.length > 0 && (
        <div className="space-y-2">
          <SectionTitle icon={TrendingUp} title="Tendências" subtitle={`Granularidade: ${pickGranularity(dateRange.from, dateRange.to) === 'day' ? 'diária' : 'mensal'}`} />
          <BiChartHeader total={trendHeaders.totalRev} avg={trendHeaders.avgRev} max={trendHeaders.maxRev} formatter={formatBRL} />
          <ReportCharts charts={trendCharts} isLoading={false} columns={2} />
        </div>
      )}

      {/* ═══ 5. Drivers (PowerBI) ════════════════════════════════════════════ */}
      {driverCharts.length > 0 && (
        <div className="space-y-2">
          <SectionTitle icon={Route} title="Drivers de receita" subtitle="Clique em uma barra para filtrar" />
          <ReportCharts charts={driverCharts} isLoading={false} columns={2} />
        </div>
      )}

      {/* ═══ 6. Eficiência (bins + outliers) ═════════════════════════════════ */}
      {efficiencyCharts.length > 0 && (
        <div className="space-y-2">
          <SectionTitle icon={Zap} title="Eficiência R$/km" subtitle="Distribuição e tendência" />
          <ReportCharts charts={efficiencyCharts} isLoading={false} columns={2} />
        </div>
      )}

      {/* ═══ 7. Top/Bottom R$/km ═════════════════════════════════════════════ */}
      {(topBottom.top.length > 0 || topBottom.bottom.length > 0) && (
        <div className="space-y-2">
          <SectionTitle icon={TrendingUp} title="Fretes por lucratividade" subtitle="R$/km — melhores e piores" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topBottom.top.length > 0 && (
              <Card className={cn(BI.radius, 'overflow-hidden')}>
                <div className="px-4 py-3 border-b bg-[rgba(22,163,74,0.05)]">
                  <p className="text-xs font-semibold text-[#16a34a]">🏆 Top 10 mais lucrativos</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className={BI.tableHeader}>
                      <tr>
                        <th className={cn(BI.tableHeaderCell, 'text-left')}>Rota</th>
                        <th className={cn(BI.tableHeaderCell, 'text-right')}>Km</th>
                        <th className={cn(BI.tableHeaderCell, 'text-right')}>Receita</th>
                        <th className={cn(BI.tableHeaderCell, 'text-right')}>R$/km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBottom.top.map((r, i) => (
                        <tr key={i} className={cn(BI.tableRow, BI.tableRowHover, i % 2 === 0 && BI.tableRowEven, 'cursor-pointer')}
                          onClick={() => applyDrilldown({ kind: 'route', value: r.rota })}>
                          <td className={cn(BI.tableCell, 'max-w-[120px] truncate')}>{r.rota}</td>
                          <td className={BI.tableCellNum}>{fmtNum(r.km)}</td>
                          <td className={cn(BI.tableCellNum, 'font-medium')}>{formatBRL(r.receita)}</td>
                          <td className={cn(BI.tableCellNum, BI.good, 'font-bold')}>{fmtNum(r.rs_km, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {topBottom.bottom.length > 0 && (
              <Card className={cn(BI.radius, 'overflow-hidden')}>
                <div className="px-4 py-3 border-b bg-destructive/5">
                  <p className="text-xs font-semibold text-destructive">⚠️ Top 10 menos lucrativos</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className={BI.tableHeader}>
                      <tr>
                        <th className={cn(BI.tableHeaderCell, 'text-left')}>Rota</th>
                        <th className={cn(BI.tableHeaderCell, 'text-right')}>Km</th>
                        <th className={cn(BI.tableHeaderCell, 'text-right')}>Receita</th>
                        <th className={cn(BI.tableHeaderCell, 'text-right')}>R$/km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBottom.bottom.map((r, i) => (
                        <tr key={i} className={cn(BI.tableRow, BI.tableRowHover, i % 2 === 0 && BI.tableRowEven, 'cursor-pointer')}
                          onClick={() => applyDrilldown({ kind: 'route', value: r.rota })}>
                          <td className={cn(BI.tableCell, 'max-w-[120px] truncate')}>{r.rota}</td>
                          <td className={BI.tableCellNum}>{fmtNum(r.km)}</td>
                          <td className={cn(BI.tableCellNum, 'font-medium')}>{formatBRL(r.receita)}</td>
                          <td className={cn(BI.tableCellNum, BI.bad, 'font-bold')}>{fmtNum(r.rs_km, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ═══ 8. Extrato BI virtualizado ══════════════════════════════════════ */}
      <div className="space-y-2">
        <SectionTitle icon={DollarSign} title="Extrato BI" subtitle="Detalhamento completo por viagem" />
        {filteredRows.length > 0 ? (
          <Card className={cn(BI.radius, BI.card, 'overflow-hidden')}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-muted/10">
              <p className={BI.sub}>
                Mostrando <span className="font-semibold text-foreground">{filteredRows.length}</span> de <span className="font-semibold text-foreground">{driverRows.length}</span> registros
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className={BI.tableHeader}>
                  <tr>
                    <th className={cn(BI.tableHeaderCell, 'text-left w-[70px]')}>Data</th>
                    <th className={cn(BI.tableHeaderCell, 'text-left')}>Rota</th>
                    <th className={cn(BI.tableHeaderCell, 'text-left hidden sm:table-cell w-[70px]')}>Tipo</th>
                    <th className={cn(BI.tableHeaderCell, 'text-right hidden sm:table-cell w-[55px]')}>Km</th>
                    <th className={cn(BI.tableHeaderCell, 'text-right w-[80px]')}>Receita</th>
                    <th className={cn(BI.tableHeaderCell, 'text-right hidden md:table-cell w-[80px]')}>Despesa</th>
                    <th className={cn(BI.tableHeaderCell, 'text-right hidden md:table-cell w-[80px]')}>Lucro</th>
                    <th className={cn(BI.tableHeaderCell, 'text-right hidden lg:table-cell w-[60px]')}>R$/km</th>
                    <th className={cn(BI.tableHeaderCell, 'text-center w-[80px]')}>Status</th>
                  </tr>
                </thead>
              </table>
              <VirtualizedDriverTable rows={filteredRows} />
            </div>
          </Card>
        ) : driverRows.length > 0 ? (
          <Card className={cn(BI.radius, 'p-6 flex flex-col items-center gap-2')}>
            <Filter className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">Nenhum registro com esses filtros</p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs mt-1" onClick={resetSlicers}>
              <X className="h-3 w-3" /> Limpar filtros
            </Button>
          </Card>
        ) : (
          <Card className={cn(BI.radius, 'p-8 flex flex-col items-center gap-3')}>
            <Package className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-base font-semibold">Nenhum frete no período</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Amplie o período de análise para ver dados.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
