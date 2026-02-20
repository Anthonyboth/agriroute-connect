import React, { useState, useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HeroActionButton } from '@/components/ui/hero-action-button';
import { StatsCard } from '@/components/ui/stats-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Settings, 
  MapPin, 
  Brain, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  Eye,
  EyeOff,
  Wrench,
  Target
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ServiceProviderServiceTypeManager } from '@/components/ServiceProviderServiceTypeManager';
import { UserCityManager } from '@/components/UserCityManager';
import { ServicesModal } from '@/components/ServicesModal';
import { useToast } from '@/hooks/use-toast';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { SISTEMA_IA_LABEL } from '@/lib/ui-labels';
import { useHeroBackground } from '@/hooks/useHeroBackground';

interface ServiceProviderStats {
  total_requests: number;
  pending_requests: number;
  accepted_requests: number;
  completed_requests: number;
  total_earnings: number;
}

export const ServiceProviderHeroDashboard: React.FC = () => {
  const { profile, profiles } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ServiceProviderStats>({
    total_requests: 0,
    pending_requests: 0,
    accepted_requests: 0,
    completed_requests: 0,
    total_earnings: 0
  });
  const { visible: showEarnings, toggle: toggleEarnings } = useEarningsVisibility(false);
  const [showServiceTypesModal, setShowServiceTypesModal] = useState(false);
  const [showAreasModal, setShowAreasModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { desktopUrl: heroDesktop, mobileUrl: heroMobile } = useHeroBackground();

  const getProviderProfileId = () => {
    if (profile?.role === 'PRESTADOR_SERVICOS') return profile.id;
    const alt = (profiles || []).find((p: any) => p.role === 'PRESTADOR_SERVICOS');
    return alt?.id as string | undefined;
  };

  useEffect(() => {
    fetchStats();
  }, [profile, profiles]);

  // Real-time subscription para user_cities
  useEffect(() => {
    const providerProfileId = getProviderProfileId();
    if (!providerProfileId || !profile?.user_id) return;

    const channel = supabase
      .channel('provider-hero-user-cities')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_cities',
        filter: `user_id=eq.${profile.user_id}`
      }, (payload) => {
        if (import.meta.env.DEV) console.log('user_cities mudou no hero dashboard:', payload);
        fetchStats(); // Atualizar estatísticas quando cidades mudam
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.user_id]);

  const fetchStats = async () => {
    const providerProfileId = getProviderProfileId();
    if (!providerProfileId) {
      setStats({
        total_requests: 0,
        pending_requests: 0,
        accepted_requests: 0,
        completed_requests: 0,
        total_earnings: 0
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data: requestStats, error: statsError } = await supabase
        .from('service_requests')
        .select('status, final_price')
        .eq('provider_id', providerProfileId);

      if (statsError) throw statsError;

      const totalRequests = requestStats?.length || 0;
      const pendingRequests = requestStats?.filter(r => r.status === 'PENDING').length || 0;
      const acceptedRequests = requestStats?.filter(r => r.status === 'ACCEPTED').length || 0;
      const completedRequests = requestStats?.filter(r => r.status === 'COMPLETED').length || 0;
      const totalEarnings = requestStats?.filter(r => r.final_price).reduce((sum, r) => sum + (r.final_price || 0), 0) || 0;

      setStats({
        total_requests: totalRequests,
        pending_requests: pendingRequests,
        accepted_requests: acceptedRequests,
        completed_requests: completedRequests,
        total_earnings: totalEarnings
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar estatísticas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const userName = profile?.full_name || 'Prestador';
  const firstName = userName.split(' ')[0];

  if (loading) {
    return <CenteredSpinner className="py-12" />;
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background">
      {/* Hero Section — padrão app: min-h-[220px] com imagem visível */}
      <section className="relative min-h-[220px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <picture className="absolute inset-0">
          <source media="(max-width: 640px)" srcSet={heroMobile} type="image/webp" />
          <img 
            src={heroDesktop}
            alt="Imagem de fundo"
            className="w-full h-full object-cover animate-fade-in"
            loading="eager"
            decoding="async"
          />
        </picture>
        {/* Overlay mais suave para imagem ficar visível */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/20 to-primary/40" />

        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            {/* Action Buttons com padding vertical para respirar */}
            <div className="flex flex-col items-center gap-2 px-6 py-5 sm:flex-row sm:flex-wrap sm:justify-center sm:px-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton
                    onClick={() => setShowAreasModal(true)}
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Configurar cidades e regiões onde você atende"
                  >
                    Configurar Região
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Defina as cidades onde você atende clientes</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton
                    onClick={() => setShowServiceTypesModal(true)}
                    icon={<Wrench className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Configurar tipos de serviços oferecidos"
                  >
                    Configurar Serviços
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configure os serviços que você oferece</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton
                    onClick={() => setServicesModalOpen(true)}
                    icon={<Settings className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Solicitar serviços como guincho ou mudança"
                  >
                    Solicitar Serviços
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Solicite guincho, mudança ou outros serviços</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="container mx-auto px-4 -mt-8 pb-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            size="sm"
            icon={<MessageSquare className="h-5 w-5" />}
            label="Disponível"
            value={stats.pending_requests}
            iconColor="text-green-600"
            className="shadow-sm"
          />

          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            label="Ativas"
            value={stats.accepted_requests}
            iconColor="text-orange-600"
            className="shadow-sm"
          />

          <StatsCard
            size="sm"
            icon={<CheckCircle className="h-5 w-5" />}
            label="Concluídos"
            value={stats.completed_requests}
            iconColor="text-green-600"
            className="shadow-sm"
          />

          <StatsCard
            size="sm"
            icon={<TrendingUp className="h-5 w-5" />}
            label="Saldo"
            value={showEarnings ? `R$ ${stats.total_earnings.toFixed(2).replace('.', ',')}` : '****'}
            iconColor="text-blue-600"
            className="shadow-sm"
            actionButton={
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEarnings();
                }}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label={showEarnings ? 'Ocultar saldo' : 'Mostrar saldo'}
              >
                {showEarnings ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            }
          />
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showServiceTypesModal} onOpenChange={setShowServiceTypesModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Configurar Tipos de Serviços
            </DialogTitle>
          </DialogHeader>
          <ServiceProviderServiceTypeManager />
        </DialogContent>
      </Dialog>

      <Dialog open={showAreasModal} onOpenChange={setShowAreasModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Gerenciar Cidades de Atendimento
            </DialogTitle>
          </DialogHeader>
          <UserCityManager userRole="PRESTADOR_SERVICOS" />
        </DialogContent>
      </Dialog>

      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações do Prestador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Configurações Disponíveis</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowServiceTypesModal(true);
                    }}
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Tipos de Serviços
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowAreasModal(true);
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Áreas de Atendimento
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      fetchStats();
                      toast({
                        title: "Estatísticas atualizadas",
                        description: "Dados foram recarregados com sucesso.",
                      });
                    }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Atualizar Estatísticas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
      
      <ServicesModal 
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />
    </div>
    </TooltipProvider>
  );
};

export default ServiceProviderHeroDashboard;