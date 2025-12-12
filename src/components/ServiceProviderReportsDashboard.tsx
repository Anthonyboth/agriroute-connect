import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceProviderPerformance } from '@/hooks/useServiceProviderPerformance';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Star, TrendingUp, CheckCircle, Clock, MapPin, Wrench, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { formatBRL, formatDate } from '@/lib/formatters';

interface ServiceProviderReportsDashboardProps {
  providerId: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'OPEN': 'Aberto',
    'ACCEPTED': 'Aceito',
    'IN_PROGRESS': 'Em Andamento',
    'COMPLETED': 'Concluído',
    'CANCELLED': 'Cancelado'
  };
  return statusMap[status] || status;
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'COMPLETED': return 'default';
    case 'CANCELLED': return 'destructive';
    case 'IN_PROGRESS': 
    case 'ACCEPTED': return 'secondary';
    default: return 'outline';
  }
};

export const ServiceProviderReportsDashboard = ({ providerId }: ServiceProviderReportsDashboardProps) => {
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');

  // Guard: Se providerId estiver vazio, mostrar loading
  if (!providerId) {
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

  const { data: performance, isLoading } = useServiceProviderPerformance(
    providerId,
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
    performance.totalServices > 0 || 
    performance.totalRevenue > 0 || 
    performance.totalRatings > 0
  );

  if (!performance) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p>Não foi possível carregar os dados</p>
        <p className="text-sm mt-2">Tente novamente mais tarde</p>
      </div>
    );
  }

  if (!hasAnyData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <p>Dados de performance não disponíveis</p>
        <p className="text-sm mt-2">Complete alguns serviços para ver suas estatísticas</p>
      </div>
    );
  }

  // Prepare status distribution for pie chart
  const statusData = [
    { name: 'Concluídos', value: performance.completedServices, color: COLORS[0] },
    { name: 'Cancelados', value: performance.cancelledServices, color: COLORS[1] },
    { name: 'Em Andamento', value: performance.inProgressServices, color: COLORS[2] }
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{performance.providerName}</h2>
          <p className="text-muted-foreground text-sm">Performance de serviços e avaliações</p>
        </div>

        {/* Period selector */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="1m" className="text-xs px-2">1 Mês</TabsTrigger>
            <TabsTrigger value="3m" className="text-xs px-2">3 Meses</TabsTrigger>
            <TabsTrigger value="6m" className="text-xs px-2">6 Meses</TabsTrigger>
            <TabsTrigger value="1y" className="text-xs px-2">1 Ano</TabsTrigger>
            <TabsTrigger value="all" className="text-xs px-2">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/10 border-yellow-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Avaliação Média</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-xl sm:text-2xl font-bold">{performance.averageRating.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">/ 5.0</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {performance.totalRatings || 0} avaliações
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Taxa de Conclusão</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{performance.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {performance.completedServices} de {performance.totalServices} serviços
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {performance.averageServiceTime > 0 ? `${performance.averageServiceTime.toFixed(1)}h` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Por serviço
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {formatBRL(performance.totalRevenue, true)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Em {performance.completedServices} serviços
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly evolution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {performance.monthlyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={performance.monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="services" stroke={COLORS[0]} name="Serviços" strokeWidth={2} />
                  <Line type="monotone" dataKey="avgRating" stroke={COLORS[1]} name="Avaliação" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados suficientes para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Receita Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {performance.monthlyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={performance.monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value) => formatBRL(Number(value), true)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill={COLORS[2]} name="Receita" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados suficientes para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service type distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Tipos de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {performance.serviceTypeDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={performance.serviceTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="type"
                  >
                    {performance.serviceTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value} serviços (${formatBRL(props.payload.revenue, true)})`,
                      props.payload.type
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados suficientes para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top cities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Cidades Mais Atendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {performance.topCities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma cidade registrada
                </p>
              ) : (
                performance.topCities.map((city, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {idx + 1}
                      </div>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{city.city}</p>
                        <p className="text-xs text-muted-foreground">{city.count} serviços</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{formatBRL(city.revenue, true)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent services */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Serviços Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performance.recentServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum serviço registrado
              </p>
            ) : (
              performance.recentServices.map((service) => (
                <div key={service.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{service.service_type}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {service.city_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 ml-8 sm:ml-0">
                    <div className="text-right">
                      <Badge variant={getStatusVariant(service.status)} className="text-xs">
                        {getStatusLabel(service.status)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(service.created_at)}
                      </p>
                    </div>
                    {service.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{service.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {service.final_price && (
                      <p className="text-sm font-semibold text-green-600">{formatBRL(service.final_price, true)}</p>
                    )}
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
