import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyDashboard as CompanyDashboardComponent } from '@/components/CompanyDashboard';
import { PendingVehiclesApproval } from '@/components/PendingVehiclesApproval';
import { CompanyDriverManager } from '@/components/CompanyDriverManager';
import { AdvancedVehicleManager } from '@/components/AdvancedVehicleManager';
import { CompanyFleetVehicleList } from '@/components/CompanyFleetVehicleList';
import { CompanyVehicleAssignments } from '@/components/CompanyVehicleAssignments';
import { FreightCard } from '@/components/FreightCard';
import { VehicleManager } from '@/components/VehicleManager';
import { FreightDetails } from '@/components/FreightDetails';
import { DriverAvailabilityCalendar } from '@/components/DriverAvailabilityCalendar';
import { UserCityManager } from '@/components/UserCityManager';
import { DriverAvailabilityAreasManager } from '@/components/DriverAvailabilityAreasManager';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { CompanySmartFreightMatcher } from '@/components/CompanySmartFreightMatcher';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { AdvancedFreightSearch } from '@/components/AdvancedFreightSearch';
import { MyAssignmentCard } from '@/components/MyAssignmentCard';
import { DriverPayouts } from '@/components/DriverPayouts';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import FreightCheckinModal from '@/components/FreightCheckinModal';
import FreightCheckinsViewer from '@/components/FreightCheckinsViewer';
import FreightWithdrawalModal from '@/components/FreightWithdrawalModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { useDriverPermissions } from '@/hooks/useDriverPermissions';
import { toast } from 'sonner';
import { 
  MapPin, 
  TrendingUp, 
  Truck, 
  Clock, 
  CheckCircle, 
  Settings, 
  DollarSign, 
  Package, 
  Calendar, 
  Eye, 
  EyeOff, 
  Banknote, 
  Star, 
  MessageSquare, 
  AlertTriangle, 
  Users, 
  Building2, 
  BarChart, 
  Link2, 
  UserPlus, 
  Wrench,
  Brain,
  Navigation,
  FileText,
  Target
} from 'lucide-react';
import { SystemAnnouncementModal } from '@/components/SystemAnnouncementModal';
import { useGPSMonitoring } from '@/hooks/useGPSMonitoring';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { TrackingConsentModal } from '@/components/TrackingConsentModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServiceRegionSelector } from '@/components/ServiceRegionSelector';
import { DriverRegionManager } from '@/components/DriverRegionManager';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import heroLogistics from '@/assets/hero-logistics.jpg';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';
import UnifiedLocationManager from '@/components/UnifiedLocationManager';
import { ServicesModal } from '@/components/ServicesModal';
import { UnifiedHistory } from '@/components/UnifiedHistory';
import { CompanyFreightHistory } from '@/components/CompanyFreightHistory';
import { CompanyInviteModal } from '@/components/CompanyInviteModal';
import { CompanyBalance } from '@/components/CompanyBalance';
import { CompanyInternalChat } from '@/components/CompanyInternalChat';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';
import { CompanyReports } from '@/components/CompanyReports';
import { ResponsiveTabNavigation } from '@/components/ui/responsive-tab-navigation';
import { ScrollIndicators } from '@/components/ui/scroll-indicators';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { DriverFileModal } from '@/components/DriverFileModal';

import { FRETES_IA_LABEL, AREAS_IA_LABEL, AI_ABBR, FRETES_IA_DISPONIVEL_LABEL, VER_FRETES_IA_LABEL } from '@/lib/ui-labels';

