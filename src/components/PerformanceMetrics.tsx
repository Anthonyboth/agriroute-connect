import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Calendar, DollarSign, Truck, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface MetricData {
  period: string;
  value: number;
  metric_type: string;
}

interface FreightStats {
  total_freights: number;
  completed_freights: number;
  average_rating: number;
  total_earnings: number;
  completion_rate: number;
}

interface ChartData {
  month: string;
  freights: number;
  earnings: number;
}

export const PerformanceMetrics = () => {
  const [period, setPeriod] = useState('6months');
  const [stats, setStats] = useState<FreightStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Calculate period dates
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '3months':
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case '6months':
          startDate.setMonth(endDate.getMonth() - 6);
          break;
        case '1year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(endDate.getMonth() - 6);
      }

      // Fetch freight data based on user role
      let freightQuery = supabase.from('freights').select('*');
      
      if (profile.role === 'MOTORISTA') {
        freightQuery = freightQuery.eq('driver_id', profile.id);
      } else {
        freightQuery = freightQuery.eq('producer_id', profile.id);
      }

      const { data: freights, error: freightError } = await freightQuery
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (freightError) throw freightError;

      // Calculate basic stats
      const totalFreights = freights?.length || 0;
      const completedFreights = freights?.filter(f => f.status === 'DELIVERED').length || 0;
      const totalEarnings = freights?.reduce((sum, f) => sum + (f.price || 0), 0) || 0;
      const completionRate = totalFreights > 0 ? (completedFreights / totalFreights) * 100 : 0;

      // Get average rating
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_user_id', profile.id);

      const averageRating = ratings?.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;

      setStats({
        total_freights: totalFreights,
        completed_freights: completedFreights,
        average_rating: averageRating,
        total_earnings: totalEarnings,
        completion_rate: completionRate
      });

      // Generate chart data (monthly breakdown)
      const monthlyData: { [key: string]: { freights: number; earnings: number } } = {};
      
      freights?.forEach(freight => {
        const month = new Date(freight.created_at).toLocaleDateString('pt-BR', { 
          year: 'numeric', 
          month: 'short' 
        });
        
        if (!monthlyData[month]) {
          monthlyData[month] = { freights: 0, earnings: 0 };
        }
        
        monthlyData[month].freights += 1;
        monthlyData[month].earnings += freight.price || 0;
      });

      const chartArray: ChartData[] = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        freights: data.freights,
        earnings: data.earnings
      }));

      setChartData(chartArray);

    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar métricas de desempenho",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statusData = stats ? [
    { name: 'Concluídos', value: stats.completed_freights, color: '#00C49F' },
    { name: 'Outros', value: stats.total_freights - stats.completed_freights, color: '#FFBB28' }
  ] : [];

  useEffect(() => {
    fetchPerformanceData();
  }, [period]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Carregando métricas de desempenho...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Relatórios de Desempenho</h1>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3months">Últimos 3 meses</SelectItem>
            <SelectItem value="6months">Últimos 6 meses</SelectItem>
            <SelectItem value="1year">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Total de Fretes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_freights || 0}</div>
            <div className="text-sm text-muted-foreground">
              {stats?.completed_freights || 0} concluídos
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Faturamento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(stats?.total_earnings || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">
              Média: R$ {stats?.total_freights ? (stats.total_earnings / stats.total_freights).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Taxa de Conclusão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.completion_rate || 0).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">
              {stats?.completed_freights || 0} de {stats?.total_freights || 0} fretes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4" />
              Avaliação Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.average_rating || 0).toFixed(1)}</div>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= (stats?.average_rating || 0) 
                      ? 'text-yellow-400 fill-current' 
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Fretes por Mês */}
        <Card>
          <CardHeader>
            <CardTitle>Fretes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="freights" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Faturamento */}
        <Card>
          <CardHeader>
            <CardTitle>Faturamento por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                />
                <Line type="monotone" dataKey="earnings" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Pizza - Status dos Fretes */}
      {statusData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Status dos Fretes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Indicadores Chave:</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Taxa de Conclusão:</span>
                  <Badge variant={stats && stats.completion_rate >= 80 ? "default" : "secondary"}>
                    {(stats?.completion_rate || 0).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avaliação Média:</span>
                  <Badge variant={stats && stats.average_rating >= 4 ? "default" : "secondary"}>
                    {(stats?.average_rating || 0).toFixed(1)} ⭐
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Fretes por Mês:</span>
                  <Badge variant="outline">
                    {stats?.total_freights ? Math.round(stats.total_freights / (parseInt(period.replace(/\D/g, '')) || 6)) : 0}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Oportunidades de Melhoria:</h3>
              <div className="space-y-2 text-sm">
                {stats && stats.completion_rate < 80 && (
                  <p>• Melhore sua taxa de conclusão para aumentar sua credibilidade</p>
                )}
                {stats && stats.average_rating < 4 && (
                  <p>• Foque na qualidade do serviço para melhorar suas avaliações</p>
                )}
                {stats && stats.total_freights < 10 && (
                  <p>• Busque mais oportunidades de frete para aumentar sua atividade</p>
                )}
                {stats && stats.completion_rate >= 80 && stats.average_rating >= 4 && stats.total_freights >= 10 && (
                  <p>• Excelente performance! Continue mantendo a qualidade</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};