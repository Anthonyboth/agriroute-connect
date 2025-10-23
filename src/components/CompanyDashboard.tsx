import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanyFreightStats } from './CompanyFreightStats';
import { FreightCard } from './FreightCard';
import { MyAssignmentCard } from './MyAssignmentCard';
import { SafeListWrapper } from './SafeListWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Truck, MapPin, RefreshCw, BarChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CompanyDashboardProps {
  onNavigateToReport?: (tab: string) => void;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ onNavigateToReport }) => {
  const { company, drivers } = useTransportCompany();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFreights: 0,
    activeFreights: 0,
    activeDrivers: 0,
    totalEarnings: 0,
    pendingProposals: 0,
  });
  const [availableFreights, setAvailableFreights] = useState<any[]>([]);
  const [activeFreights, setActiveFreights] = useState<any[]>([]);
  const [activeDriversList, setActiveDriversList] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!company?.id || !profile?.id) return;

    try {
      setLoading(true);

      // Buscar fretes da empresa
      const { data: companyFreights } = await supabase
        .from('freights')
        .select('*, producer:profiles!freights_producer_id_fkey(id, full_name)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      const freights = companyFreights || [];

      // Buscar assignments ativos
      const { data: assignments } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          freight:freights(*),
          driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone)
        `)
        .eq('company_id', company.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED']);

      // Buscar propostas pendentes
      const { data: proposals } = await supabase
        .from('freight_proposals')
        .select('*')
        .in('freight_id', freights.map(f => f.id))
        .eq('status', 'PENDING');

      // Calcular stats
      const active = freights.filter(f => 
        ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'].includes(f.status)
      );
      const available = freights.filter(f => f.status === 'OPEN');
      
      // Ganhos: somar apenas fretes entregues
      const delivered = freights.filter(f => f.status === 'DELIVERED');
      const totalEarnings = delivered.reduce((sum, f) => sum + (f.price || 0), 0);

      // Motoristas ativos (únicos)
      const uniqueDrivers = new Set(
        (assignments || []).map(a => a.driver_id).filter(Boolean)
      );

      setStats({
        totalFreights: freights.length,
        activeFreights: active.length + (assignments?.length || 0),
        activeDrivers: uniqueDrivers.size,
        totalEarnings,
        pendingProposals: proposals?.length || 0,
      });

      setAvailableFreights(available.slice(0, 3));
      setActiveFreights((assignments || []).slice(0, 5));

      // Motoristas ativos com últimos fretes
      const activeDriversData = Array.from(uniqueDrivers).map(driverId => {
        const driverAssignments = (assignments || []).filter(a => a.driver_id === driverId);
        const lastAssignment = driverAssignments[0];
        return {
          id: driverId,
          name: lastAssignment?.driver?.full_name || 'Motorista',
          phone: lastAssignment?.driver?.contact_phone,
          activeFreights: driverAssignments.length,
          lastFreight: lastAssignment?.freight?.origin_city 
            ? `${lastAssignment.freight.origin_city} → ${lastAssignment.freight.destination_city}`
            : 'N/A'
        };
      });

      setActiveDriversList(activeDriversData);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [company?.id, profile?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime: atualizar quando houver mudanças
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel('company-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchDashboardData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, fetchDashboardData]);

  if (!company) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {company.company_name}
              </CardTitle>
              <CardDescription>
                CNPJ: {company.company_cnpj}
                {company.status === 'PENDING' && (
                  <Badge variant="outline" className="ml-2">Aguardando Aprovação</Badge>
                )}
                {company.status === 'APPROVED' && (
                  <Badge variant="default" className="ml-2">Aprovado</Badge>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDashboardData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <CompanyFreightStats
        totalFreights={stats.totalFreights}
        activeFreights={stats.activeFreights}
        activeDrivers={stats.activeDrivers}
        totalEarnings={stats.totalEarnings}
        pendingProposals={stats.pendingProposals}
      />

      {/* Card de Relatórios */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-blue-600" />
            Relatórios
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-muted-foreground">
            Acompanhe métricas detalhadas e exporte relatórios.
          </p>
          <Button onClick={() => onNavigateToReport?.('reports')}>
            <BarChart className="h-4 w-4 mr-2" />
            Abrir Relatórios
          </Button>
        </CardContent>
      </Card>

      {/* Fretes Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-green-600" />
            Fretes Disponíveis
          </CardTitle>
          <CardDescription>
            Últimos fretes abertos aguardando motoristas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableFreights.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum frete disponível no momento
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground">Atualizando fretes...</div>}>
                {availableFreights.map((freight) => (
                  <FreightCard
                    key={freight.id}
                    freight={freight}
                    onAction={() => {}}
                  />
                ))}
              </SafeListWrapper>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fretes em Andamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-blue-600" />
            Fretes em Andamento
          </CardTitle>
          <CardDescription>
            Fretes atualmente sendo transportados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeFreights.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum frete em andamento
            </p>
          ) : (
            <div className="space-y-4">
              <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground">Atualizando fretes ativos...</div>}>
                {activeFreights.map((assignment) => (
                  <MyAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onAction={() => {}}
                  />
                ))}
              </SafeListWrapper>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Motoristas Ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-purple-600" />
            Motoristas Ativos
          </CardTitle>
          <CardDescription>
            Motoristas com fretes em andamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeDriversList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum motorista ativo no momento
            </p>
          ) : (
            <div className="space-y-3">
              <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground">Atualizando motoristas...</div>}>
                {activeDriversList.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{driver.name}</p>
                      <p className="text-sm text-muted-foreground">{driver.lastFreight}</p>
                      {driver.phone && (
                        <p className="text-xs text-muted-foreground">{driver.phone}</p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {driver.activeFreights} {driver.activeFreights === 1 ? 'frete' : 'fretes'}
                    </Badge>
                  </div>
                ))}
              </SafeListWrapper>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