// ✅ Definição centralizada de TODAS as tabs (ÚNICA FONTE DA VERDADE)
// ⚠️ ATENÇÃO: Esta é a ÚNICA lista de tabs. NÃO adicionar tabs manualmente em outros lugares!
// Função para retornar tabs com badge dinâmico
const getCompanyTabs = (activeCount: number, chatCount: number) => [
  { 
    value: 'overview', 
    label: 'Visão Geral', 
    shortLabel: 'Visão', 
    icon: Building2,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'marketplace', label: FRETES_IA_LABEL, shortLabel: AI_ABBR, icon: TrendingUp, badge: undefined }, // ✅ ÚNICA aba de IA
  { value: 'drivers', label: 'Motoristas', shortLabel: 'Mot', icon: Users, badge: undefined },
  { value: 'fleet', label: 'Frota', shortLabel: 'Frota', icon: Truck, badge: undefined },
  { value: 'assignments', label: 'Vínculos', shortLabel: 'Vínc', icon: Link2, badge: undefined },
  { value: 'freights', label: 'Fretes', shortLabel: 'Fretes', icon: Package, badge: undefined },
  { value: 'scheduled', label: 'Agendamentos', shortLabel: 'Agend', icon: Calendar, badge: undefined },
  { 
    value: 'active', 
    label: 'Em Andamento', 
    shortLabel: 'Ativo', 
    icon: Navigation,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'proposals', label: 'Propostas', shortLabel: 'Prop', icon: FileText, badge: undefined },
  { value: 'services', label: 'Serviços', shortLabel: 'Serv', icon: Wrench, badge: undefined },
  { value: 'payments', label: 'Pagamentos', shortLabel: 'Pag', icon: DollarSign, badge: undefined },
  { value: 'areas-ai', label: AREAS_IA_LABEL, shortLabel: 'Áreas', icon: Target, badge: undefined },
  { value: 'cities', label: 'Cidades', shortLabel: 'Cid', icon: MapPin, badge: undefined },
  { value: 'balance', label: 'Saldo', shortLabel: '$', icon: Banknote, badge: undefined },
  { value: 'ratings', label: 'Avaliações', shortLabel: 'Aval', icon: Star, badge: undefined },
  { value: 'history', label: 'Histórico', shortLabel: 'Hist', icon: Clock, badge: undefined },
  { 
    value: 'chat', 
    label: 'Chat Interno', 
    shortLabel: 'Chat', 
    icon: MessageSquare,
    badge: chatCount > 0 ? chatCount : undefined
  },
  { value: 'reports', label: 'Relatórios', shortLabel: 'Rel', icon: BarChart, badge: undefined }
];

