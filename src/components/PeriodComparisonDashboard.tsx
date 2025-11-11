import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { formatBRL, formatKm } from '@/lib/formatters';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subQuarters } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PeriodComparisonDashboardProps {
  freights: any[];
  comparisonType: 'month' | 'quarter';
}

export const PeriodComparisonDashboard: React.FC<PeriodComparisonDashboardProps> = ({
  freights,
  comparisonType = 'month'
}) => {
  const analytics = useMemo(() => {
    const now = new Date();
    
    // Definir períodos
    const currentPeriod = comparisonType === 'month'
      ? { start: startOfMonth(now), end: endOfMonth(now) }
      : { start: startOfQuarter(now), end: endOfQuarter(now) };
    
    const previousPeriod = comparisonType === 'month'
      ? { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) }
      : { start: startOfQuarter(subQuarters(now, 1)), end: endOfQuarter(subQuarters(now, 1)) };
    
    // Filtrar fretes por período
    const currentFreights = freights.filter(f => {
      const date = new Date(f.pickup_date || f.created_at);
      return date >= currentPeriod.start && date <= currentPeriod.end;
    });
    
    const previousFreights = freights.filter(f => {
      const date = new Date(f.pickup_date || f.created_at);
      return date >= previousPeriod.start && date <= previousPeriod.end;
    });
    
    // Calcular métricas
    const calculateMetrics = (freightList: any[]) => ({
      totalFreights: freightList.length,
      totalRevenue: freightList.reduce((sum, f) => sum + (f.price || 0), 0),
      avgPrice: freightList.length > 0 
        ? freightList.reduce((sum, f) => sum + (f.price || 0), 0) / freightList.length 
        : 0,
      totalDistance: freightList.reduce((sum, f) => sum + (f.distance_km || 0), 0),
      byStatus: freightList.reduce((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    const current = calculateMetrics(currentFreights);
    const previous = calculateMetrics(previousFreights);
    
    // Calcular crescimento percentual
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    const growth = {
      freights: calculateGrowth(current.totalFreights, previous.totalFreights),
      revenue: calculateGrowth(current.totalRevenue, previous.totalRevenue),
      avgPrice: calculateGrowth(current.avgPrice, previous.avgPrice),
      distance: calculateGrowth(current.totalDistance, previous.totalDistance)
    };
    
    // Preparar dados para gráficos
    const periodLabel = comparisonType === 'month' ? 'Mês' : 'Trimestre';
    
    return {
      current,
      previous,
      growth,
      periodLabel,
      currentPeriod,
      previousPeriod
    };
  }, [freights, comparisonType]);
  
  const GrowthBadge = ({ value }: { value: number }) => {
    const isPositive = value >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    
    return (
      <Badge variant={isPositive ? 'default' : 'destructive'} className="gap-1">
        <Icon className="h-3 w-3" />
        {isPositive ? '+' : ''}{value.toFixed(1)}%
      </Badge>
    );
  };
  
  const ComparisonCard = ({ 
    title, 
    currentValue, 
    previousValue, 
    growth, 
    formatter 
  }: { 
    title: string; 
    currentValue: number; 
    previousValue: number; 
    growth: number;
    formatter: (val: number) => string;
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{formatter(currentValue)}</span>
          <GrowthBadge value={growth} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{analytics.periodLabel} anterior:</span>
          <span className="font-medium">{formatter(previousValue)}</span>
        </div>
      </CardContent>
    </Card>
  );
  
  // Dados para gráfico de linha temporal
  const timelineData = useMemo(() => {
    const days = comparisonType === 'month' ? 30 : 90;
    const data: any[] = [];
    
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(analytics.currentPeriod.start);
      currentDate.setDate(currentDate.getDate() + i);
      
      const previousDate = new Date(analytics.previousPeriod.start);
      previousDate.setDate(previousDate.getDate() + i);
      
      const currentDayFreights = freights.filter(f => {
        const date = new Date(f.pickup_date || f.created_at);
        return date.toDateString() === currentDate.toDateString();
      }).length;
      
      const previousDayFreights = freights.filter(f => {
        const date = new Date(f.pickup_date || f.created_at);
        return date.toDateString() === previousDate.toDateString();
      }).length;
      
      data.push({
        day: i + 1,
        atual: currentDayFreights,
        anterior: previousDayFreights
      });
    }
    
    return data;
  }, [freights, analytics.currentPeriod, analytics.previousPeriod, comparisonType]);
  
  // Dados para gráfico de barras por status
  const statusData = useMemo(() => {
    const statuses = ['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    return statuses.map(status => ({
      status: status.replace('_', ' '),
      atual: analytics.current.byStatus[status] || 0,
      anterior: analytics.previous.byStatus[status] || 0
    }));
  }, [analytics]);
  
  return (
    <div className="space-y-6" translate="no">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Comparação de Períodos</h2>
          <p className="text-sm text-muted-foreground">
            {format(analytics.currentPeriod.start, 'dd/MM/yyyy', { locale: ptBR })} - {format(analytics.currentPeriod.end, 'dd/MM/yyyy', { locale: ptBR })}
            {' vs '}
            {format(analytics.previousPeriod.start, 'dd/MM/yyyy', { locale: ptBR })} - {format(analytics.previousPeriod.end, 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>
      </div>
      
      {/* Cards de Comparação */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ComparisonCard
          title="Total de Fretes"
          currentValue={analytics.current.totalFreights}
          previousValue={analytics.previous.totalFreights}
          growth={analytics.growth.freights}
          formatter={(v) => v.toString()}
        />
        <ComparisonCard
          title="Receita Total"
          currentValue={analytics.current.totalRevenue}
          previousValue={analytics.previous.totalRevenue}
          growth={analytics.growth.revenue}
          formatter={formatBRL}
        />
        <ComparisonCard
          title="Preço Médio"
          currentValue={analytics.current.avgPrice}
          previousValue={analytics.previous.avgPrice}
          growth={analytics.growth.avgPrice}
          formatter={formatBRL}
        />
        <ComparisonCard
          title="Distância Total"
          currentValue={analytics.current.totalDistance}
          previousValue={analytics.previous.totalDistance}
          growth={analytics.growth.distance}
          formatter={formatKm}
        />
      </div>
      
      {/* Gráfico de Linha - Evolução Temporal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Evolução de Fretes ao Longo do Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" label={{ value: 'Dia do Período', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Quantidade', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="atual" stroke="hsl(var(--primary))" strokeWidth={2} name="Período Atual" />
              <Line type="monotone" dataKey="anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="Período Anterior" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Gráfico de Barras - Comparação por Status */}
      <Card>
        <CardHeader>
          <CardTitle>Comparação por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="atual" fill="hsl(var(--primary))" name="Período Atual" />
              <Bar dataKey="anterior" fill="hsl(var(--muted))" name="Período Anterior" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
