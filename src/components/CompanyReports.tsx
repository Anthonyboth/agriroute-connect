import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Truck, 
  DollarSign,
  Calendar,
  Package,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CompanyStats {
  total_drivers: number;
  active_drivers: number;
  total_vehicles: number;
  active_vehicles: number;
  total_freights: number;
  completed_freights: number;
  active_freights: number;
  total_revenue: number;
}

export function CompanyReports() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<CompanyStats>({
    total_drivers: 0,
    active_drivers: 0,
    total_vehicles: 0,
    active_vehicles: 0,
    total_freights: 0,
    completed_freights: 0,
    active_freights: 0,
    total_revenue: 0
  });
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadCompanyStats();
    }
  }, [profile?.id]);

  const loadCompanyStats = async () => {
    setLoading(true);
    try {
      // Get company ID
      const { data: companyData } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profile?.id)
        .single();

      if (!companyData) return;
      
      setCompanyId(companyData.id);

      // Get driver stats
      const { data: driversData } = await supabase
        .from('company_drivers')
        .select('status')
        .eq('company_id', companyData.id);

      const totalDrivers = driversData?.length || 0;
      const activeDrivers = driversData?.filter(d => d.status === 'ACTIVE').length || 0;

      // Get vehicle stats
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id')
        .eq('company_id', companyData.id);

      const totalVehicles = vehiclesData?.length || 0;
      const activeVehicles = totalVehicles; // All vehicles considered active for now

      // Get freight stats
      const { data: freightsData } = await supabase
        .from('freights')
        .select('status, price')
        .eq('company_id', companyData.id);

      const totalFreights = freightsData?.length || 0;
      const completedFreights = freightsData?.filter(f => f.status === 'DELIVERED').length || 0;
      const activeFreights = freightsData?.filter(f => 
        ['ACCEPTED', 'IN_TRANSIT'].includes(f.status)
      ).length || 0;
      
      const totalRevenue = freightsData
        ?.filter(f => f.status === 'DELIVERED')
        .reduce((sum, f) => sum + (f.price || 0), 0) || 0;

      setStats({
        total_drivers: totalDrivers,
        active_drivers: activeDrivers,
        total_vehicles: totalVehicles,
        active_vehicles: activeVehicles,
        total_freights: totalFreights,
        completed_freights: completedFreights,
        active_freights: activeFreights,
        total_revenue: totalRevenue
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={`report-skeleton-${i}`}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Relatórios e Estatísticas
        </h2>
        <Button onClick={loadCompanyStats} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Motoristas</p>
                <p className="text-2xl font-bold text-blue-800">
                  {stats.active_drivers} / {stats.total_drivers}
                </p>
                <p className="text-xs text-blue-600">Ativos / Total</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Veículos</p>
                <p className="text-2xl font-bold text-purple-800">
                  {stats.active_vehicles} / {stats.total_vehicles}
                </p>
                <p className="text-xs text-purple-600">Ativos / Total</p>
              </div>
              <Truck className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">Fretes</p>
                <p className="text-2xl font-bold text-amber-800">
                  {stats.active_freights}
                </p>
                <p className="text-xs text-amber-600">
                  {stats.completed_freights} concluídos
                </p>
              </div>
              <Package className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Receita Total</p>
                <p className="text-2xl font-bold text-green-800">
                  R$ {stats.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600">Fretes concluídos</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumo de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div>
                <p className="font-medium">Taxa de Conclusão de Fretes</p>
                <p className="text-sm text-muted-foreground">
                  Fretes concluídos vs total
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {stats.total_freights > 0 
                    ? Math.round((stats.completed_freights / stats.total_freights) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div>
                <p className="font-medium">Valor Médio por Frete</p>
                <p className="text-sm text-muted-foreground">
                  Receita total / fretes concluídos
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  R$ {stats.completed_freights > 0
                    ? (stats.total_revenue / stats.completed_freights).toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })
                    : '0,00'}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 border rounded-lg">
              <div>
                <p className="font-medium">Taxa de Utilização da Frota</p>
                <p className="text-sm text-muted-foreground">
                  Veículos ativos vs total
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {stats.total_vehicles > 0
                    ? Math.round((stats.active_vehicles / stats.total_vehicles) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
