import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompanyDriverPerformance, CompanyDriverPerformance } from '@/hooks/useCompanyDriverPerformance';
import { 
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  Star, TrendingUp, CheckCircle, Clock, Users, Phone, Eye, 
  XCircle, Percent, Timer, Truck, Award, AlertTriangle, 
  Mail, MapPin, Activity, Route
} from 'lucide-react';
import { formatBRL, formatKm } from '@/lib/formatters';
import { DriverPerformanceDashboard } from './DriverPerformanceDashboard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CompanyDriverPerformanceDashboardProps {
  companyId: string;
}

const COLORS = [
  'hsl(var(--chart-1))', 
  'hsl(var(--chart-2))', 
  'hsl(var(--chart-3))', 
  'hsl(var(--chart-4))', 
  'hsl(var(--chart-5))'
];

type PeriodFilter = '1m' | '3m' | '6m' | '1y' | 'all';

export const CompanyDriverPerformanceDashboard = ({ companyId }: CompanyDriverPerformanceDashboardProps) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const { data: performanceData, isLoading } = useCompanyDriverPerformance(companyId);

  // Filter monthly evolution based on period
  const filteredMonthlyData = useMemo(() => {
    if (!performanceData?.monthlyEvolution) return [];
    const monthsToShow = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 12 : 12;
    return performanceData.monthlyEvolution.slice(-monthsToShow);
  }, [performanceData?.monthlyEvolution, period]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!performanceData || performanceData.drivers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum motorista afiliado encontrado
      </div>
    );
  }

  // If a driver is selected, show their detailed dashboard
  if (selectedDriverId) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setSelectedDriverId(null)}>
          ← Voltar para Rankings
        </Button>
        <DriverPerformanceDashboard driverId={selectedDriverId} />
      </div>
    );
  }

  const { 
    drivers, totalDrivers, onlineDrivers, totalRevenue, totalFreights,
    totalCompleted, totalCancelled, totalActive, totalDistance,
    avgRating, avgAcceptanceRate, avgResponseTime, bestDriver, 
    driversNeedingAttention, monthlyEvolution 
  } = performanceData;

  // Prepare data for charts
  const topDriversByRevenue = drivers.slice(0, 10);
  
  // Radar chart data - metrics for comparison
  const radarMetrics = ['Taxa Conclusão', 'Avaliação', 'Taxa Aceitação', 'No Prazo'];
  const radarData = radarMetrics.map(metric => {
    const dataPoint: any = { metric };
    drivers.slice(0, 5).forEach((driver, idx) => {
      const firstName = driver.driverName.split(' ')[0];
      switch (metric) {
        case 'Taxa Conclusão':
          dataPoint[firstName] = driver.totalFreights > 0 
            ? (driver.completedFreights / driver.totalFreights) * 100 
            : 0;
          break;
        case 'Avaliação':
          dataPoint[firstName] = (driver.averageRating / 5) * 100;
          break;
        case 'Taxa Aceitação':
          dataPoint[firstName] = driver.acceptanceRate;
          break;
        case 'No Prazo':
          dataPoint[firstName] = driver.onTimeRate;
          break;
      }
    });
    return dataPoint;
  });

  // Pie chart - distribution by driver
  const distributionData = drivers.slice(0, 6).map((d, i) => ({
    name: d.driverName.split(' ')[0],
    value: d.totalFreights,
    color: COLORS[i % COLORS.length]
  }));

  // Top routes calculation (from driver names for now - could be enhanced)
  const topRoutes = drivers.slice(0, 5).map(d => ({
    driver: d.driverName,
    freights: d.completedFreights,
    revenue: d.totalRevenue
  }));

  const getPerformanceBadge = (driver: CompanyDriverPerformance) => {
    const score = (driver.averageRating / 5) * 0.4 + 
                  (driver.acceptanceRate / 100) * 0.3 + 
                  (driver.onTimeRate / 100) * 0.3;
    if (score >= 0.8) return { label: 'Excelente', variant: 'default' as const, color: 'bg-green-500' };
    if (score >= 0.6) return { label: 'Bom', variant: 'secondary' as const, color: 'bg-yellow-500' };
    return { label: 'Atenção', variant: 'destructive' as const, color: 'bg-red-500' };
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Nunca';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`;
    return format(date, 'dd/MM HH:mm', { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Performance dos Motoristas Afiliados</h2>
          <p className="text-muted-foreground">Rankings e métricas de desempenho completas</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <TabsList>
            <TabsTrigger value="1m">1 Mês</TabsTrigger>
            <TabsTrigger value="3m">3 Meses</TabsTrigger>
            <TabsTrigger value="6m">6 Meses</TabsTrigger>
            <TabsTrigger value="1y">1 Ano</TabsTrigger>
            <TabsTrigger value="all">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards - 8 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Motoristas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDrivers}</div>
            <p className="text-xs text-green-600 mt-1">
              {onlineDrivers} online agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatBRL(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {formatBRL(totalRevenue / Math.max(totalDrivers, 1))}/motorista
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              De 5.0 possíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Completas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              De {totalFreights} fretes totais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fretes Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalCancelled}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalFreights > 0 ? ((totalCancelled / totalFreights) * 100).toFixed(1) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Aceitação Média</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAcceptanceRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Propostas aceitas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio Resposta</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgResponseTime < 1 
                ? `${(avgResponseTime * 60).toFixed(0)} min` 
                : `${avgResponseTime.toFixed(1)}h`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Para aceitar propostas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fretes Ativos</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalActive}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Em andamento agora
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Highlights Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best Driver of the Period */}
        {bestDriver && (
          <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Award className="h-5 w-5" />
                Melhor Motorista
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg">
                  {bestDriver.driverName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{bestDriver.driverName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBRL(bestDriver.totalRevenue)} • {bestDriver.completedFreights} entregas
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">{bestDriver.averageRating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Growth Card */}
        <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Activity className="h-5 w-5" />
              Estatísticas Gerais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Distância Total</span>
                <span className="font-semibold">{formatKm(totalDistance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Média por Entrega</span>
                <span className="font-semibold">
                  {formatBRL(totalCompleted > 0 ? totalRevenue / totalCompleted : 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Entregas/Motorista</span>
                <span className="font-semibold">
                  {(totalCompleted / Math.max(totalDrivers, 1)).toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drivers Needing Attention */}
        <Card className={driversNeedingAttention.length > 0 
          ? "border-red-500/50 bg-red-50/50 dark:bg-red-950/20" 
          : "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
        }>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-2 ${
              driversNeedingAttention.length > 0 
                ? "text-red-700 dark:text-red-400" 
                : "text-green-700 dark:text-green-400"
            }`}>
              <AlertTriangle className="h-5 w-5" />
              Atenção Necessária
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driversNeedingAttention.length > 0 ? (
              <div className="space-y-2">
                {driversNeedingAttention.slice(0, 3).map(d => (
                  <div key={d.driverId} className="flex items-center justify-between text-sm">
                    <span>{d.driverName.split(' ')[0]}</span>
                    <div className="flex items-center gap-2">
                      {d.averageRating < 3.5 && d.averageRating > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          ⭐ {d.averageRating.toFixed(1)}
                        </Badge>
                      )}
                      {d.totalFreights > 0 && (d.cancelledFreights / d.totalFreights) > 0.2 && (
                        <Badge variant="destructive" className="text-xs">
                          {((d.cancelledFreights / d.totalFreights) * 100).toFixed(0)}% cancel.
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-700 dark:text-green-400">
                ✓ Todos os motoristas com boa performance!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? formatBRL(Number(value)) : value,
                    name === 'revenue' ? 'Receita' : 'Fretes'
                  ]}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="freights" stroke={COLORS[0]} strokeWidth={2} name="Fretes" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke={COLORS[1]} strokeWidth={2} name="Receita" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution by Driver */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Distribuição por Motorista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} fretes`, 'Total']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top 10 por Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topDriversByRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatBRL(v)} />
                <YAxis 
                  dataKey="driverName" 
                  type="category" 
                  width={100}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => v.split(' ')[0]}
                />
                <Tooltip formatter={(value) => formatBRL(Number(value))} />
                <Bar dataKey="totalRevenue" fill={COLORS[0]} name="Receita" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance comparison radar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Comparação de Performance (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                {drivers.slice(0, 5).map((driver, idx) => (
                  <Radar 
                    key={driver.driverId}
                    name={driver.driverName.split(' ')[0]} 
                    dataKey={driver.driverName.split(' ')[0]} 
                    stroke={COLORS[idx]} 
                    fill={COLORS[idx]} 
                    fillOpacity={0.2} 
                  />
                ))}
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ranking Completo de Motoristas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium">#</th>
                  <th className="text-left py-3 px-4 font-medium">Motorista</th>
                  <th className="text-left py-3 px-4 font-medium">Contato</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Entregas</th>
                  <th className="text-right py-3 px-4 font-medium">Cancelados</th>
                  <th className="text-right py-3 px-4 font-medium">No Prazo</th>
                  <th className="text-right py-3 px-4 font-medium">Avaliação</th>
                  <th className="text-right py-3 px-4 font-medium">Receita</th>
                  <th className="text-right py-3 px-4 font-medium">Aceitação</th>
                  <th className="text-right py-3 px-4 font-medium">Resposta</th>
                  <th className="text-center py-3 px-4 font-medium">Performance</th>
                  <th className="text-right py-3 px-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, idx) => {
                  const perfBadge = getPerformanceBadge(driver);
                  return (
                    <tr key={driver.driverId} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-semibold text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {driver.driverName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{driver.driverName}</div>
                            <div className="text-xs text-muted-foreground">
                              {driver.totalFreights} fretes | {driver.activeFreights} ativos
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {driver.driverPhone && (
                            <a 
                              href={`tel:${driver.driverPhone}`}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Phone className="h-3 w-3" />
                              {driver.driverPhone}
                            </a>
                          )}
                          {driver.driverEmail && (
                            <a 
                              href={`mailto:${driver.driverEmail}`}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Mail className="h-3 w-3" />
                              {driver.driverEmail.split('@')[0]}...
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="space-y-1">
                          <Badge variant={driver.isOnline ? "default" : "secondary"} className="text-xs">
                            {driver.isOnline ? '🟢 Online' : '⚫ Offline'}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {formatLastSeen(driver.lastSeen)}
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="font-medium">{driver.completedFreights}</span>
                        <span className="text-muted-foreground">/{driver.totalFreights}</span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className={driver.cancelledFreights > 0 ? "text-red-600" : "text-muted-foreground"}>
                          {driver.cancelledFreights}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline">{driver.onTimeRate.toFixed(0)}%</Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{driver.averageRating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({driver.totalRatings})</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-green-600">
                        {formatBRL(driver.totalRevenue)}
                      </td>
                      <td className="text-right py-3 px-4">
                        <Badge variant={driver.acceptanceRate >= 80 ? "default" : "secondary"}>
                          {driver.acceptanceRate.toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-sm">
                        {driver.responseTime < 1 
                          ? `${(driver.responseTime * 60).toFixed(0)} min` 
                          : `${driver.responseTime.toFixed(1)}h`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={perfBadge.variant}>{perfBadge.label}</Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDriverId(driver.driverId)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {drivers.map((driver, idx) => {
              const perfBadge = getPerformanceBadge(driver);
              return (
                <Card key={driver.driverId} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{driver.driverName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={driver.isOnline ? "default" : "secondary"} className="text-xs">
                            {driver.isOnline ? '🟢 Online' : '⚫ Offline'}
                          </Badge>
                          <Badge variant={perfBadge.variant} className="text-xs">
                            {perfBadge.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDriverId(driver.driverId)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entregas:</span>
                      <span className="font-medium">{driver.completedFreights}/{driver.totalFreights}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cancelados:</span>
                      <span className={driver.cancelledFreights > 0 ? "text-red-600" : ""}>
                        {driver.cancelledFreights}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avaliação:</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{driver.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aceitação:</span>
                      <span>{driver.acceptanceRate.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">Receita:</span>
                      <span className="font-semibold text-green-600">{formatBRL(driver.totalRevenue)}</span>
                    </div>
                  </div>

                  {(driver.driverPhone || driver.driverEmail) && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      {driver.driverPhone && (
                        <a 
                          href={`tel:${driver.driverPhone}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" />
                          {driver.driverPhone}
                        </a>
                      )}
                      {driver.driverEmail && (
                        <a 
                          href={`mailto:${driver.driverEmail}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3 w-3" />
                          Email
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