// Tabs configuration loaded

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
  const { company, isLoadingCompany, drivers, pendingDrivers } = useTransportCompany();
  
  // Get initial tab from localStorage or default to overview
  const getInitialTab = () => {
    const storedTab = localStorage.getItem('company_active_tab');
    return storedTab || 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  
  // ✅ Obter permissões do motorista para passar aos componentes filhos
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights } = useDriverPermissions();
  
  // Contador de mensagens não lidas
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'TRANSPORTADORA'
  );
  
  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('company_active_tab', activeTab);
  }, [activeTab]);

  // Listener para redirecionar para histórico quando frete for movido
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
    // Força re-fetch buscando company novamente
    await fetchActiveFreights();
  };

  // Handler para navegar para relatórios
  const handleNavigateToReport = (tabValue: string) => {
    setActiveTab(tabValue);
    setTimeout(() => {
      const tabsElement = document.querySelector('[role="tablist"]');
      if (tabsElement) {
        tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleAddVehicle = async (vehicleData: any) => {
    if (!company?.id || !profile?.id) {
      toast.error('Informações da empresa não encontradas. Recarregue a página.');
      return;
    }

    try {
      console.log('[CompanyDashboard] Salvando veículo da frota:', {
        company_id: company.id,
        driver_id: profile.id,
        vehicle_type: vehicleData.vehicle_type,
        license_plate: vehicleData.license_plate
      });
      
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

      const { data, error } = await supabase
        .from('vehicles')
        .insert(vehicleToInsert)
        .select()
        .single();

      if (error) {
        console.error('[CompanyDashboard] Erro ao salvar veículo:', error);
        throw error;
      }

      console.log('[CompanyDashboard] Veículo salvo com sucesso:', data);
      
      toast.success('✅ Veículo cadastrado e aprovado automaticamente!');
      
      // Recarregar lista da frota
      refetchCompany();
    } catch (error: any) {
      console.error('[CompanyDashboard] Erro fatal ao cadastrar veículo:', error);
      toast.error(error?.message || 'Erro ao cadastrar veículo. Tente novamente.');
    }
  };
  
  // Estados para funcionalidades do motorista
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
  const [initialCheckinType, setInitialCheckinType] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<any | null>(null);
  
  // Estados para dados
  const [activeFreights, setActiveFreights] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);

  // GPS Monitoring para fretes em andamento
  const activeFreight = activeFreights.find(f =>
    f.status === 'IN_TRANSIT' || f.status === 'ACCEPTED'
  );
  useGPSMonitoring(activeFreight?.id || null, !!activeFreight);

  // Fetch fretes ativos da empresa
  const fetchActiveFreights = React.useCallback(async () => {
    // ✅ FASE 4: Verificar condições antes de buscar
    if (!company?.id) {
      console.warn('⚠️ [CompanyDashboard/Active] Company não carregado, fetchActiveFreights abortado');
      return;
    }
    if (!profile?.id) {
      console.warn('⚠️ [CompanyDashboard/Active] Profile não carregado, fetchActiveFreights abortado');
      return;
    }

    try {
      setIsLoadingActive(true);

      // ✅ FASE 1: Logging detalhado
      console.log(`🔍 [CompanyDashboard/Active] Buscando fretes ativos para company: ${company.id}`);
      console.log(`👤 [CompanyDashboard/Active] Profile ID: ${profile.id}`);

      // Buscar assignments ativos da empresa
      const { data: assignments, error } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          freight:freights(*,
            producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
          ),
          driver:profiles!freight_assignments_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .eq('company_id', company.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('accepted_at', { ascending: false });

      if (error) throw error;

      console.log(`📦 [CompanyDashboard/Active] ${assignments?.length || 0} assignments encontrados`);
      console.log(`📊 [CompanyDashboard/Active] Dados dos assignments:`, assignments);

      setMyAssignments(assignments || []);
      console.log(`✅ [CompanyDashboard/Active] myAssignments setado: ${assignments?.length || 0}`);

      // ✅ FASE 3: Toast notification quando há assignments
      if (assignments && assignments.length > 0) {
        toast.success(`✅ ${assignments.length} frete(s) em andamento`, {
          description: 'Clique em "Em Andamento" para ver detalhes',
          duration: 5000,
          action: {
            label: 'Ver Fretes',
            onClick: () => setActiveTab('active')
          }
        });
      }

      // Buscar também fretes diretos da empresa
      const { data: directFreights } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone),
          driver:profiles!freights_driver_id_fkey(id, full_name, contact_phone, rating)
        `)
        .eq('company_id', company.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'])
        .order('created_at', { ascending: false });

      console.log(`🚛 [CompanyDashboard/Active] ${directFreights?.length || 0} fretes diretos encontrados`);

      setActiveFreights(directFreights || []);
      console.log(`✅ [CompanyDashboard/Active] activeFreights setado: ${directFreights?.length || 0}`);
    } catch (error) {
      console.error(`❌ [CompanyDashboard/Active] Erro ao buscar fretes:`, error);
      toast.error('Erro ao carregar fretes ativos');
    } finally {
      setIsLoadingActive(false);
    }
  }, [company?.id, profile?.id]);

  React.useEffect(() => {
    fetchActiveFreights();
  }, [fetchActiveFreights]);

  // Realtime updates
  React.useEffect(() => {
    if (!company?.id) return;

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, fetchActiveFreights]);

  // ✅ FASE 7: Listener para navegação via CustomEvent
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      console.log(`🔄 [CompanyDashboard] Navegando para tab: ${e.detail}`);
      setActiveTab(e.detail);
    };
    
    window.addEventListener('navigate-to-tab', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handleNavigate as EventListener);
  }, []);

  // Auto-switch para perfil TRANSPORTADORA se necessário
  useEffect(() => {
    if (isLoadingCompany) return;

    const handleProfileSwitch = async () => {
      // Se não há empresa, procurar perfil TRANSPORTADORA
      if (!company) {
        const transportProfile = profiles.find(p => p.role === 'TRANSPORTADORA');
        
        // Se existe perfil TRANSPORTADORA mas não é o ativo, fazer switch
        if (transportProfile && profile?.id !== transportProfile.id) {
          setIsSwitchingProfile(true);
          await switchProfile(transportProfile.id);
          // O useTransportCompany vai recarregar automaticamente
          return;
        }
        
        // Se não existe perfil TRANSPORTADORA, não redirecionar
        // Mostraremos um CTA para criar a transportadora
      }
      setIsSwitchingProfile(false);
    };

    handleProfileSwitch();
  }, [company, isLoadingCompany, profile?.id, profiles, switchProfile]);

  // Show loading state without Header to avoid user=undefined error
  if (isLoadingCompany || isSwitchingProfile) {
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

  // Ensure we have a valid profile before rendering
  if (!profile) return null;

  // Se não há empresa e não há perfil TRANSPORTADORA, mostrar CTA
  if (!company && !profiles.find(p => p.role === 'TRANSPORTADORA')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Header user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined} onLogout={signOut} />
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

  // Calcular total de fretes ativos para badges
  const totalActiveFreights = myAssignments.length + activeFreights.length;
  
  // Gerar tabs com badges dinâmicos (sem useMemo para evitar erro #310 de hooks)
  const COMPANY_TABS = getCompanyTabs(totalActiveFreights, chatUnreadCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SystemAnnouncementModal />
      <Header
        user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined} 
        onLogout={signOut}
        userProfile={profile ? { ...profile, active_mode: 'TRANSPORTADORA' } : undefined}
      />
      
      {/* Hero Section - Transportadora */}
      <section className="relative py-12 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <Badge variant="default" className="mb-2">
              <Building2 className="h-3 w-3 mr-1" />
              Transportadora
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Painel de Gerenciamento
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {company?.company_name || 'Transportadora'}
            </p>

            
            <div className="flex flex-wrap justify-center gap-3">
              <Button 
                onClick={() => setActiveTab('marketplace')}
                className="gradient-primary text-primary-foreground font-semibold rounded-full px-6 py-2.5 w-full sm:w-auto shadow-glow hover:scale-105 transition-bounce"
              >
                <Brain className="mr-2 h-5 w-5" />
                {FRETES_IA_LABEL}
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('overview')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Building2 className="mr-1 h-4 w-4" />
                Visão Geral
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setDriverFileModalOpen(true)}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Users className="mr-1 h-4 w-4" />
                Fichário de Motoristas
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('fleet')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Truck className="mr-1 h-4 w-4" />
                Frota
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Solicitar Serviços
            </Button>
          </div>
        </div>
      </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        <SubscriptionExpiryNotification />
        <FreightLimitTracker hideForAffiliatedDriver={true} />

        {/* Painel de aprovação de veículos pendentes */}
        {company && (
          <div className="mb-6">
            <PendingVehiclesApproval companyId={company.id} />
          </div>
        )}

        {/* ✅ FASE 5: Debug Card (DEV only) */}
        {import.meta.env.DEV && (
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 mb-6">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                🐛 Debug Info (Dev Only)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1 font-mono">
              <div>Company ID: {company?.id || 'N/A'}</div>
              <div>Profile ID: {profile?.id || 'N/A'}</div>
              <div>Active Tab: {activeTab}</div>
              <div className="font-bold text-primary">myAssignments: {myAssignments.length}</div>
              <div className="font-bold text-primary">activeFreights: {activeFreights.length}</div>
              <div className="font-bold text-primary">Total Active: {totalActiveFreights}</div>
              <div>isLoadingActive: {isLoadingActive ? 'true' : 'false'}</div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={fetchActiveFreights}
                className="mt-2 w-full"
              >
                🔄 Force Refresh Active Freights
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navegação Responsiva por Tabs */}
        {isMobile || isTablet ? (
          <ResponsiveTabNavigation
            tabs={COMPANY_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : (
          <div className="relative mb-6">
            <div 
              ref={tabsScrollRef}
              className="flex gap-2 overflow-x-auto overflow-y-hidden scroll-smooth pb-2 px-1"
            >
              {COMPANY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.value === activeTab;
                
                return (
                  <Button
                    key={tab.value}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium min-w-[120px] flex-shrink-0 gap-2 transition-all duration-200",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md border-2 border-primary" 
                        : "bg-card hover:bg-muted border border-border hover:scale-105"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {/* ✅ FASE 2: Badge visual nas tabs */}
                    {tab.badge && tab.badge > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {tab.badge}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          <TabsContent value="overview" className="mt-6">
            <CompanyDashboardComponent onNavigateToReport={handleNavigateToReport} />
          </TabsContent>

          {/* ✅ ÚNICA aba de Fretes I.A (marketplace) - NÃO DUPLICAR! */}
          <TabsContent value="marketplace" className="mt-6">
            <CompanySmartFreightMatcher />
          </TabsContent>

          <TabsContent value="drivers" className="mt-6">
            <CompanyDriverManager />
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            {company?.id && <CompanyVehicleAssignments companyId={company.id} />}
          </TabsContent>

          <TabsContent value="fleet" className="mt-6">
              <AdvancedVehicleManager onVehicleAdd={handleAddVehicle} />
              
              <div className="mt-6">
                {company?.id && <CompanyFleetVehicleList companyId={company.id} onRefresh={refetchCompany} />}
              </div>
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <div className="space-y-6">
              {/* GPS Tracking Alert */}
              {activeFreight && (
                <Alert className="mb-4">
                  <Navigation className="h-4 w-4 animate-pulse" />
                  <AlertTitle className="flex items-center gap-2">
                    Rastreamento Automático Ativo
                  </AlertTitle>
                  <AlertDescription>
                    O GPS está rastreando automaticamente fretes em andamento para segurança.
                  </AlertDescription>
                </Alert>
              )}

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
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p>Carregando fretes ativos...</p>
                    </div>
                  ) : myAssignments.length === 0 && activeFreights.length === 0 ? (
                    <div className="text-center py-8">
                      <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-semibold mb-2">Nenhum frete em andamento</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Seus fretes aceitos aparecerão aqui automaticamente.
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        💡 Vá para "Fretes I.A" para ver fretes disponíveis no marketplace
                      </p>
                      {import.meta.env.DEV && (
                        <div className="text-xs bg-muted p-3 rounded-lg inline-block max-w-md">
                          <p className="font-semibold mb-2">🐛 Debug Info:</p>
                          <p>Company ID: {company?.id || 'N/A'}</p>
                          <p>Profile ID: {profile?.id || 'N/A'}</p>
                          <p>Query executada: {isLoadingActive ? 'Loading...' : 'Sim'}</p>
                          <p>myAssignments: {myAssignments.length}</p>
                          <p>activeFreights: {activeFreights.length}</p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={fetchActiveFreights} 
                            className="mt-2 w-full"
                          >
                            🔄 Force Reload
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Assignments */}
                      {myAssignments.map((assignment) => (
                        <MyAssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          onAction={() => {
                            setSelectedFreightId(assignment.freight_id);
                            setShowDetails(true);
                          }}
                        />
                      ))}

                      {/* Direct Freights */}
                      {activeFreights.map((freight) => (
                        <Card key={freight.id} className="border-l-4 border-l-blue-600">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold">{getCargoTypeLabel(freight.cargo_type)}</h3>
                              <Badge variant="secondary">
                                {freight.status === 'IN_TRANSIT' ? 'Em Trânsito' : 'Aceito'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-1 text-sm">
                              <p className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-green-600" />
                                <span className="font-medium">Origem:</span> {freight.origin_city}, {freight.origin_state}
                              </p>
                              <p className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-red-600" />
                                <span className="font-medium">Destino:</span> {freight.destination_city}, {freight.destination_state}
                              </p>
                            </div>
                            {freight.driver && (
                              <div className="p-2 bg-muted rounded">
                                <p className="text-sm"><strong>Motorista:</strong> {freight.driver.full_name}</p>
                                {freight.driver.contact_phone && (
                                  <p className="text-xs text-muted-foreground">{freight.driver.contact_phone}</p>
                                )}
                              </div>
                            )}
                            <Button
                              onClick={() => {
                                setSelectedFreightId(freight.id);
                                setShowDetails(true);
                              }}
                              className="w-full"
                            >
                              Ver Detalhes
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  Propostas Recebidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Gerencie as propostas enviadas pelos motoristas afiliados à sua transportadora.
                </p>
                {company?.id && (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sistema de propostas em desenvolvimento</p>
                    <p className="text-xs mt-2">Em breve você poderá gerenciar propostas aqui</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    Tipos de Frete que sua Transportadora Aceita
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure os tipos de frete que sua transportadora está preparada para realizar. Isso ajuda no matching automático com clientes.
                  </p>
                  <ServiceTypeManager />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            {profile?.id && <DriverPayouts driverId={profile.id} />}
          </TabsContent>

          <TabsContent value="areas-ai" className="mt-6">
            <DriverAvailabilityAreasManager
              driverId={profile?.id || ''}
              onFreightAction={(freightId) => {
                setSelectedFreightId(freightId);
                setShowDetails(true);
              }}
              canAcceptFreights={canAcceptFreights}
              isAffiliated={isAffiliated}
              companyId={companyId}
            />
          </TabsContent>

          <TabsContent value="freights" className="mt-6">
            <div className="space-y-6">
              <AdvancedFreightSearch 
                onSearch={(filters) => console.log('Search filters:', filters)}
                userRole="MOTORISTA"
              />
            </div>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-6">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="cities" className="mt-6">
            <UserCityManager userRole="TRANSPORTADORA" />
          </TabsContent>

          <TabsContent value="balance" className="mt-6">
            <CompanyBalance />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <PendingRatingsPanel
              userRole="PRODUTOR"
              userProfileId={profile?.id || ''}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {company?.id && <CompanyFreightHistory companyId={company.id} />}
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <UnifiedChatHub 
              userProfileId={profile.id}
              userRole="TRANSPORTADORA"
            />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <CompanyReports />
          </TabsContent>

        </Tabs>
      </div>

      {/* Modals */}
      <ServicesModal 
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />

      <CompanyInviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />

      {/* Freight Details Modal */}
      {showDetails && selectedFreightId && profile && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <FreightDetails
              freightId={selectedFreightId}
              currentUserProfile={profile}
              onClose={() => {
                setShowDetails(false);
                setSelectedFreightId(null);
                fetchActiveFreights();
              }}
              onFreightWithdraw={(freight) => {
                setSelectedFreightForWithdrawal(freight);
                setShowWithdrawalModal(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Checkin Modal */}
      {showCheckinModal && selectedFreightForCheckin && profile && (
        <FreightCheckinModal
          freightId={selectedFreightForCheckin}
          isOpen={showCheckinModal}
          onClose={() => {
            setShowCheckinModal(false);
            setSelectedFreightForCheckin(null);
            setInitialCheckinType(null);
            fetchActiveFreights();
          }}
          currentUserProfile={profile}
          initialType={initialCheckinType || undefined}
        />
      )}

      {/* Withdrawal Modal */}
      {showWithdrawalModal && selectedFreightForWithdrawal && (
        <FreightWithdrawalModal
          isOpen={showWithdrawalModal}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedFreightForWithdrawal(null);
          }}
          onConfirm={async () => {
            // Handle withdrawal
            setShowWithdrawalModal(false);
            setSelectedFreightForWithdrawal(null);
            fetchActiveFreights();
            toast.success('Frete retirado com sucesso');
          }}
          freightInfo={{
            cargo_type: selectedFreightForWithdrawal.cargo_type,
            origin_address: selectedFreightForWithdrawal.origin_address,
            destination_address: selectedFreightForWithdrawal.destination_address,
            price: selectedFreightForWithdrawal.price,
          }}
        />
      )}

      {/* Driver File Modal */}
      {company && (
        <DriverFileModal
          open={driverFileModalOpen}
          onOpenChange={setDriverFileModalOpen}
          companyId={company.id}
          affiliatedCount={drivers?.length || 0}
          pendingCount={pendingDrivers?.length || 0}
        />
      )}
      
    </div>
  );
};

export default CompanyDashboard;
