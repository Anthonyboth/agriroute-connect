import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, AreaChart, Area, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, Activity } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// Hook: useIsMobile
// ═══════════════════════════════════════════════════════════════════════════════
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);
  return isMobile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Paleta fixa
// ═══════════════════════════════════════════════════════════════════════════════
const CHART_COLORS = [
  '#16a34a', '#2563eb', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ef4444', '#ec4899', '#84cc16',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Label map PT-BR
// ═══════════════════════════════════════════════════════════════════════════════
const LABEL_MAP: Record<string, string> = {
  'adubo_fertilizante': 'Adubo/Fertilizante',
  'graos': 'Grãos', 'gado': 'Gado', 'gado_vivo': 'Gado Vivo',
  'aves': 'Aves', 'suinos': 'Suínos', 'leite': 'Leite',
  'frutas': 'Frutas', 'legumes': 'Legumes', 'cana': 'Cana-de-Açúcar',
  'soja': 'Soja', 'milho': 'Milho', 'algodao': 'Algodão',
  'cafe': 'Café', 'madeira': 'Madeira', 'maquinario': 'Maquinário',
  'equipamentos': 'Equipamentos', 'insumos': 'Insumos', 'outros': 'Outros',
  'OPEN': 'Aberto', 'ACCEPTED': 'Aceito', 'IN_TRANSIT': 'Em Trânsito',
  'DELIVERED': 'Entregue', 'CANCELLED': 'Cancelado', 'PENDING': 'Pendente',
  'COMPLETED': 'Concluído',
  'jan': 'Jan', 'fev': 'Fev', 'mar': 'Mar', 'abr': 'Abr',
  'mai': 'Mai', 'jun': 'Jun', 'jul': 'Jul', 'ago': 'Ago',
  'set': 'Set', 'out': 'Out', 'nov': 'Nov', 'dez': 'Dez',
};

const formatChartLabel = (label: string): string => {
  if (!label) return '';
  const lower = label.toLowerCase();
  if (LABEL_MAP[lower]) return LABEL_MAP[lower];
  if (LABEL_MAP[label]) return LABEL_MAP[label];
  return label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
};

const compactTick = (v: any, max = 14): string => {
  const s = formatChartLabel(String(v ?? ''));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const formatCompactNumber = (n: number): string => {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return n.toLocaleString('pt-BR');
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

// ═══════════════════════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════════════════════
interface ChartDataPoint {
  name?: string;
  [key: string]: unknown;
}

interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'horizontal-bar' | 'scatter' | 'area';
  data: ChartDataPoint[];
  dataKeys: { key: string; label: string; color?: string }[];
  xAxisKey?: string;
  yAxisKey?: string;
  zAxisKey?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

interface ReportChartsProps {
  charts: ChartConfig[];
  isLoading?: boolean;
  columns?: 1 | 2;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// computeDomain — escala dinâmica para eixos
// ═══════════════════════════════════════════════════════════════════════════════
function computeDomain(values: number[]): [number, number] {
  const clean = values.filter(v => Number.isFinite(v));
  if (!clean.length) return [0, 1];
  const max = Math.max(...clean);
  if (max <= 0) return [0, 1];
  return [0, max * 1.18];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUG FIX: getPrimaryKey — scatter usa yAxisKey, outros usam dataKeys[0].key
// ═══════════════════════════════════════════════════════════════════════════════
function getPrimaryKey(config: ChartConfig): string | undefined {
  if (config.type === 'scatter') return config.yAxisKey || config.dataKeys?.[0]?.key;
  return config.dataKeys?.[0]?.key;
}

// ═══════════════════════════════════════════════════════════════════════════════
// computeMiniKpi — PowerBI header (corrigido)
// ═══════════════════════════════════════════════════════════════════════════════
type MiniKpi = {
  primaryValue: number;
  maxValue: number;
  avgValue: number;
  deltaPct: number | null;
  points: number;
  insight: { label: string; variant: 'up' | 'down' | 'neutral' | 'warn' };
};

function computeMiniKpi(config: ChartConfig): MiniKpi | null {
  const dk = getPrimaryKey(config);
  if (!dk) return null;

  if (config.type === 'pie') {
    const values = (config.data || []).map((d: any) => Number(d?.[dk])).filter(v => Number.isFinite(v));
    if (!values.length) return null;
    const total = values.reduce((a, b) => a + b, 0);
    return {
      primaryValue: total, maxValue: Math.max(...values), avgValue: total / values.length,
      deltaPct: null, points: values.length,
      insight: { label: 'Distribuição', variant: 'neutral' },
    };
  }

  if (config.type === 'scatter') {
    const yKey = config.yAxisKey || dk;
    const yVals = (config.data || []).map((d: any) => Number(d?.[yKey])).filter(v => Number.isFinite(v));
    const xKey = config.xAxisKey || 'km';
    const xVals = (config.data || []).map((d: any) => Number(d?.[xKey])).filter(v => Number.isFinite(v));
    const avgY = yVals.length ? yVals.reduce((a, b) => a + b, 0) / yVals.length : 0;
    const avgX = xVals.length ? xVals.reduce((a, b) => a + b, 0) / xVals.length : 0;
    const rpk = avgX > 0 ? avgY / avgX : 0;
    return {
      primaryValue: avgY, maxValue: Math.max(...yVals, 0),
      avgValue: avgY, deltaPct: null, points: config.data.length,
      insight: { label: rpk > 0 ? `R$/km: ${rpk.toFixed(2)}` : `${config.data.length} pontos`, variant: 'neutral' },
    };
  }

  const values = (config.data || []).map((d: any) => Number(d?.[dk])).filter(v => Number.isFinite(v));
  if (!values.length) return null;

  const maxValue = Math.max(...values);
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
  const isAccum = dk === 'acumulado' || /acumulad/i.test(config.title);
  const primaryValue = isAccum ? values[values.length - 1] : values.reduce((a, b) => a + b, 0);

  const first = values[0];
  const last = values[values.length - 1];
  const deltaPct = values.length >= 2 && Math.abs(first) > 0
    ? ((last - first) / Math.abs(first)) * 100
    : null;

  let insight: MiniKpi['insight'];
  if (deltaPct === null) {
    insight = { label: values.length === 1 ? '1 registro' : 'Sem base', variant: 'warn' };
  } else if (deltaPct > 5) {
    insight = { label: 'Alta', variant: 'up' };
  } else if (deltaPct < -5) {
    insight = { label: 'Queda', variant: 'down' };
  } else {
    insight = { label: 'Estável', variant: 'neutral' };
  }

  return { primaryValue, maxValue, avgValue, deltaPct, points: values.length, insight };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PowerBIHeader — clean, dense, no clutter
// ═══════════════════════════════════════════════════════════════════════════════
const PowerBIHeader: React.FC<{ kpi: MiniKpi; fmt: (v: number) => string }> = ({ kpi, fmt }) => (
  <div className="px-1 pb-2 pt-0.5 space-y-0.5">
    {/* Line 1: primary value + delta/badge */}
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-extrabold text-foreground tabular-nums leading-tight">
        {fmt(kpi.primaryValue)}
      </span>
      {kpi.deltaPct != null ? (
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums',
          kpi.deltaPct > 0 && 'text-emerald-400',
          kpi.deltaPct < 0 && 'text-red-400',
          kpi.deltaPct === 0 && 'text-muted-foreground',
        )}>
          {kpi.deltaPct > 0 ? <ArrowUpRight className="h-3 w-3" /> : kpi.deltaPct < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {kpi.deltaPct >= 0 ? '+' : ''}{kpi.deltaPct.toFixed(1)}%
        </span>
      ) : (
        <span className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold',
          kpi.insight.variant === 'up' && 'bg-emerald-950/30 text-emerald-400',
          kpi.insight.variant === 'down' && 'bg-red-950/30 text-red-400',
          kpi.insight.variant === 'neutral' && 'bg-blue-950/20 text-blue-400',
          kpi.insight.variant === 'warn' && 'bg-amber-950/20 text-amber-400',
        )}>
          {kpi.insight.variant === 'up' && <TrendingUp className="h-2.5 w-2.5" />}
          {kpi.insight.variant === 'down' && <TrendingDown className="h-2.5 w-2.5" />}
          {kpi.insight.variant === 'neutral' && <Activity className="h-2.5 w-2.5" />}
          {kpi.insight.label}
        </span>
      )}
    </div>
    {/* Line 2: max · avg */}
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
      <span>Máx {fmt(kpi.maxValue)}</span>
      <span className="opacity-30">·</span>
      <span>Média {fmt(kpi.avgValue)}</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TrendSummaryCard — line/area with < 3 points
// ═══════════════════════════════════════════════════════════════════════════════
const TrendSummaryCard: React.FC<{ config: ChartConfig; fmt: (v: number) => string }> = ({ config, fmt }) => {
  const dk = getPrimaryKey(config);
  const values = dk ? config.data.map(d => Number(d[dk])).filter(v => Number.isFinite(v)) : [];
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const hasTwo = values.length === 2;
  const delta = hasTwo && Math.abs(first) > 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const label = config.xAxisKey ? String(config.data[config.data.length - 1]?.[config.xAxisKey] || '') : '';

  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2" style={{ minHeight: 160 }}>
      <span className="text-3xl font-extrabold text-foreground tabular-nums">{fmt(last)}</span>
      {label && <span className="text-xs text-muted-foreground">{formatChartLabel(label)}</span>}
      {delta != null && (
        <span className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
          delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground',
        )}>
          {delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
        </span>
      )}
      <span className="text-[9px] text-muted-foreground/50 bg-muted/20 rounded-full px-3 py-1">
        Sem tendência suficiente ({values.length} {values.length === 1 ? 'registro' : 'registros'})
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CategorySummaryCard — bar/hbar with 1 category
// ═══════════════════════════════════════════════════════════════════════════════
const CategorySummaryCard: React.FC<{ config: ChartConfig; fmt: (v: number) => string }> = ({ config, fmt }) => {
  const dk = getPrimaryKey(config);
  const val = dk ? Number(config.data[0]?.[dk]) || 0 : 0;
  const label = config.xAxisKey ? String(config.data[0]?.[config.xAxisKey] || '') : '';
  const color = config.dataKeys[0]?.color || CHART_COLORS[0];

  return (
    <div className="flex flex-col items-center justify-center py-6 gap-3" style={{ minHeight: 160 }}>
      <span className="text-3xl font-extrabold text-foreground tabular-nums">{fmt(val)}</span>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">{formatChartLabel(label)}</span>
      )}
      {/* Progress-style bar */}
      <div className="w-full max-w-[200px] h-3 rounded-full bg-muted/20 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: '100%', background: color }} />
      </div>
      <span className="text-[9px] text-muted-foreground/50">1 categoria no período</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ScatterSummaryTiles — scatter < 4 points, compact 2x2 tiles
// ═══════════════════════════════════════════════════════════════════════════════
const ScatterSummaryTiles: React.FC<{ config: ChartConfig; fmt: (v: number) => string }> = ({ config, fmt }) => {
  const yKey = config.yAxisKey || config.dataKeys?.[0]?.key || 'receita';
  const xKey = config.xAxisKey || 'km';
  const yVals = config.data.map(d => Number(d[yKey])).filter(v => Number.isFinite(v));
  const xVals = config.data.map(d => Number(d[xKey])).filter(v => Number.isFinite(v));
  const avgY = yVals.length ? yVals.reduce((a, b) => a + b, 0) / yVals.length : 0;
  const avgX = xVals.length ? xVals.reduce((a, b) => a + b, 0) / xVals.length : 0;
  const rpk = avgX > 0 ? avgY / avgX : 0;

  const tiles = [
    { label: 'Pontos', value: String(config.data.length) },
    { label: 'Receita média', value: fmt(avgY) },
    { label: 'Km médio', value: formatCompactNumber(Math.round(avgX)) },
    { label: 'R$/km médio', value: rpk > 0 ? `R$ ${rpk.toFixed(2)}` : '—' },
  ];

  return (
    <div className="py-3" style={{ minHeight: 140 }}>
      <p className="text-[10px] text-muted-foreground/60 text-center mb-3">
        Amostra insuficiente para dispersão (mín. 4 pontos).
      </p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t, i) => (
          <div key={i} className="border border-border/30 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{t.label}</p>
            <p className="text-xl font-extrabold text-foreground tabular-nums mt-0.5">{t.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// computeAverage for ReferenceLine (only >= 3 points)
// ═══════════════════════════════════════════════════════════════════════════════
function computeAverage(config: ChartConfig): number | null {
  const { type, data, dataKeys } = config;
  if (!['line', 'area', 'bar', 'horizontal-bar'].includes(type)) return null;
  if (!dataKeys.length || data.length < 3) return null;

  const key = dataKeys[0].key;
  const vals = data.map(d => Number(d[key])).filter(v => !isNaN(v) && isFinite(v));
  if (vals.length < 3) return null;

  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg === 0) return null;
  return avg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Premium Tooltip
// ═══════════════════════════════════════════════════════════════════════════════
const ChartTooltipCard: React.FC<any> = ({ active, payload, label, valueFormatter }) => {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter || String;
  const title = label != null && label !== '' ? formatChartLabel(String(label)) : null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl min-w-[150px] max-w-[260px]">
      {title && (
        <div className="text-[11px] font-semibold text-foreground border-b border-border/30 pb-1.5 mb-1.5">
          {title}
        </div>
      )}
      <div className="space-y-1">
        {payload
          .filter((p: any) => p?.value != null && !Number.isNaN(p.value))
          .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))
          .slice(0, 6)
          .map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-5">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="text-[11px] text-muted-foreground truncate">
                  {formatChartLabel(p.name || p.dataKey)}
                </span>
              </span>
              <span className="text-[11px] font-bold text-foreground tabular-nums whitespace-nowrap">
                {fmt(p.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Premium Legend (chips)
// ═══════════════════════════════════════════════════════════════════════════════
const ChartLegendChips: React.FC<any> = ({ payload, maxItems = 8 }) => {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-3 px-2">
      {payload.slice(0, maxItems).map((p: any, i: number) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/40 px-2.5 py-0.5 text-[10px] text-muted-foreground bg-muted/20"
        >
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="truncate max-w-[120px]">{formatChartLabel(String(p.value || p.dataKey || ''))}</span>
        </span>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════════════════════════════
const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <Card className="rounded-2xl overflow-hidden border-border/40">
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-3 w-48 mb-3" />
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </CardContent>
  </Card>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Dark premium axis/grid constants (Parte 6)
// ═══════════════════════════════════════════════════════════════════════════════
const AXIS_TICK = { fontSize: 11, fill: 'rgba(255,255,255,0.55)' };
const AXIS_LABEL_FILL = 'rgba(255,255,255,0.35)';
const MARGIN = { top: 12, right: 16, bottom: 8, left: 4 };
const MARGIN_MOBILE = { top: 8, right: 10, bottom: 6, left: 0 };
const GRID_PROPS = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' } as const;

const REFLINE_STYLE = {
  stroke: 'rgba(255,255,255,0.18)',
  strokeWidth: 1,
  strokeDasharray: '6 6',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// RenderChart — density heuristic + summary cards
// ═══════════════════════════════════════════════════════════════════════════════
const RenderChart: React.FC<{ config: ChartConfig; isMobile: boolean }> = ({ config, isMobile }) => {
  const { type, data, dataKeys, xAxisKey = 'name', valueFormatter = String } = config;
  const pointCount = data.length;
  const isSingle = pointCount === 1;
  const isSparse = pointCount <= 2;

  // Empty
  if (pointCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-10" style={{ minHeight: 160 }}>
        <span className="text-4xl opacity-30">📊</span>
        <span className="text-xs">Sem dados para exibir</span>
      </div>
    );
  }

  // Parte 3: line/area < 3 → TrendSummaryCard
  if ((type === 'line' || type === 'area') && pointCount < 3) {
    return <TrendSummaryCard config={config} fmt={valueFormatter} />;
  }

  // Parte 3: bar/hbar 1 category → CategorySummaryCard
  if ((type === 'bar' || type === 'horizontal-bar') && isSingle) {
    return <CategorySummaryCard config={config} fmt={valueFormatter} />;
  }

  // Parte 3/4: scatter < 4 → ScatterSummaryTiles
  if (type === 'scatter' && pointCount < 4) {
    return <ScatterSummaryTiles config={config} fmt={valueFormatter} />;
  }

  const dynamicHeight = isSparse ? 240 : (config.height || 300);
  const height = isMobile ? Math.min(dynamicHeight, 230) : dynamicHeight;

  const avg = computeAverage(config);
  const margin = isMobile ? MARGIN_MOBILE : MARGIN;
  const legendMaxItems = isMobile ? 6 : 8;

  const primaryKey = dataKeys[0]?.key;
  const allValues = primaryKey
    ? data.map(d => Number(d[primaryKey])).filter(v => Number.isFinite(v))
    : [];
  const domain = computeDomain(allValues);

  const xAxisProps = {
    dataKey: xAxisKey,
    tick: AXIS_TICK,
    tickLine: false,
    axisLine: false,
    tickMargin: isMobile ? 4 : 8,
    interval: 'preserveStartEnd' as const,
    minTickGap: isMobile ? 30 : 20,
    tickFormatter: (v: any) => compactTick(v, isMobile ? 7 : 10),
  };

  const yAxisProps = {
    tick: AXIS_TICK,
    tickLine: false,
    axisLine: false,
    width: isMobile ? 40 : 48,
    tickFormatter: formatCompactNumber,
    tickMargin: 4,
    domain,
  };

  const refLabel = avg != null ? {
    value: `Média: ${formatCompactNumber(avg)}`,
    position: 'insideTopRight' as const,
    style: { fontSize: 9, fill: AXIS_LABEL_FILL, fontWeight: 600 },
  } : undefined;

  const dotSize = isSparse ? { r: 5, strokeWidth: 2, fill: '#fff' } : (isMobile ? false : { r: 3, strokeWidth: 2, fill: '#fff' });

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={margin}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {avg != null && <ReferenceLine y={avg} label={refLabel} {...REFLINE_STYLE} />}
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            {!isSparse && <Legend content={<ChartLegendChips maxItems={legendMaxItems} />} />}
            {dataKeys.map((dk, i) => (
              <Line key={dk.key} type="monotone" dataKey={dk.key} name={dk.label}
                stroke={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5}
                dot={dotSize as any}
                activeDot={{ r: 5.5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar': {
      const formatted = data.map(item => ({
        ...item,
        [xAxisKey]: formatChartLabel(String(item[xAxisKey] || '')),
      }));
      // Parte 5: single bar → wider bar, dynamic Y, less grid
      const barSz = isSingle ? 48 : (isMobile ? 32 : 40);
      const maxBarSz = isSingle ? 56 : (isMobile ? 32 : 40);
      const barRadius: [number, number, number, number] = isSingle ? [10, 10, 6, 6] : [6, 6, 0, 0];
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={formatted} margin={margin}>
            <CartesianGrid {...GRID_PROPS} vertical={isSingle ? false : undefined} />
            <XAxis {...xAxisProps} tick={isSingle ? { ...AXIS_TICK, fontSize: 13 } : AXIS_TICK} />
            <YAxis {...yAxisProps} tickCount={isSingle ? 4 : undefined} />
            {avg != null && <ReferenceLine y={avg} label={refLabel} {...REFLINE_STYLE} />}
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            {!isSparse && <Legend content={<ChartLegendChips maxItems={legendMaxItems} />} />}
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={formatChartLabel(dk.label)}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={barRadius} barSize={barSz} maxBarSize={maxBarSz} animationDuration={500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case 'horizontal-bar': {
      const barHeight = Math.max(isMobile ? 200 : height, data.length * (isMobile ? 36 : 44) + 50);
      const hDomain = computeDomain(allValues);
      return (
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid {...GRID_PROPS} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false}
              tickFormatter={formatCompactNumber} tickMargin={4} domain={hDomain} />
            {avg != null && <ReferenceLine x={avg} label={{ ...refLabel, position: 'insideTopRight' as const }} {...REFLINE_STYLE} />}
            <YAxis dataKey={xAxisKey} type="category" width={isMobile ? 100 : 140}
              tick={{ ...AXIS_TICK, fontSize: isMobile ? 9 : 10 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => compactTick(v, isMobile ? 15 : 22)} tickMargin={4} />
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={dk.label}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[0, 8, 8, 0]} barSize={isMobile ? 12 : 14} animationDuration={500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case 'pie': {
      const formatted = data.map(item => ({
        ...item,
        name: formatChartLabel(String(item.name || '')),
      }));
      const outerR = isMobile ? 72 : 92;
      const innerR = isMobile ? 40 : 52;
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie data={formatted} cx="50%" cy="45%"
              outerRadius={outerR} innerRadius={innerR}
              paddingAngle={2} labelLine={false}
              dataKey={dataKeys[0]?.key || 'value'}
              animationDuration={500} animationEasing="ease-out"
              strokeWidth={2} stroke="hsl(var(--card))"
            >
              {formatted.map((_, i) => (
                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            <Legend content={<ChartLegendChips maxItems={legendMaxItems} />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey={xAxisKey} type="number" name={dataKeys[0]?.label || ''}
              tick={AXIS_TICK} tickLine={false} axisLine={false}
              tickFormatter={(v) => `${formatCompactNumber(Number(v))} km`}
              tickMargin={8} interval="preserveStartEnd" minTickGap={isMobile ? 40 : 30} />
            <YAxis dataKey={config.yAxisKey || dataKeys[0]?.key || 'value'} type="number"
              name={dataKeys[1]?.label || ''} tick={AXIS_TICK} tickLine={false} axisLine={false}
              width={isMobile ? 48 : 56} tickFormatter={(v) => formatBRL(Number(v))} tickMargin={4} />
            {config.zAxisKey && <ZAxis dataKey={config.zAxisKey} range={[40, 400]} name="Tamanho" />}
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />}
              cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--muted-foreground))' }} />
            <Scatter name={dataKeys[0]?.label || 'Dados'} data={data}
              fill={dataKeys[0]?.color || CHART_COLORS[0]} shape="circle" />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={margin}>
            <defs>
              {dataKeys.map((dk, i) => {
                const color = dk.color || CHART_COLORS[i % CHART_COLORS.length];
                return (
                  <linearGradient key={dk.key} id={`grad-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {avg != null && <ReferenceLine y={avg} label={refLabel} {...REFLINE_STYLE} />}
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            {!isSparse && <Legend content={<ChartLegendChips maxItems={legendMaxItems} />} />}
            {dataKeys.map((dk, i) => {
              const color = dk.color || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <Area key={dk.key} type="monotone" dataKey={dk.key} name={formatChartLabel(dk.label)}
                  stroke={color} fill={`url(#grad-${dk.key})`}
                  strokeWidth={2.5}
                  dot={isSparse ? { r: 5, fill: color, strokeWidth: 0 } as any : false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════════
export const ReportCharts: React.FC<ReportChartsProps> = ({
  charts, isLoading = false, columns = 2, className,
}) => {
  const isMobile = useIsMobile();
  const effectiveCols = isMobile ? 1 : columns;
  const gridCols = effectiveCols === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2';

  if (isLoading) {
    return (
      <div className={cn(`grid ${gridCols} gap-5`, className)}>
        {Array.from({ length: Math.min(charts.length || 4, 4) }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(`grid ${gridCols} gap-5`, className)}>
      {charts.map((chart, index) => {
        const kpi = computeMiniKpi(chart);
        const fmt = chart.valueFormatter || formatCompactNumber;
        return (
          <Card key={index} className="rounded-2xl overflow-hidden border-border/40 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-0 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-foreground tracking-tight">
                {chart.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4 pt-1.5">
              {kpi && chart.data.length > 0 && (
                <PowerBIHeader kpi={kpi} fmt={fmt} />
              )}
              <RenderChart config={chart} isMobile={isMobile} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export { formatBRL };
export type { ChartConfig };
