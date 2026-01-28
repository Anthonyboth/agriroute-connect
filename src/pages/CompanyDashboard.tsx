import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AppSpinner, CenteredSpinner } from '@/components/ui/AppSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Users, 
  Truck, 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Package, 
  Navigation,
  MapPin,
  DollarSign,
  Loader2,
  Building2,
  Link2,
  Calendar,
  Wrench,
  Target,
  Banknote,
  Star,
  Clock,
  BarChart,
  Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanySmartFreightMatcher } from '@/components/CompanySmartFreightMatcher';
import { CompanyDriverManager } from '@/components/CompanyDriverManager';
import { CompanyDashboard as CompanyDashboardComponent } from '@/components/CompanyDashboard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { AdvancedVehicleManager } from '@/components/AdvancedVehicleManager';
import { CompanyVehiclesList } from '@/components/CompanyVehiclesList';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { useDriverPermissions } from '@/hooks/useDriverPermissions';
import { cn } from '@/lib/utils';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { MyAssignmentCard } from '@/components/MyAssignmentCard';
import { FRETES_IA_LABEL, AI_ABBR, AREAS_IA_LABEL } from '@/lib/ui-labels';
import Header from '@/components/Header';
import { SystemAnnouncementsBoard } from '@/components/SystemAnnouncementsBoard';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import { PendingVehiclesApproval } from '@/components/PendingVehiclesApproval';
import { CompanyFreightsManager } from '@/components/CompanyFreightsManager';
import { FreightInProgressCard } from '@/components/FreightInProgressCard';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { CompanyProposalsManager } from '@/components/CompanyProposalsManager';
import { UserCityManager } from '@/components/UserCityManager';
import { CompanyHistory } from '@/components/CompanyHistory';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { CompanyVehicleAssignments } from '@/components/CompanyVehicleAssignments';
import { FreightDetails } from '@/components/FreightDetails';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ServicesModal } from '@/components/ServicesModal';
import { FiscalTab } from '@/components/fiscal/tabs/FiscalTab';
import { HERO_BG_DESKTOP } from '@/lib/hero-assets';

// ✅ PHASE 2: Lazy load chart-heavy components to reduce initial bundle
const CompanyAnalyticsDashboard = lazy(() => import('@/components/CompanyAnalyticsDashboard').then(m => ({ default: m.CompanyAnalyticsDashboard })));
const CompanyDriverPerformanceDashboard = lazy(() => import('@/components/dashboards/CompanyDriverPerformanceDashboard').then(m => ({ default: m.CompanyDriverPerformanceDashboard })));
const CompanyFinancialDashboard = lazy(() => import('@/components/CompanyFinancialDashboard').then(m => ({ default: m.CompanyFinancialDashboard })));
const CompanyReportsTab = lazy(() => import('@/pages/company/CompanyReportsTab').then(m => ({ default: m.CompanyReportsTab })));

// Loading fallback for chart components - SEM TEXTO (padrão global)
const ChartLoader = () => <CenteredSpinner className="p-12 min-h-[300px]" />;

// Definição de tabs
const getCompanyTabs = (activeCount: number, chatCount: number) => [
  { 
    value: 'overview', 
    label: 'Visão Geral', 
    shortLabel: 'Visão', 
    icon: Building2,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'marketplace', label: FRETES_IA_LABEL, shortLabel: FRETES_IA_LABEL, icon: Brain, badge: undefined },
  { value: 'drivers', label: 'Motoristas', shortLabel: 'Motoristas', icon: Users, badge: undefined },
  
  { value: 'fleet', label: 'Frota', shortLabel: 'Frota', icon: Truck, badge: undefined },
  { value: 'assignments', label: 'Vínculos', shortLabel: 'Vínculos', icon: Link2, badge: undefined },
  { value: 'freights', label: 'Fretes', shortLabel: 'Fretes', icon: Package, badge: undefined },
  { value: 'scheduled', label: 'Agendamentos', shortLabel: 'Agendamentos', icon: Calendar, badge: undefined },
  { 
    value: 'active', 
    label: 'Em Andamento', 
    shortLabel: 'Ativo', 
    icon: Navigation,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'proposals', label: 'Propostas', shortLabel: 'Propostas', icon: FileText, badge: undefined },
  
  { value: 'payments', label: 'Pagamentos', shortLabel: 'Pagamentos', icon: DollarSign, badge: undefined },
  { value: 'cities', label: 'Cidades', shortLabel: 'Cidades', icon: MapPin, badge: undefined },
  { value: 'ratings', label: 'Avaliações', shortLabel: 'Avaliações', icon: Star, badge: undefined },
  { value: 'history', label: 'Histórico', shortLabel: 'Histórico', icon: Clock, badge: undefined },
  { 
    value: 'chat', 
    label: 'Chat Interno', 
    shortLabel: 'Chat', 
    icon: MessageSquare,
    badge: chatCount > 0 ? chatCount : undefined
  },
  { value: 'fiscal', label: 'Fiscal', shortLabel: 'Fiscal', icon: FileText, badge: undefined },
  { value: 'reports', label: 'Relatórios', shortLabel: 'Relatórios', icon: BarChart, badge: undefined }
];

