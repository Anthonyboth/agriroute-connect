import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDriverPerformance } from '@/hooks/useDriverPerformance';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Star, TrendingUp, CheckCircle, Clock, MapPin, Package, Calendar } from 'lucide-react';
import { formatBRL, formatDate } from '@/lib/formatters';
import { getFreightStatusLabel } from '@/lib/freight-status';

interface DriverPerformanceDashboardProps {
  driverId: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const DriverPerformanceDashboard = ({ driverId }: DriverPerformanceDashboardProps) => {
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');

  // Guard: Se driverId estiver vazio, mostrar loading
  if (!driverId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  if (period === '1m') startDate.setMonth(startDate.getMonth() - 1);
  else if (period === '3m') startDate.setMonth(startDate.getMonth() - 3);
  else if (period === '6m') startDate.setMonth(startDate.getMonth() - 6);
  else if (period === '1y') startDate.setFullYear(startDate.getFullYear() - 1);

  const { data: performance, isLoading } = useDriverPerformance(
    driverId,
    period === 'all' ? undefined : startDate,
    period === 'all' ? undefined : endDate
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Se não há dados mas o hook carregou, verificar se temos alguma info
  const hasAnyData = performance && (
    performance.totalFreights > 0 || 
    performance.totalRevenue > 0 || 
    performance.totalRatings > 0
  );

  if (!performance) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Não foi possível carregar os dados</p>
        <p className="text-sm mt-2">Tente novamente mais tarde</p>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Dados de performance não disponíveis</p>
        <p className="text-sm mt-2">Complete alguns fretes para ver suas estatísticas</p>
      </div>
    );
  }

  // Prepare status distribution for pie chart
  const statusData = [
    { name: 'Completos', value: performance.completedFreights, color: COLORS[0] },
    { name: 'Cancelados', value: performance.cancelledFreights, color: COLORS[1] },
    { name: 'Outros', value: performance.totalFreights - performance.completedFreights - performance.cancelledFreights, color: COLORS[2] }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{performance.driverName}</h2>
          <p className="text-muted-foreground">Performance de entregas e avaliações</p>
        </div>

        {/* Period selector */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="1m">1 Mês</TabsTrigger>
            <TabsTrigger value="3m">3 Meses</TabsTrigger>
            <TabsTrigger value="6m">6 Meses</TabsTrigger>
            <TabsTrigger value="1y">1 Ano</TabsTrigger>
            <TabsTrigger value="all">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{performance.averageRating.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">/ 5.0</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {performance.totalRatings} avaliações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {performance.completedFreights} de {performance.totalFreights} fretes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas no Prazo</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performance.onTimeRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {performance.onTimeFreights} entregas pontuais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBRL(performance.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Em {performance.completedFreights} fretes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly evolution */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performance.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="freights" stroke={COLORS[0]} name="Fretes" />
                <Line type="monotone" dataKey="avgRating" stroke={COLORS[1]} name="Avaliação" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by month */}
        <Card>
          <CardHeader>
            <CardTitle>Receita Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performance.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatBRL(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" fill={COLORS[2]} name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top routes */}
        <Card>
          <CardHeader>
            <CardTitle>Rotas Mais Frequentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {performance.topRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma rota registrada
                </p>
              ) : (
                performance.topRoutes.map((route, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{route.origin} → {route.destination}</p>
                        <p className="text-xs text-muted-foreground">{route.count} viagens</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatBRL(route.totalRevenue)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent deliveries */}
      <Card>
        <CardHeader>
          <CardTitle>Entregas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performance.recentDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma entrega registrada
              </p>
            ) : (
              performance.recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{delivery.cargo_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.origin_city} → {delivery.destination_city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge variant="secondary">{getFreightStatusLabel(delivery.status)}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(delivery.pickup_date)}
                      </p>
                    </div>
                    {delivery.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{delivery.rating.toFixed(1)}</span>
                      </div>
                    )}
                    <p className="text-sm font-semibold">{formatBRL(delivery.price)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
