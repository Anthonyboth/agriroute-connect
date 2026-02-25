import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, AreaChart, Area
} from 'recharts';
import { cn } from '@/lib/utils';

// Paleta verde AgriRoute + complementares
const CHART_COLORS = [
  'hsl(142, 76%, 36%)',   // verde principal
  'hsl(217, 91%, 60%)',   // azul
  'hsl(38, 92%, 50%)',    // amber
  'hsl(263, 70%, 50%)',   // violeta
  'hsl(189, 94%, 43%)',   // cyan
  'hsl(0, 84%, 60%)',     // vermelho
  'hsl(330, 81%, 60%)',   // rosa
  'hsl(84, 81%, 44%)',    // lima
];

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

const truncateLabel = (label: string, max = 18): string => {
  const formatted = formatChartLabel(label);
  return formatted.length > max ? formatted.slice(0, max - 1) + '…' : formatted;
};

/** Formata números do eixo Y de forma compacta */
const formatAxisNumber = (value: number): string => {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}K`;
  return value.toLocaleString('pt-BR');
};

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

// ── Tooltip ─────────────────────────────────────────────────────────────────
const CustomTooltip: React.FC<any> = ({ active, payload, label, valueFormatter }) => {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter || String;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2.5 shadow-lg text-sm min-w-[140px]">
      {label != null && label !== '' && (
        <p className="text-[11px] font-semibold text-foreground border-b border-border/40 pb-1.5 mb-1.5">
          {formatChartLabel(String(label))}
        </p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {formatChartLabel(entry.name || entry.dataKey)}
          </span>
          <span className="text-[11px] font-bold text-foreground tabular-nums">
            {fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <Card className="rounded-2xl overflow-hidden border-border/50">
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </CardContent>
  </Card>
);

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const axisStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

const gridStyle = {
  strokeDasharray: '4 4',
  stroke: 'hsl(var(--border))',
  opacity: 0.35,
} as const;

const defaultMargin = { top: 16, right: 20, left: 12, bottom: 12 };

// ── Render de cada tipo ─────────────────────────────────────────────────────
const RenderChart: React.FC<{ config: ChartConfig }> = ({ config }) => {
  const { type, data, dataKeys, xAxisKey = 'name', valueFormatter = String, height = 300 } = config;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 py-8" style={{ minHeight: 200 }}>
        <span className="text-4xl opacity-40">📊</span>
        <span className="text-xs">Sem dados para exibir</span>
      </div>
    );
  }

  const commonXAxis = {
    dataKey: xAxisKey,
    tick: axisStyle,
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
  };

  const commonYAxis = {
    tick: axisStyle,
    tickLine: false,
    axisLine: false,
    width: 52,
    tickFormatter: formatAxisNumber,
    tickMargin: 6,
  };

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={defaultMargin}>
            <CartesianGrid {...gridStyle} />
            <XAxis {...commonXAxis} />
            <YAxis {...commonYAxis} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
            {dataKeys.map((dk, i) => (
              <Line key={dk.key} type="monotone" dataKey={dk.key} name={dk.label}
                stroke={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
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
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={formatted} margin={defaultMargin}>
            <CartesianGrid {...gridStyle} />
            <XAxis {...commonXAxis} tickFormatter={(v) => truncateLabel(v, 10)} />
            <YAxis {...commonYAxis} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
              formatter={(v) => formatChartLabel(String(v))} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={formatChartLabel(dk.label)}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={500}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case 'horizontal-bar': {
      const maxLen = Math.max(...data.map(d => truncateLabel(String(d[xAxisKey] || ''), 20).length), 4);
      const labelW = Math.min(Math.max(maxLen * 6.5, 100), 180);
      const barHeight = Math.max(height, data.length * 42 + 60);
      return (
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid {...gridStyle} horizontal={false} />
            <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false}
              tickFormatter={formatAxisNumber} tickMargin={6} />
            <YAxis dataKey={xAxisKey} type="category" width={labelW}
              tick={{ ...axisStyle, fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => truncateLabel(v, 20)} tickMargin={6} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={dk.label}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[0, 6, 6, 0]} maxBarSize={26} animationDuration={500}
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
      const RADIAN = Math.PI / 180;
      const renderLabel = ({ cx, cy, midAngle, outerRadius, percent, name }: any) => {
        if (percent < 0.06) return null;
        const radius = outerRadius + 24;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
          <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
            style={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontWeight: 600 }}>
            {truncateLabel(name, 12)} {(percent * 100).toFixed(0)}%
          </text>
        );
      };
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 24, right: 24, left: 24, bottom: 16 }}>
            <Pie data={formatted} cx="50%" cy="45%"
              labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              label={renderLabel}
              outerRadius={85} innerRadius={40}
              dataKey={dataKeys[0]?.key || 'value'}
              animationDuration={500} animationEasing="ease-out"
              paddingAngle={3} strokeWidth={2} stroke="hsl(var(--card))"
            >
              {formatted.map((_, i) => (
                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(v) => formatChartLabel(String(v))} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 16, right: 24, left: 16, bottom: 12 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey={xAxisKey} type="number" name={dataKeys[0]?.label || ''}
              tick={axisStyle} tickLine={false} axisLine={false}
              tickFormatter={formatAxisNumber} tickMargin={8} />
            <YAxis dataKey={config.yAxisKey || dataKeys[0]?.key || 'value'} type="number"
              name={dataKeys[1]?.label || ''} tick={axisStyle} tickLine={false} axisLine={false}
              width={56} tickFormatter={formatAxisNumber} tickMargin={6} />
            {config.zAxisKey && <ZAxis dataKey={config.zAxisKey} range={[40, 400]} name="Tamanho" />}
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />}
              cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--muted-foreground))' }} />
            <Scatter name={dataKeys[0]?.label || 'Dados'} data={data}
              fill={dataKeys[0]?.color || CHART_COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={defaultMargin}>
            <defs>
              {dataKeys.map((dk, i) => {
                const color = dk.color || CHART_COLORS[i % CHART_COLORS.length];
                return (
                  <linearGradient key={dk.key} id={`grad-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis {...commonXAxis} tickFormatter={(v) => truncateLabel(v, 10)} />
            <YAxis {...commonYAxis} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
              formatter={(v) => formatChartLabel(String(v))} />
            {dataKeys.map((dk, i) => {
              const color = dk.color || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <Area key={dk.key} type="monotone" dataKey={dk.key} name={formatChartLabel(dk.label)}
                  stroke={color} fill={`url(#grad-${dk.key})`}
                  strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: color }}
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
        <Card key={index} className="rounded-2xl overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
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