const CompanyDashboard = () => {
  const { profile, profiles, switchProfile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const tabsScrollRef = React.useRef<HTMLDivElement>(null);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [driverFileModalOpen, setDriverFileModalOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const { company, isLoadingCompany: companyLoading, drivers, pendingDrivers } = useTransportCompany();
  
  const getInitialTab = () => {
    const storedTab = localStorage.getItem('company_active_tab');
    return storedTab || 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [isMuralOpen, setIsMuralOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem('mural_dismissed_at');
    const now = new Date();
    let timeoutId: number | undefined;

    if (dismissedAt) {
      const dismissed = new Date(dismissedAt);
      const nextShow = new Date(dismissed);
      nextShow.setDate(nextShow.getDate() + 1);
      nextShow.setHours(7, 0, 0, 0);

      if (now < nextShow) {
        setIsMuralOpen(false);
        // Programa reabertura automática às 07:00
        timeoutId = window.setTimeout(() => {
          localStorage.removeItem('mural_dismissed_at');
          setManualOpen(false);
          setIsMuralOpen(true);
        }, nextShow.getTime() - now.getTime());
      } else {
        // Já passou das 07:00: limpa flag e abre
        localStorage.removeItem('mural_dismissed_at');
        setManualOpen(false);
        setIsMuralOpen(true);
      }
    } else {
      // Sem flag de dismiss: aberto por padrão
      setManualOpen(false);
      setIsMuralOpen(true);
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);
  
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights } = useDriverPermissions();
  
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'TRANSPORTADORA'
  );
  
  // Estado para analytics
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  useEffect(() => {
    localStorage.setItem('company_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleMovedToHistory = () => {
      setActiveTab('history');
      setShowDetails(false);
      setSelectedFreightId(null);
    };
    
    window.addEventListener('freight:movedToHistory', handleMovedToHistory);
    return () => window.removeEventListener('freight:movedToHistory', handleMovedToHistory);
  }, []);
  
  const refetchCompany = async () => {
    await fetchActiveFreights();
  };

  const handleNavigateToReport = (tabValue: string) => {
    setActiveTab(tabValue);
    setTimeout(() => {
      const tabsElement = document.querySelector('[role="tablist"]');
      if (tabsElement) {
        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  

  const handleAddVehicle = async (vehicleData: any) => {
    if (!company?.id || !profile?.id) {
      toast.error('Informações da empresa não encontradas. Recarregue a página.');
      return;
    }

    try {
      if (vehicleData.id) {
        // UPDATE
        const { error } = await supabase
          .from('vehicles')
          .update({
            vehicle_type: vehicleData.vehicle_type,
            license_plate: vehicleData.license_plate,
            axle_count: vehicleData.axle_count || 2,
            max_capacity_tons: vehicleData.max_capacity_tons || 0,
            vehicle_specifications: vehicleData.vehicle_specifications || null,
            vehicle_documents: vehicleData.vehicle_documents || [],
            vehicle_photos: vehicleData.vehicle_photos || [],
            crlv_url: vehicleData.crlv_url || null
          })
          .eq('id', vehicleData.id);

        if (error) throw error;
        toast.success('Veículo atualizado com sucesso!');
      } else {
        // INSERT
        const vehicleToInsert = {
          company_id: company.id,
          driver_id: profile.id,
          is_company_vehicle: true,
          vehicle_type: vehicleData.vehicle_type,
          license_plate: vehicleData.license_plate,
          axle_count: vehicleData.axle_count || 2,
          max_capacity_tons: vehicleData.max_capacity_tons || 0,
          vehicle_specifications: vehicleData.vehicle_specifications || null,
          vehicle_documents: vehicleData.vehicle_documents || [],
          vehicle_photos: vehicleData.vehicle_photos || [],
          crlv_url: vehicleData.crlv_url || null
        };

        const { error } = await supabase
          .from('vehicles')
          .insert(vehicleToInsert);

        if (error) throw error;
        toast.success('✅ Veículo cadastrado e aprovado automaticamente!');
      }
      
      refetchCompany();
    } catch (error: any) {
      console.error('Erro ao salvar veículo:', error);
      toast.error(error?.message || 'Erro ao salvar veículo. Tente novamente.');
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Tem certeza que deseja excluir este veículo?')) return;
    
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);
      
      if (error) throw error;
      toast.success('Veículo excluído com sucesso');
      refetchCompany();
    } catch (error: any) {
      console.error('Erro ao excluir veículo:', error);
      toast.error('Erro ao excluir veículo');
    }
  };
  
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
  const [initialCheckinType, setInitialCheckinType] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<any | null>(null);
  
  const [activeFreights, setActiveFreights] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);

  const fetchActiveFreights = React.useCallback(async () => {
    if (!company?.id || !profile?.id) {
      // ✅ Silent guard - sem console.warn para evitar spam
      return;
    }

    try {
      setIsLoadingActive(true);

      const affiliatedDriverIds = (drivers || [])
        .map(d => d?.driver_profile_id)
        .filter((id): id is string => Boolean(id));

      const orFilters: string[] = [`company_id.eq.${company.id}`];
      if (affiliatedDriverIds.length > 0) {
        orFilters.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }
      const orFilterStr = orFilters.join(',');

      const { data: assignments, error } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          freight:freights(*,
            producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
          ),
          driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .or(orFilterStr)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      let mergedAssignments = assignments || [];

      const orFiltersFreights: string[] = [`company_id.eq.${company.id}`];
      if (affiliatedDriverIds.length > 0) {
        orFiltersFreights.push(`driver_id.in.(${affiliatedDriverIds.join(',')})`);
      }
      const orFilterStrFreights = orFiltersFreights.join(',');

      const { data: directFreights } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone),
          driver:profiles!freights_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .or(orFilterStrFreights)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('created_at', { ascending: false });

      const freightIdsWithCompany = (directFreights || []).map((f: any) => f.id);
      if (freightIdsWithCompany.length > 0) {
        const { data: extraAssignments, error: extraErr } = await supabase
          .from('freight_assignments')
          .select(`
            *,
            freight:freights(*,
              producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
            ),
            driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone, rating)
          `)
          .in('freight_id', freightIdsWithCompany)
          .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
          .order('accepted_at', { ascending: false });
        if (!extraErr && extraAssignments) {
          const byId = new Map<string, any>();
          [...mergedAssignments, ...extraAssignments].forEach((a: any) => byId.set(a.id, a));
          mergedAssignments = Array.from(byId.values());
        }
      }

      setMyAssignments(mergedAssignments);
      setActiveFreights(directFreights || []);
    } catch (error) {
      console.error('Erro ao buscar fretes:', error);
      toast.error('Erro ao carregar fretes ativos');
    } finally {
      setIsLoadingActive(false);
    }
  }, [company?.id, profile?.id, drivers]);

  React.useEffect(() => {
    if (company?.id && profile?.id) {
      fetchActiveFreights();
    }
  }, [company?.id, profile?.id, fetchActiveFreights]);

  React.useEffect(() => {
    if (!company?.id) return;

    const affiliatedDriverIds = (drivers || [])
      .map(d => d?.driver_profile_id)
      .filter((id): id is string => Boolean(id));
    
    const channel = supabase
      .channel('company-active-freights')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchActiveFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchActiveFreights()
      )
      .subscribe();

    if (affiliatedDriverIds.length > 0) {
      affiliatedDriverIds.forEach(driverId => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'freight_assignments',
            filter: `driver_id=eq.${driverId}`
          },
          () => fetchActiveFreights()
        );
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, drivers, fetchActiveFreights]);

  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      setActiveTab(e.detail);
    };
    
    window.addEventListener('navigate-to-tab', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handleNavigate as EventListener);
  }, []);

  useEffect(() => {
    if (companyLoading) return;

    const handleProfileSwitch = async () => {
      if (!company) {
        const transportProfile = profiles.find(p => p.role === 'TRANSPORTADORA');
        
        if (transportProfile && profile?.id !== transportProfile.id) {
          setIsSwitchingProfile(true);
          await switchProfile(transportProfile.id);
          return;
        }
      }
      setIsSwitchingProfile(false);
    };

    handleProfileSwitch();
  }, [company, companyLoading, profile?.id, profiles, switchProfile]);

  // Early return for loading
  if (!company?.id || companyLoading) {
    return <AppSpinner fullscreen />;
  }

  if (companyLoading || isSwitchingProfile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Building2 className="h-12 w-12 text-primary mx-auto animate-pulse" />
            <p className="text-muted-foreground">Carregando painel da Transportadora...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  if (!company && !profiles.find(p => p.active_mode === 'TRANSPORTADORA' || p.role === 'TRANSPORTADORA')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Header user={profile ? { ...profile, name: profile.full_name, role: (profile.active_mode || profile.role) as any } : undefined} onLogout={signOut} />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Crie sua Transportadora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Para acessar o painel da transportadora, você precisa criar ou ativar sua conta de transportadora.
              </p>
              <Button 
                onClick={() => navigate('/transport-company/registration')}
                className="w-full"
              >
                Criar Transportadora
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalActiveFreights = myAssignments.length + activeFreights.length;
  const COMPANY_TABS = getCompanyTabs(totalActiveFreights, chatUnreadCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Header
        user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined} 
        onLogout={signOut}
        userProfile={profile ? { ...profile, active_mode: 'TRANSPORTADORA' } : undefined}
      />
      
      <section className="relative py-6 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 animate-fade-in"
          style={{ backgroundImage: `url(${HERO_BG_DESKTOP})` }}
        />
        {/* Overlay verde para melhor contraste - seguindo padrão do DriverDashboard */}
        <div className="absolute inset-0 bg-primary/80" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Hero layout: Logo e título à esquerda, info da empresa à direita */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-center md:text-left">
                <Badge variant="secondary" className="mb-2 bg-background/20 text-primary-foreground border-primary-foreground/30">
                  <Building2 className="h-3 w-3 mr-1" />
                  Transportadora
                </Badge>
                
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-primary-foreground">
                  Painel de Gerenciamento
                </h1>
              </div>
              
              {/* Info da empresa no canto direito - P8: Removido badge "Aprovada", organizado layout */}
              <div className="text-center md:text-right bg-background/10 backdrop-blur-sm rounded-lg p-4 border border-primary-foreground/20">
                <h2 className="text-lg font-bold text-primary-foreground">
                  {company?.company_name || 'Transportadora'}
                </h2>
                <p className="text-sm text-primary-foreground/80">
                  CNPJ: {company?.company_cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || 'Não informado'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Button 
                onClick={() => setActiveTab('marketplace')}
                className="bg-background text-primary hover:bg-background/90 font-semibold rounded-full px-6 py-2.5 w-full sm:w-auto shadow-lg hover:scale-105 transition-all"
              >
                <Brain className="mr-2 h-5 w-5" />
                {FRETES_IA_LABEL}
              </Button>
              
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('overview')}
                className="bg-transparent border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Building2 className="mr-1 h-4 w-4" />
                Visão Geral
              </Button>
              
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('fleet')}
                className="bg-transparent border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Truck className="mr-1 h-4 w-4" />
                Frota
              </Button>
              
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-transparent border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Solicitar Serviços
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-8">
        <SubscriptionExpiryNotification />

        {company && (
          <div className="mb-6">
            <PendingVehiclesApproval companyId={company.id} />
          </div>
        )}

        {/* Navegação por Tabs com Scroll Horizontal - igual aos outros dashboards */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2 mb-6">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              {COMPANY_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline" translate="no">{tab.label}</span>
                    <span className="sm:hidden" translate="no">{tab.shortLabel}</span>
                    {tab.badge && tab.badge > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                        {tab.badge}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

        {/* Botão Mural de Avisos */}
        <div className="container mx-auto px-4 mb-6">
          <Button
            variant="outline"
            onClick={() => {
              const newState = !isMuralOpen;
              setIsMuralOpen(newState);
              setManualOpen(newState);
            }}
            className="mb-3 flex items-center gap-2"
          >
            <span>📢</span> Mural de Avisos
          </Button>
          <SystemAnnouncementsBoard
            isOpen={isMuralOpen}
            onClose={() => {
              setIsMuralOpen(false);
              setManualOpen(false);
            }}
            ignoreDismissals={manualOpen}
          />
        </div>

          <TabsContent value="overview" className="mt-6">
            <CompanyDashboardComponent onNavigateToReport={handleNavigateToReport} />
          </TabsContent>

          <TabsContent value="fiscal" className="mt-6">
            <FiscalTab userRole="TRANSPORTADORA" />
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6">
            <CompanySmartFreightMatcher />
          </TabsContent>

          <TabsContent value="drivers" className="mt-6">
            <CompanyDriverManager />
          </TabsContent>


          <TabsContent value="fleet" className="mt-6">
            <div className="space-y-6">
              <AdvancedVehicleManager 
                onVehicleAdd={handleAddVehicle}
                editingVehicle={editingVehicle}
                onEditComplete={() => setEditingVehicle(null)}
              />
              
              <div className="pt-6 border-t">
                <CompanyVehiclesList
                  companyId={company.id}
                  onEdit={(vehicle) => {
                    setEditingVehicle(vehicle);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onDelete={handleDeleteVehicle}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-blue-600" />
                  Fretes em Andamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingActive ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Carregando fretes ativos...</p>
                  </div>
                ) : myAssignments.length === 0 && activeFreights.length === 0 ? (
                  <div className="text-center py-8">
                    <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-semibold mb-2">Nenhum frete em andamento</p>
                    <p className="text-sm text-muted-foreground">
                      Seus fretes aceitos aparecerão aqui automaticamente.
                    </p>
                  </div>
                 ) : (
                  <div className="space-y-4">
                    {myAssignments.map((assignment) => (
                      <MyAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onAction={() => {
                          if (assignment?.freight?.id) {
                            setSelectedFreightId(assignment.freight.id);
                            setShowDetails(true);
                          }
                        }}
                      />
                    ))}
                    {activeFreights.map((freight) => {
                      // Verificar se vencido (48h após pickup_date)
                      const pickupDate = new Date(freight.pickup_date);
                      const now = new Date();
                      const hoursSincePickup = (now.getTime() - pickupDate.getTime()) / (1000 * 60 * 60);
                      const isExpired = hoursSincePickup > 48;

                      return (
                        <FreightInProgressCard
                          key={freight.id}
                          freight={freight}
                          showActions={true}
                          onViewDetails={() => {
                            setSelectedFreightId(freight.id);
                            setShowDetails(true);
                          }}
                          onRequestCancel={async () => {
                            if (isExpired) {
                              if (!confirm('Cancelar este frete por vencimento?')) return;
                              
                              try {
                                const { error } = await supabase
                                  .from('freights')
                                  .update({
                                    status: 'CANCELLED',
                                    cancellation_reason: 'Cancelamento automático: frete não coletado em 48h após a data agendada',
                                    cancelled_at: new Date().toISOString()
                                  })
                                  .eq('id', freight.id);

                                if (error) throw error;

                                await supabase.from('freight_status_history').insert({
                                  freight_id: freight.id,
                                  status: 'CANCELLED',
                                  changed_by: profile?.id,
                                  notes: 'Cancelado por vencimento (48h após data de coleta)'
                                });

                                toast.success('Frete cancelado por vencimento');
                                fetchActiveFreights();
                              } catch (error) {
                                console.error('Erro ao cancelar:', error);
                                toast.error('Erro ao cancelar frete');
                              }
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            {company?.id && <CompanyVehicleAssignments companyId={company.id} />}
          </TabsContent>

          <TabsContent value="freights" className="mt-6">
            <CompanyFreightsManager />
          </TabsContent>

          <TabsContent value="scheduled" className="mt-6">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <CompanyProposalsManager />
          </TabsContent>


          <TabsContent value="payments" className="mt-6">
            <Suspense fallback={<ChartLoader />}>
              <CompanyFinancialDashboard companyId={company.id} companyName={company.company_name} />
            </Suspense>
          </TabsContent>

          <TabsContent value="cities" className="mt-6">
            <UserCityManager userRole="TRANSPORTADORA" onCitiesUpdate={() => {}} />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <Suspense fallback={<ChartLoader />}>
              <CompanyDriverPerformanceDashboard companyId={company.id} />
            </Suspense>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <CompanyHistory />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <UnifiedChatHub userProfileId={profile.id} userRole="TRANSPORTADORA" />
          </TabsContent>
          
          {/* Aba de Relatórios Analytics */}
          <TabsContent value="reports" className="mt-6">
            <Suspense fallback={<ChartLoader />}>
              <CompanyReportsTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Detalhes do Frete */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedFreightId && (
            <FreightDetails
              freightId={selectedFreightId}
              currentUserProfile={profile}
              onClose={() => setShowDetails(false)}
              initialTab="status"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Solicitar Serviços */}
      <ServicesModal
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
        mode="client"
      />
    </div>
  );
};

export default CompanyDashboard;
