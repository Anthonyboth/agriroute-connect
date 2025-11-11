import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyDriverPerformance } from '@/hooks/useCompanyDriverPerformance';
import { BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Star, TrendingUp, CheckCircle, Clock, Users, Phone, Eye } from 'lucide-react';
import { formatBRL } from '@/lib/formatters';
import { DriverPerformanceDashboard } from './DriverPerformanceDashboard';

interface CompanyDriverPerformanceDashboardProps {
  companyId: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const CompanyDriverPerformanceDashboard = ({ companyId }: CompanyDriverPerformanceDashboardProps) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const { data: performance, isLoading } = useCompanyDriverPerformance(companyId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!performance || performance.length === 0) {
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

  // Calculate totals
  const totalDrivers = performance.length;
  const onlineDrivers = performance.filter(d => d.isOnline).length;
  const totalRevenue = performance.reduce((sum, d) => sum + d.totalRevenue, 0);
  const avgRating = performance.reduce((sum, d) => sum + d.averageRating, 0) / performance.length;
  const totalCompleted = performance.reduce((sum, d) => sum + d.completedFreights, 0);

  // Prepare data for charts
  const topDriversByRevenue = performance.slice(0, 10);
  
  // Prepare radar chart data for top 5 drivers
  const radarData = performance.slice(0, 5).map(driver => ({
    driver: driver.driverName.split(' ')[0], // First name only
    'Taxa Conclusão': driver.completedFreights > 0 ? (driver.completedFreights / driver.totalFreights) * 100 : 0,
    'Avaliação': (driver.averageRating / 5) * 100,
    'Taxa Aceitação': driver.acceptanceRate,
    'Entregas no Prazo': driver.onTimeRate,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Performance dos Motoristas Afiliados</h2>
        <p className="text-muted-foreground">Rankings e métricas de desempenho</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Motoristas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDrivers}</div>
            <p className="text-xs text-muted-foreground mt-1">
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
            <div className="text-2xl font-bold">{formatBRL(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gerado por todos os motoristas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              De todos os motoristas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Completas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de fretes finalizados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue ranking */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Motoristas por Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topDriversByRevenue} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="driverName" type="category" width={100} />
                <Tooltip formatter={(value) => formatBRL(Number(value))} />
                <Legend />
                <Bar dataKey="totalRevenue" fill={COLORS[0]} name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance comparison radar */}
        <Card>
          <CardHeader>
            <CardTitle>Comparação de Performance (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="driver" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="Métricas" dataKey="Taxa Conclusão" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Drivers table */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking Completo de Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Motorista</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4">Entregas</th>
                  <th className="text-right py-3 px-4">No Prazo</th>
                  <th className="text-right py-3 px-4">Avaliação</th>
                  <th className="text-right py-3 px-4">Receita</th>
                  <th className="text-right py-3 px-4">Taxa Aceitação</th>
                  <th className="text-right py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((driver, idx) => (
                  <tr key={driver.driverId} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{driver.driverName}</div>
                        {driver.driverPhone && (
                          <a 
                            href={`tel:${driver.driverPhone}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {driver.completedFreights} completos | {driver.activeFreights} ativos
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={driver.isOnline ? "default" : "secondary"}>
                        {driver.isOnline ? '🟢 Online' : '⚫ Offline'}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4 font-medium">{driver.totalFreights}</td>
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
                    <td className="text-right py-3 px-4 font-semibold">
                      {formatBRL(driver.totalRevenue)}
                    </td>
                    <td className="text-right py-3 px-4">
                      <Badge variant={driver.acceptanceRate >= 80 ? "default" : "secondary"}>
                        {driver.acceptanceRate.toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDriverId(driver.driverId)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
