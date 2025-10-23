import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverPerformanceTabProps {
  driverProfileId: string;
}

export const DriverPerformanceTab = ({ driverProfileId }: DriverPerformanceTabProps) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['driver-performance', driverProfileId],
    queryFn: async () => {
      // Get freight stats - simplified query
      const { data: freights, error: freightsError } = await supabase
        .from('freights')
        .select('id, status, price, created_at')
        .eq('driver_id', driverProfileId);

      if (freightsError) throw freightsError;

      const totalFreights = freights?.length || 0;
      const completedFreights = freights?.filter(f => f.status === 'COMPLETED').length || 0;
      const totalRevenue = freights
        ?.filter(f => f.status === 'COMPLETED')
        .reduce((sum, f) => sum + (Number(f.price) || 0), 0) || 0;

      return {
        totalFreights,
        completedFreights,
        totalRevenue,
        rating: 0,
        totalRatings: 0,
        avgDeliveryTime: 0,
        completionRate: totalFreights > 0 ? (completedFreights / totalFreights) * 100 : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-8 text-muted-foreground">Dados não disponíveis</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{stats.rating.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">/ 5.0</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalRatings} avaliações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completedFreights} de {stats.totalFreights} fretes
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
              R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Em {stats.completedFreights} fretes concluídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Entrega</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgDeliveryTime > 0 ? `${stats.avgDeliveryTime} dias` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Baseado em fretes concluídos
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
