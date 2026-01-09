import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';

// Paleta de cores AgriRoute - cores vibrantes e harmonizadas
const CHART_COLORS = [
  '#2E7D32', // Verde primário (agricultura)
  '#FF9800', // Laranja (destaque)
  '#1976D2', // Azul (confiança)
  '#8D6E63', // Marrom (terra)
  '#7B1FA2', // Roxo (premium)
  '#00796B', // Teal (natureza)
  '#C62828', // Vermelho (urgência)
  '#F9A825', // Amarelo (atenção)
];

// Mapeamento de labels técnicos para português
const LABEL_MAP: Record<string, string> = {
  // Tipos de carga
  'adubo_fertilizante': 'Adubo/Fertilizante',
  'graos': 'Grãos',
  'gado': 'Gado',
  'gado_vivo': 'Gado Vivo',
  'aves': 'Aves',
  'suinos': 'Suínos',
  'leite': 'Leite',
  'frutas': 'Frutas',
  'legumes': 'Legumes',
  'cana': 'Cana-de-Açúcar',
  'soja': 'Soja',
  'milho': 'Milho',
  'algodao': 'Algodão',
  'cafe': 'Café',
  'madeira': 'Madeira',
  'maquinario': 'Maquinário',
  'equipamentos': 'Equipamentos',
  'insumos': 'Insumos',
  'outros': 'Outros',
  // Status de fretes
  'OPEN': 'Aberto',
  'ACCEPTED': 'Aceito',
  'IN_TRANSIT': 'Em Trânsito',
  'DELIVERED': 'Entregue',
  'CANCELLED': 'Cancelado',
  'PENDING': 'Pendente',
  'COMPLETED': 'Concluído',
  // Meses
  'jan': 'Janeiro',
  'fev': 'Fevereiro',
  'mar': 'Março',
  'abr': 'Abril',
  'mai': 'Maio',
  'jun': 'Junho',
  'jul': 'Julho',
  'ago': 'Agosto',
  'set': 'Setembro',
  'out': 'Outubro',
  'nov': 'Novembro',
  'dez': 'Dezembro',
};

/**
 * Formata labels técnicos para exibição amigável
 */
const formatChartLabel = (label: string): string => {
  if (!label) return '';
  
  // Verifica mapeamento direto
  const lowerLabel = label.toLowerCase();
  if (LABEL_MAP[lowerLabel]) return LABEL_MAP[lowerLabel];
  if (LABEL_MAP[label]) return LABEL_MAP[label];
  
  // Formatação automática: snake_case → Title Case
  return label
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

interface ChartDataPoint {
  name?: string;
  [key: string]: unknown;
}

interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'horizontal-bar';
  data: ChartDataPoint[];
  dataKeys: { key: string; label: string; color?: string }[];
  xAxisKey?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

interface ReportChartsProps {
  charts: ChartConfig[];
  isLoading?: boolean;
  columns?: 1 | 2;
  className?: string;
}

const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="w-full" style={{ height }} />
    </CardContent>
  </Card>
);

const formatBRL = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const RenderChart: React.FC<{ config: ChartConfig }> = ({ config }) => {
  const { type, data, dataKeys, xAxisKey = 'name', valueFormatter = String, height = 300 } = config;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xAxisKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              formatter={(value: number) => valueFormatter(value)}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend />
            {dataKeys.map((dk, index) => (
              <Line
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.label}
                stroke={dk.color || CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar':
      // Formatar labels dos dados
      const formattedBarData = data.map(item => ({
        ...item,
        [xAxisKey]: formatChartLabel(String(item[xAxisKey] || ''))
      }));
      
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={formattedBarData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
            <XAxis 
              dataKey={xAxisKey} 
              className="text-xs" 
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => formatChartLabel(String(value))}
            />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip 
              formatter={(value: number, name: string) => [
                valueFormatter(value),
                formatChartLabel(name)
              ]}
              labelFormatter={(label) => formatChartLabel(String(label))}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '8px 12px'
              }}
              labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
            />
            <Legend formatter={(value) => formatChartLabel(String(value))} />
            {dataKeys.map((dk, index) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                name={formatChartLabel(dk.label)}
                fill={dk.color || CHART_COLORS[index % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'horizontal-bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey={xAxisKey} type="category" className="text-xs" width={100} />
            <Tooltip 
              formatter={(value: number) => valueFormatter(value)}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            {dataKeys.map((dk, index) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                name={dk.label}
                fill={dk.color || CHART_COLORS[index % CHART_COLORS.length]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie':
      // Formatar dados do pie chart
      const formattedPieData = data.map(item => ({
        ...item,
        name: formatChartLabel(String(item.name || ''))
      }));
      
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={formattedPieData}
              cx="50%"
              cy="50%"
              labelLine={true}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={90}
              innerRadius={30}
              dataKey={dataKeys[0]?.key || 'value'}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {formattedPieData.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number, name: string) => [
                valueFormatter(value),
                formatChartLabel(name)
              ]}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '8px 12px'
              }}
              labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
            />
            <Legend 
              formatter={(value) => formatChartLabel(String(value))}
              wrapperStyle={{ paddingTop: '20px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
};

export const ReportCharts: React.FC<ReportChartsProps> = ({
  charts,
  isLoading = false,
  columns = 2,
  className,
}) => {
  const gridCols = columns === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2';

  if (isLoading) {
    return (
      <div className={cn(`grid ${gridCols} gap-6`, className)}>
        {Array.from({ length: Math.min(charts.length || 4, 4) }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(`grid ${gridCols} gap-6`, className)}>
      {charts.map((chart, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="text-base">{chart.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <RenderChart config={chart} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export { formatBRL };
export type { ChartConfig };
