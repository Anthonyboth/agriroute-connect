import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, AreaChart, Area
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Paleta fixa (hex garante render consistente no Recharts) ─────────────────
const CHART_COLORS = [
  '#16a34a', // verde AgriRoute
  '#2563eb', // azul
  '#f59e0b', // amber
  '#8b5cf6', // violeta
  '#06b6d4', // cyan
  '#ef4444', // vermelho
  '#ec4899', // rosa
  '#84cc16', // lima
];

// ── Label map PT-BR ──────────────────────────────────────────────────────────
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

/** Trunca label longo com "…" */
const compactTick = (v: any, max = 14): string => {
  const s = formatChartLabel(String(v ?? ''));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** Formata números compactos: 1200 → 1,2K */
const formatCompactNumber = (n: number): string => {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}K`;
  return n.toLocaleString('pt-BR');
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

// ── Tipos ────────────────────────────────────────────────────────────────────
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

// ── Premium Tooltip (card glassmorphism, sorted by value) ────────────────────
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
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ background: p.color }}
                />
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

// ── Premium Legend (chips ao invés de lista) ─────────────────────────────────
const ChartLegendChips: React.FC<any> = ({ payload }) => {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1.5 pt-3 px-2">
      {payload.slice(0, 8).map((p: any, i: number) => (
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

// ── Skeleton ─────────────────────────────────────────────────────────────────
const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <Card className="rounded-2xl overflow-hidden border-border/40">
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </CardContent>
  </Card>
);

// ── Defaults premium ─────────────────────────────────────────────────────────
const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const MARGIN = { top: 12, right: 16, bottom: 8, left: 4 };
const GRID = { strokeDasharray: '3 3', stroke: 'hsl(var(--border))', opacity: 0.25 } as const;

// ── Render de cada tipo ─────────────────────────────────────────────────────
const RenderChart: React.FC<{ config: ChartConfig }> = ({ config }) => {
  const { type, data, dataKeys, xAxisKey = 'name', valueFormatter = String, height = 300 } = config;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-10" style={{ minHeight: 200 }}>
        <span className="text-4xl opacity-30">📊</span>
        <span className="text-xs">Sem dados para exibir</span>
      </div>
    );
  }

  // Shared X/Y axis props
  const xAxisProps = {
    dataKey: xAxisKey,
    tick: AXIS_TICK,
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    interval: 'preserveStartEnd' as const,
    minTickGap: 20,
    tickFormatter: (v: any) => compactTick(v, 10),
  };

  const yAxisProps = {
    tick: AXIS_TICK,
    tickLine: false,
    axisLine: false,
    width: 48,
    tickFormatter: formatCompactNumber,
    tickMargin: 4,
  };

  switch (type) {
    // ── LINE ───────────────────────────────────────────────────────────
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={MARGIN}>
            <CartesianGrid {...GRID} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            <Legend content={<ChartLegendChips />} />
            {dataKeys.map((dk, i) => (
              <Line key={dk.key} type="monotone" dataKey={dk.key} name={dk.label}
                stroke={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 5.5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    // ── BAR ────────────────────────────────────────────────────────────
    case 'bar': {
      const formatted = data.map(item => ({
        ...item,
        [xAxisKey]: formatChartLabel(String(item[xAxisKey] || '')),
      }));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={formatted} margin={MARGIN}>
            <CartesianGrid {...GRID} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            <Legend content={<ChartLegendChips />} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={formatChartLabel(dk.label)}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // ── HORIZONTAL BAR ────────────────────────────────────────────────
    case 'horizontal-bar': {
      const barHeight = Math.max(height, data.length * 44 + 50);
      return (
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid {...GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false}
              tickFormatter={formatCompactNumber} tickMargin={4} />
            <YAxis dataKey={xAxisKey} type="category" width={140}
              tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => compactTick(v, 22)} tickMargin={4} />
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={dk.label}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[0, 8, 8, 0]} barSize={14} animationDuration={500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // ── PIE (donut limpo — sem label, só tooltip + legend chips) ─────
    case 'pie': {
      const formatted = data.map(item => ({
        ...item,
        name: formatChartLabel(String(item.name || '')),
      }));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie
              data={formatted}
              cx="50%"
              cy="45%"
              outerRadius={92}
              innerRadius={52}
              paddingAngle={2}
              labelLine={false}
              dataKey={dataKeys[0]?.key || 'value'}
              animationDuration={500}
              animationEasing="ease-out"
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {formatted.map((_, i) => (
                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            <Legend content={<ChartLegendChips />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // ── SCATTER (eixos formatados com unidades) ──────────────────────
    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey={xAxisKey} type="number" name={dataKeys[0]?.label || ''}
              tick={AXIS_TICK} tickLine={false} axisLine={false}
              tickFormatter={(v) => `${formatCompactNumber(Number(v))} km`}
              tickMargin={8} interval="preserveStartEnd" minTickGap={30} />
            <YAxis dataKey={config.yAxisKey || dataKeys[0]?.key || 'value'} type="number"
              name={dataKeys[1]?.label || ''} tick={AXIS_TICK} tickLine={false} axisLine={false}
              width={56} tickFormatter={(v) => formatBRL(Number(v))} tickMargin={4} />
            {config.zAxisKey && <ZAxis dataKey={config.zAxisKey} range={[40, 400]} name="Tamanho" />}
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />}
              cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--muted-foreground))' }} />
            <Scatter name={dataKeys[0]?.label || 'Dados'} data={data}
              fill={dataKeys[0]?.color || CHART_COLORS[0]} shape="circle" />
          </ScatterChart>
        </ResponsiveContainer>
      );

    // ── AREA (gradiente fintech) ─────────────────────────────────────
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={MARGIN}>
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
            <CartesianGrid {...GRID} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<ChartTooltipCard valueFormatter={valueFormatter} />} />
            <Legend content={<ChartLegendChips />} />
            {dataKeys.map((dk, i) => {
              const color = dk.color || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <Area key={dk.key} type="monotone" dataKey={dk.key} name={formatChartLabel(dk.label)}
                  stroke={color} fill={`url(#grad-${dk.key})`}
                  strokeWidth={2.5}
                  dot={false}
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

// ── Componente principal ─────────────────────────────────────────────────────
export const ReportCharts: React.FC<ReportChartsProps> = ({
  charts, isLoading = false, columns = 2, className,
}) => {
  const gridCols = columns === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2';

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
      {charts.map((chart, index) => (
        <Card key={index} className="rounded-2xl overflow-hidden border-border/40 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground tracking-tight">
              {chart.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4 pt-2">
            <RenderChart config={chart} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export { formatBRL };
export type { ChartConfig };
