import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCard } from '@/components/ui/stats-card';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { formatBRL, formatKm } from '@/lib/formatters';
import { Truck, DollarSign, MapPin, TrendingUp } from 'lucide-react';
import { UI_TEXTS } from '@/lib/ui-texts';

interface FreightAnalyticsDashboardProps {
  freights: any[];
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

export const FreightAnalyticsDashboard: React.FC<FreightAnalyticsDashboardProps> = ({ 
  freights, 
  timeRange,
  onTimeRangeChange 
}) => {
  
  const analyticsData = useMemo(() => {
    const now = new Date();
    const filtered = freights.filter(f => {
      const date = new Date(f.created_at || f.pickup_date);
      const diff = now.getTime() - date.getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      
      switch (timeRange) {
        case 'week': return days <= 7;
        case 'month': return days <= 30;
        case 'quarter': return days <= 90;
        case 'year': return days <= 365;
        default: return true;
      }
    });
    
    // Agrupar por mês
    const byMonth = filtered.reduce((acc, f) => {
      const date = new Date(f.created_at || f.pickup_date);
      const month = date.toLocaleDateString('pt-BR', { 
        month: 'short', 
        year: 'numeric' 
      });
      
      if (!acc[month]) {
        acc[month] = { month, count: 0, revenue: 0, distance: 0 };
      }
      acc[month].count++;
      acc[month].revenue += f.price || 0;
      acc[month].distance += f.distance_km || 0;
      
      return acc;
    }, {} as Record<string, any>);
    
    const freightsByMonth = Object.values(byMonth).sort((a: any, b: any) => {
      return new Date(a.month).getTime() - new Date(b.month).getTime();
    });
    
    // Agrupar por status
    const byStatus = filtered.reduce((acc, f) => {
      const status = f.status || 'UNKNOWN';
      if (!acc[status]) {
        acc[status] = { status, count: 0 };
      }
      acc[status].count++;
      return acc;
    }, {} as Record<string, any>);
    
    const freightsByStatus = Object.values(byStatus);
    
    // Totais
    const totalRevenue = filtered.reduce((sum, f) => sum + (f.price || 0), 0);
    const totalDistance = filtered.reduce((sum, f) => sum + (f.distance_km || 0), 0);
    const totalFreights = filtered.length;
    
    return {
      freightsByMonth,
      freightsByStatus,
      totalRevenue,
      totalDistance,
      totalFreights,
      avgPrice: totalFreights > 0 ? totalRevenue / totalFreights : 0
    };
  }, [freights, timeRange]);
  
  return (
    <div className="space-y-6" translate="no">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">{UI_TEXTS.ANALYTICS}</CardTitle>
            <Tabs value={timeRange} onValueChange={(v) => onTimeRangeChange(v as any)}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="week" className="text-xs sm:text-sm">{UI_TEXTS.ULTIMA_SEMANA}</TabsTrigger>
                <TabsTrigger value="month" className="text-xs sm:text-sm">{UI_TEXTS.ULTIMO_MES}</TabsTrigger>
                <TabsTrigger value="quarter" className="text-xs sm:text-sm">{UI_TEXTS.ULTIMO_TRIMESTRE}</TabsTrigger>
                <TabsTrigger value="year" className="text-xs sm:text-sm">{UI_TEXTS.ULTIMO_ANO}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Fretes</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalFreights}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(analyticsData.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distância Total</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKm(analyticsData.totalDistance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(analyticsData.avgPrice)}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Line Chart - Evolução de Fretes */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução de Fretes ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.freightsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="hsl(var(--primary))" 
                name="Quantidade de Fretes"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Bar Chart - Receita Mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.freightsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month"
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--foreground))"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <Tooltip 
                formatter={(value: any) => formatBRL(value)}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--primary))" 
                name="Receita (R$)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Pie Chart - Distribuição por Status */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Fretes por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.freightsByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.status}: ${entry.count}`}
                outerRadius={100}
                fill="hsl(var(--primary))"
                dataKey="count"
              >
                {analyticsData.freightsByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
