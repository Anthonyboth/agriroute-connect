import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, AreaChart, Area
} from 'recharts';
import { cn } from '@/lib/utils';

// Paleta moderna — verde AgriRoute + complementares vibrantes
const CHART_COLORS = [
  '#16a34a', '#2563eb', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ef4444', '#ec4899', '#84cc16',
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

/** Formata números do eixo Y de forma compacta (1.200 → 1,2K) */
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

// ── Tooltip customizado ──────────────────────────────────────────────────────
const CustomTooltip: React.FC<any> = ({ active, payload, label, valueFormatter }) => {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter || String;
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-xl text-sm space-y-1.5 max-w-[240px] z-50">
      {label != null && label !== '' && (
        <p className="text-xs font-semibold text-foreground border-b border-border pb-1.5 mb-1">
          {formatChartLabel(String(label))}
        </p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            {formatChartLabel(entry.name || entry.dataKey)}
          </span>
          <span className="text-xs font-bold text-foreground whitespace-nowrap">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 280 }) => (
  <Card className="rounded-2xl overflow-hidden">
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-28" />
    </CardHeader>
    <CardContent>
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </CardContent>
  </Card>
);

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const axisTickStyle = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

const gridProps = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))',
  opacity: 0.4,
} as const;

// Margens padrão — left suficiente para eixo Y não cortar
const defaultMargin = { top: 10, right: 16, left: 8, bottom: 8 };
const horizontalMargin = { top: 8, right: 20, left: 8, bottom: 4 };

// ── Render de cada tipo ──────────────────────────────────────────────────────
const RenderChart: React.FC<{ config: ChartConfig }> = ({ config }) => {
  const { type, data, dataKeys, xAxisKey = 'name', valueFormatter = String, height = 280 } = config;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2" style={{ height: 200 }}>
        <span className="text-3xl">📊</span>
        <span className="text-xs">Sem dados para exibir</span>
      </div>
    );
  }

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={defaultMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xAxisKey} tick={axisTickStyle} tickLine={false} axisLine={false}
              tickMargin={6} />
            <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} width={50}
              tickFormatter={formatAxisNumber} tickMargin={4} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {dataKeys.map((dk, i) => (
              <Line key={dk.key} type="monotone" dataKey={dk.key} name={dk.label}
                stroke={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }}
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
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xAxisKey} tick={axisTickStyle} tickLine={false} axisLine={false}
              tickMargin={6} tickFormatter={(v) => truncateLabel(v, 12)} />
            <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} width={50}
              tickFormatter={formatAxisNumber} tickMargin={4} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(v) => formatChartLabel(String(v))} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={formatChartLabel(dk.label)}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[6, 6, 0, 0]} maxBarSize={48} animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case 'horizontal-bar': {
      const maxLen = Math.max(...data.map(d => truncateLabel(String(d[xAxisKey] || ''), 22).length), 5);
      const labelW = Math.min(Math.max(maxLen * 6, 90), 170);
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={horizontalMargin}>
            <CartesianGrid {...gridProps} horizontal={false} />
            <XAxis type="number" tick={axisTickStyle} tickLine={false} axisLine={false}
              tickFormatter={(v) => formatAxisNumber(v)} tickMargin={4} />
            <YAxis dataKey={xAxisKey} type="category" width={labelW}
              tick={{ ...axisTickStyle, fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => truncateLabel(v, 22)} tickMargin={4} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            {dataKeys.map((dk, i) => (
              <Bar key={dk.key} dataKey={dk.key} name={dk.label}
                fill={dk.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[0, 6, 6, 0]} maxBarSize={28} animationDuration={600}
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
        if (percent < 0.05) return null;
        const radius = outerRadius + 22;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
          <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
            style={{ fontSize: 10, fill: 'hsl(var(--foreground))', fontWeight: 600 }}>
            {truncateLabel(name, 14)} {(percent * 100).toFixed(0)}%
          </text>
        );
      };
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 10 }}>
            <Pie data={formatted} cx="50%" cy="45%"
              labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              label={renderLabel}
              outerRadius={80} innerRadius={35}
              dataKey={dataKeys[0]?.key || 'value'}
              animationDuration={600} animationEasing="ease-out"
              paddingAngle={2} strokeWidth={0}
            >
              {formatted.map((_, i) => (
                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => formatChartLabel(String(v))} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 12, right: 20, left: 12, bottom: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xAxisKey} type="number" name={dataKeys[0]?.label || ''}
              tick={axisTickStyle} tickLine={false} axisLine={false} width={50}
              tickFormatter={formatAxisNumber} tickMargin={6} />
            <YAxis dataKey={config.yAxisKey || dataKeys[0]?.key || 'value'} type="number"
              name={dataKeys[1]?.label || ''} tick={axisTickStyle} tickLine={false} axisLine={false}
              width={55} tickFormatter={formatAxisNumber} tickMargin={4} />
            {config.zAxisKey && <ZAxis dataKey={config.zAxisKey} range={[40, 400]} name="Tamanho" />}
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />}
              cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--muted-foreground))' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Scatter name={dataKeys[0]?.label || 'Dados'} data={data}
              fill={dataKeys[0]?.color || CHART_COLORS[0]} shape="circle" />
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
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xAxisKey} tick={axisTickStyle} tickLine={false} axisLine={false}
              tickMargin={6} tickFormatter={(v) => truncateLabel(v, 12)} />
            <YAxis tick={axisTickStyle} tickLine={false} axisLine={false} width={50}
              tickFormatter={formatAxisNumber} tickMargin={4} />
            <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
            <Legend iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(v) => formatChartLabel(String(v))} />
            {dataKeys.map((dk, i) => {
              const color = dk.color || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <Area key={dk.key} type="monotone" dataKey={dk.key} name={formatChartLabel(dk.label)}
                  stroke={color} fill={`url(#grad-${dk.key})`}
                  strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5.5, strokeWidth: 0, fill: color }}
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
      <div className={cn(`grid ${gridCols} gap-4`, className)}>
        {Array.from({ length: Math.min(charts.length || 4, 4) }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(`grid ${gridCols} gap-4`, className)}>
      {charts.map((chart, index) => (
        <Card key={index} className="rounded-2xl overflow-hidden border shadow-sm">
          <CardHeader className="pb-1 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">{chart.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-1">
            <RenderChart config={chart} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export { formatBRL };
export type { ChartConfig };
