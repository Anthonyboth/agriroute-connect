import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { formatBRL, formatKm } from '@/lib/formatters';
import { Users, Truck, DollarSign, TrendingUp, Award } from 'lucide-react';
import { UI_TEXTS } from '@/lib/ui-texts';
import { FreightReportExporter } from './FreightReportExporter';
import { useFreightReportData } from '@/hooks/useFreightReportData';

interface CompanyAnalyticsDashboardProps {
  assignments: any[];
  drivers: any[];
  timeRange: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange: (range: 'week' | 'month' | 'quarter' | 'year') => void;
}

export const CompanyAnalyticsDashboard: React.FC<CompanyAnalyticsDashboardProps> = ({
  assignments,
  drivers,
  timeRange,
  onTimeRangeChange
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  const analyticsData = useMemo(() => {
    const now = new Date();
    
    // Filtrar por período
    const filteredAssignments = assignments.filter(a => {
      const date = new Date(a.accepted_at || a.created_at);
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
    
    // Se driver específico selecionado, filtrar
    const relevantAssignments = selectedDriverId
      ? filteredAssignments.filter(a => a.driver_id === selectedDriverId)
      : filteredAssignments;
    
    // Métricas por motorista
    const driverStats = drivers.map(driver => {
      const driverAssignments = relevantAssignments.filter(a => a.driver_id === driver.driver_profile_id);
      const completedTrips = driverAssignments.filter(a => 
        ['DELIVERED', 'COMPLETED'].includes(a.status)
      ).length;
      const totalRevenue = driverAssignments.reduce((sum, a) => 
        sum + (a.freight?.price || 0), 0
      );
      const avgRating = driver.driver_profile?.rating || 0;
      
      return {
        driverId: driver.driver_profile_id,
        driverName: driver.driver_profile?.full_name || 'Desconhecido',
        completedTrips,
        totalRevenue,
        avgRating,
        activeTrips: driverAssignments.filter(a => 
          ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'].includes(a.status)
        ).length
      };
    });
    
    // Fretes por mês
    const byMonth = relevantAssignments.reduce((acc, a) => {
      const date = new Date(a.accepted_at || a.created_at);
      const month = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      if (!acc[month]) {
        acc[month] = { month, count: 0, revenue: 0, distance: 0 };
      }
      acc[month].count++;
      acc[month].revenue += a.freight?.price || 0;
      acc[month].distance += a.freight?.distance_km || 0;
      
      return acc;
    }, {} as Record<string, any>);
    
    const freightsByMonth = Object.values(byMonth).sort((a: any, b: any) =>
      new Date(a.month).getTime() - new Date(b.month).getTime()
    );
    
    // Status distribution
    const byStatus = relevantAssignments.reduce((acc, a) => {
      const status = a.status || 'UNKNOWN';
      if (!acc[status]) {
        acc[status] = { status, count: 0 };
      }
      acc[status].count++;
      return acc;
    }, {} as Record<string, any>);
    
    const freightsByStatus = Object.values(byStatus);
    
    // Totais
    const totalRevenue = relevantAssignments.reduce((sum, a) => sum + (a.freight?.price || 0), 0);
    const totalDistance = relevantAssignments.reduce((sum, a) => sum + (a.freight?.distance_km || 0), 0);
    const totalTrips = relevantAssignments.length;
    const activeDriversCount = driverStats.filter(d => d.activeTrips > 0).length;
    
    return {
      freightsByMonth,
      freightsByStatus,
      driverStats,
      totalRevenue,
      totalDistance,
      totalTrips,
      activeDriversCount,
      avgPrice: totalTrips > 0 ? totalRevenue / totalTrips : 0
    };
  }, [assignments, drivers, timeRange, selectedDriverId]);
  
  // Preparar dados para relatório
  const freightsForReport = assignments.map(a => a.freight).filter(Boolean);
  const reportData = useFreightReportData(freightsForReport);
  
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];
  
  return (
    <div className="space-y-6" translate="no">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <CardTitle>Analytics da Transportadora</CardTitle>
              <Tabs value={timeRange} onValueChange={(v) => onTimeRangeChange(v as any)}>
                <TabsList>
                  <TabsTrigger value="week">Semana</TabsTrigger>
                  <TabsTrigger value="month">Mês</TabsTrigger>
                  <TabsTrigger value="quarter">Trimestre</TabsTrigger>
                  <TabsTrigger value="year">Ano</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <FreightReportExporter
              data={reportData}
              reportTitle="Relatório de Fretes - Transportadora"
            />
          </div>
        </CardHeader>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motoristas Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.activeDriversCount}</div>
            <p className="text-xs text-muted-foreground">de {drivers.length} total</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fretes Completados</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalTrips}</div>
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
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(analyticsData.avgPrice)}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Driver Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Individual dos Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Motorista</th>
                  <th className="text-center py-3 px-4">Viagens Completas</th>
                  <th className="text-center py-3 px-4">Em Andamento</th>
                  <th className="text-right py-3 px-4">Receita Total</th>
                  <th className="text-center py-3 px-4">Avaliação</th>
                  <th className="text-center py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.driverStats.map((driver) => (
                  <tr key={driver.driverId} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{driver.driverName}</td>
                    <td className="text-center py-3 px-4">{driver.completedTrips}</td>
                    <td className="text-center py-3 px-4">
                      <span className={driver.activeTrips > 0 ? 'text-green-600 font-semibold' : ''}>
                        {driver.activeTrips}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">{formatBRL(driver.totalRevenue)}</td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span>{driver.avgRating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDriverId(
                          selectedDriverId === driver.driverId ? null : driver.driverId
                        )}
                      >
                        {selectedDriverId === driver.driverId ? 'Ver Todos' : 'Ver Detalhes'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Line Chart - Evolução de Fretes */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDriverId 
              ? `Evolução - ${analyticsData.driverStats.find(d => d.driverId === selectedDriverId)?.driverName}`
              : 'Evolução de Fretes da Frota'
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.freightsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
              <YAxis stroke="hsl(var(--foreground))" />
              <Tooltip contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }} />
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
      
      {/* Bar Chart - Receita por Período */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.freightsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
              <YAxis stroke="hsl(var(--foreground))" />
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
      
      {/* Pie Chart - Status Distribution */}
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
              <Tooltip contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
