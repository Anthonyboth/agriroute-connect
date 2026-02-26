import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { AppSpinner, CenteredSpinner } from '@/components/ui/AppSpinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HeroActionButton } from '@/components/ui/hero-action-button';
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
  Brain,
  ClipboardList
} from 'lucide-react';
import { usePendingRatingsCount } from '@/hooks/usePendingRatingsCount';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { TabBadge } from '@/components/ui/TabBadge';
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
import { useFreightDriverManager } from '@/hooks/useFreightDriverManager';
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
import { ServiceRequestInProgressCard } from '@/components/ServiceRequestInProgressCard';
import { ServiceChatDialog } from '@/components/ServiceChatDialog';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { UnifiedProposalsWrapper } from '@/components/proposal/UnifiedProposalsWrapper';
import { UserCityManager } from '@/components/UserCityManager';
import { CompanyHistoryTab } from '@/pages/company/CompanyHistoryTab';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { CompanyVehicleAssignments } from '@/components/CompanyVehicleAssignments';
import { FreightDetails } from '@/components/FreightDetails';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ServicesModal } from '@/components/ServicesModal';
import { FiscalTab } from '@/components/fiscal/tabs/FiscalTab';
import { useHeroBackground } from '@/hooks/useHeroBackground';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { MyRequestsTab } from '@/components/MyRequestsTab';
import { calculateVisiblePrice, resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';

// ✅ PHASE 2: Lazy load chart-heavy components with auto-retry on ChunkLoadError
const CompanyAnalyticsDashboard = lazyWithRetry(() => import('@/components/CompanyAnalyticsDashboard').then(m => ({ default: m.CompanyAnalyticsDashboard })));
const CompanyDriverPerformanceDashboard = lazyWithRetry(() => import('@/components/dashboards/CompanyDriverPerformanceDashboard').then(m => ({ default: m.CompanyDriverPerformanceDashboard })));
const CompanyFinancialDashboard = lazyWithRetry(() => import('@/components/CompanyFinancialDashboard').then(m => ({ default: m.CompanyFinancialDashboard })));
const CompanyExternalPaymentsPanel = lazyWithRetry(() => import('@/components/CompanyExternalPaymentsPanel').then(m => ({ default: m.CompanyExternalPaymentsPanel })));
const CompanyReportsTab = lazyWithRetry(() => import('@/pages/company/CompanyReportsTab').then(m => ({ default: m.CompanyReportsTab })));

// Loading fallback for chart components - SEM TEXTO (padrão global)
const ChartLoader = () => <CenteredSpinner className="p-12 min-h-[300px]" />;

// Definição de tabs
const getCompanyTabs = (activeCount: number, chatCount: number, ratingsCount: number) => [
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
  { value: 'ratings', label: 'Avaliações', shortLabel: 'Avaliações', icon: Star, badge: ratingsCount > 0 ? ratingsCount : undefined },
  { value: 'history', label: 'Histórico', shortLabel: 'Histórico', icon: Clock, badge: undefined },
  { 
    value: 'chat', 
    label: 'Chat Interno', 
    shortLabel: 'Chat', 
    icon: MessageSquare,
    badge: chatCount > 0 ? chatCount : undefined
  },
  { value: 'services', label: 'Serviços', shortLabel: 'Serviços', icon: Wrench, badge: undefined },
  { value: 'my-requests', label: 'Solicitações', shortLabel: 'Solicitações', icon: ClipboardList, badge: undefined },
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
  const { desktopUrl: heroDesktop, mobileUrl: heroMobile } = useHeroBackground();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [driverFileModalOpen, setDriverFileModalOpen] = useState(false);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const {
    company,
    isLoadingCompany: companyLoading,
    companyError,
    refetchCompany: refetchCompanyRecord,
    drivers,
    pendingDrivers,
  } = useTransportCompany();
  
  const getInitialTab = () => {
    const storedTab = localStorage.getItem('company_active_tab');
    return storedTab || 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [isMuralOpen, setIsMuralOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [serviceChatOpen, setServiceChatOpen] = useState(false);
  const [selectedChatServiceRequest, setSelectedChatServiceRequest] = useState<any>(null);

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
  const { pendingRatingsCount } = usePendingRatingsCount(profile?.id);

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
    refetchActiveFreights();
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

  // ✅ NOVO: Hook centralizado para gerenciar fretes e motoristas
  const affiliatedDriverIds = React.useMemo(() => 
    (drivers || [])
      .map(d => d?.driver_profile_id)
      .filter((id): id is string => Boolean(id)),
    [drivers]
  );

  const { 
    freights: managedFreights, 
    isLoading: isLoadingActive, 
    refetch: refetchActiveFreights,
    totalFreights
  } = useFreightDriverManager({
    companyId: company?.id,
    affiliatedDriverIds,
    includePartialOpen: true
  });

  // ✅ Mapear fretes gerenciados para formato compatível com FreightInProgressCard
  const activeFreightsForCards = React.useMemo(() => {
    return managedFreights.map(mf => ({
      ...(() => {
        // ✅ CORREÇÃO: Usar hook calculadora centralizado com role TRANSPORTADORA
        const requiredTrucks = Math.max(mf.requiredTrucks || 1, 1);
        const freightPrice = mf.rawFreight?.price ?? 0;

        // Montar assignments da empresa no formato do calculator
        const allDrivers = [
          ...(mf.affiliatedDrivers || []),
          ...(mf.drivers || []),
        ];
        const companyAssignments = allDrivers
          .filter((d) => typeof d.agreedPrice === 'number' && d.agreedPrice > 0)
          .map((d) => ({
            id: d.id || '',
            driver_id: d.driverId || '',
            agreed_price: d.agreedPrice || 0,
            company_id: company?.id || '',
            pricing_type: 'FIXED' as const,
            price_per_km: 0,
            status: d.status || 'ACCEPTED',
          }));

        const companyTruckCount = companyAssignments.length || 1;

        const visible = calculateVisiblePrice(
          'TRANSPORTADORA',
          { id: mf.rawFreight?.id || '', price: freightPrice, required_trucks: requiredTrucks },
          null,
          companyAssignments.length > 0 ? companyAssignments : undefined,
        );

        // Preço unitário para exibição PER_TRUCK no card
        const unitPrice = companyTruckCount > 0 ? visible.displayPrice / companyTruckCount : visible.displayPrice;

        return {
          ...mf.rawFreight,
          price: unitPrice,
          price_display_mode: 'PER_TRUCK' as const,
          // ✅ CRÍTICO: carretas da EMPRESA, não o total do frete
          original_required_trucks: companyTruckCount,
        };
      })(),
      // Dados do produtor
      producer: mf.producer ? {
        id: mf.producer.id,
        full_name: mf.producer.name,
        contact_phone: mf.producer.phone
      } : null,
      // Motoristas atribuídos (primeiro da lista para compatibilidade)
      driver_profiles: mf.drivers.length > 0 ? {
        id: mf.drivers[0].driverId,
        full_name: mf.drivers[0].driverName,
        profile_photo_url: mf.drivers[0].driverPhoto,
        rating: mf.drivers[0].driverRating
      } : null,
      profiles: mf.drivers.length > 0 ? {
        id: mf.drivers[0].driverId,
        full_name: mf.drivers[0].driverName,
        profile_photo_url: mf.drivers[0].driverPhoto,
        rating: mf.drivers[0].driverRating
      } : null,
      // Lista completa de motoristas para exibição
      assignedDrivers: mf.drivers,
      // Contadores de capacidade
      accepted_trucks: mf.acceptedTrucks,
      required_trucks: mf.requiredTrucks,
      availableSlots: mf.availableSlots,
      isFullyAssigned: mf.isFullyAssigned
    }));
  }, [managedFreights, company?.id]);

  // ✅ Legacy: manter arrays vazios para compatibilidade com código existente
  const myAssignments: any[] = []; // Não usar mais - fretes já agrupados
  const activeFreights = activeFreightsForCards;

  // ✅ NOVO: Buscar serviços urbanos (PET, Pacotes, etc.) dos motoristas afiliados
  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const fetchActiveServices = useCallback(async () => {
    if (!affiliatedDriverIds.length) {
      setActiveServices([]);
      return;
    }
    setIsLoadingServices(true);
    try {
      const { data, error } = await supabase
        .from('service_requests_secure')
        .select('*')
        .in('provider_id', affiliatedDriverIds)
        .in('service_type', ['GUINCHO', 'MUDANCA', 'FRETE_URBANO', 'FRETE_MOTO', 'ENTREGA_PACOTES', 'TRANSPORTE_PET'])
        .in('status', ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'])
        .order('accepted_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('[CompanyDashboard] Erro buscando serviços urbanos:', error);
      } else {
        setActiveServices(data || []);
      }
    } catch (err) {
      console.error('[CompanyDashboard] Erro inesperado:', err);
    } finally {
      setIsLoadingServices(false);
    }
  }, [affiliatedDriverIds]);

  useEffect(() => {
    fetchActiveServices();
  }, [fetchActiveServices]);

  // Handlers para transição de serviços urbanos
  const handleServiceOnTheWay = async (requestId: string) => {
    try {
      setActiveServices(prev => 
        prev.map(r => r.id === requestId ? { ...r, status: 'ON_THE_WAY' } : r)
      );
      const { error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: requestId,
        p_next_status: 'ON_THE_WAY',
      });
      if (error) throw error;
      toast.success('Status atualizado: A Caminho!');
      setTimeout(() => fetchActiveServices(), 500);
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      toast.error('Erro ao atualizar status');
      fetchActiveServices();
    }
  };

  const handleStartTransit = async (requestId: string) => {
    try {
      setActiveServices(prev => 
        prev.map(r => r.id === requestId ? { ...r, status: 'IN_PROGRESS' } : r)
      );
      const { error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: requestId,
        p_next_status: 'IN_PROGRESS',
      });
      if (error) throw error;
      toast.success('Em trânsito!');
      setTimeout(() => fetchActiveServices(), 500);
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      toast.error('Erro ao atualizar status');
      fetchActiveServices();
    }
  };

  const handleFinishService = async (requestId: string) => {
    try {
      setActiveServices(prev => prev.filter(r => r.id !== requestId));
      const { data, error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: requestId,
        p_next_status: 'COMPLETED',
        p_final_price: null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || 'Não foi possível concluir o serviço');
        fetchActiveServices();
        return;
      }
      toast.success('Serviço concluído com sucesso!');
      setTimeout(() => fetchActiveServices(), 500);
    } catch (error) {
      console.error('Erro ao finalizar serviço:', error);
      toast.error('Erro ao finalizar serviço');
      fetchActiveServices();
    }
  };

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
        () => refetchActiveFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `company_id=eq.${company.id}`
        },
        () => refetchActiveFreights()
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
          () => refetchActiveFreights()
        );
        // ✅ NOVO: Realtime para serviços urbanos dos motoristas afiliados
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_requests',
            filter: `provider_id=eq.${driverId}`
          },
          () => fetchActiveServices()
        );
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, affiliatedDriverIds, refetchActiveFreights, fetchActiveServices]);

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

  // Loading state
  if (companyLoading) {
    return <AppSpinner fullscreen />;
  }

  // Profile switching state
  if (isSwitchingProfile) {
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

  // Error loading company record (RLS, network, etc.)
  if (companyError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Header
          user={{ ...profile, name: profile.full_name, role: (profile.active_mode || profile.role) as any }}
          onLogout={signOut}
        />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Não foi possível carregar sua Transportadora
              </CardTitle>
              <CardDescription>
                Isso normalmente acontece por falta de cadastro da empresa, permissão no banco (RLS) ou instabilidade de rede.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTitle>Erro ao carregar dados</AlertTitle>
                <AlertDescription>
                  Tente novamente. Se persistir, vá para o cadastro da transportadora.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => refetchCompanyRecord()} className="w-full sm:w-auto">
                  Tentar novamente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/transport-company/registration')}
                  className="w-full sm:w-auto"
                >
                  Ir para cadastro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Logged in as transportadora, but no transport_companies record exists yet
  if (!company?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Header
          user={{ ...profile, name: profile.full_name, role: (profile.active_mode || profile.role) as any }}
          onLogout={signOut}
        />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Finalize o cadastro da sua Transportadora
              </CardTitle>
              <CardDescription>
                Seu perfil está como transportadora, mas ainda não existe um registro da empresa (transport_companies).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => navigate('/transport-company/registration')} className="w-full">
                Criar Transportadora
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // NOTE: cases where the user is not transportadora are handled by route guards.

  const totalActiveFreights = myAssignments.length + activeFreights.length + activeServices.length;
  const COMPANY_TABS = getCompanyTabs(totalActiveFreights, chatUnreadCount, pendingRatingsCount);

  return (
    <div data-dashboard-ready="true" className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Header
        user={profile ? { ...profile, name: profile.full_name, role: profile.role as any } : undefined}
        onLogout={signOut}
        userProfile={profile ? { ...profile, active_mode: 'TRANSPORTADORA' } : undefined}
      />
      
      <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden">
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
        {/* Overlay verde para melhor contraste - seguindo padrão do DriverDashboard */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/20 to-primary/40" />
        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Hero layout: Logo e título à esquerda, info da empresa à direita */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              
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
            
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              <HeroActionButton 
                onClick={() => setActiveTab('marketplace')}
                icon={<Brain className="h-4 w-4" />}
              >
                {FRETES_IA_LABEL}
              </HeroActionButton>
              
              <HeroActionButton 
                onClick={() => setActiveTab('overview')}
                icon={<Building2 className="h-4 w-4" />}
              >
                Visão Geral
              </HeroActionButton>
              
              <HeroActionButton 
                onClick={() => setActiveTab('fleet')}
                icon={<Truck className="h-4 w-4" />}
              >
                Frota
              </HeroActionButton>
              
              <HeroActionButton 
                onClick={() => setServicesModalOpen(true)}
                icon={<Wrench className="h-4 w-4" />}
              >
                Solicitar Serviços
              </HeroActionButton>
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
            <TabsList className="inline-flex h-11 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              {COMPANY_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                    {...(tab.value === 'freights' ? { 'data-tutorial': 'company-freights' } :
                         tab.value === 'drivers' ? { 'data-tutorial': 'company-drivers' } :
                         tab.value === 'ongoing' ? { 'data-tutorial': 'tab-ongoing' } :
                         tab.value === 'my-requests' ? { 'data-tutorial': 'tab-my-requests-co' } :
                         tab.value === 'vehicles' ? { 'data-tutorial': 'tab-vehicles-co' } :
                         tab.value === 'history' ? { 'data-tutorial': 'tab-history' } :
                         tab.value === 'chat' ? { 'data-tutorial': 'tab-chat-co' } :
                         tab.value === 'reports' ? { 'data-tutorial': 'tab-reports' } : {})}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline" translate="no">{tab.label}</span>
                    <span className="sm:hidden" translate="no">{tab.shortLabel}</span>
                    <TabBadge count={tab.badge || 0} />
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

          {/* Aba de Serviços - Tipos de fretes que a transportadora atende */}
          <TabsContent value="services" className="mt-6">
            <SafeListWrapper>
              <div className="w-full max-w-4xl mx-auto space-y-6 overflow-x-hidden">
                <div className="w-full">
                  <h3 className="text-lg font-semibold mb-4">Tipos de Serviços</h3>
                  <ServiceTypeManager />
                </div>
                
                <div className="border-t pt-6 w-full">
                  <MatchIntelligentDemo />
                </div>
              </div>
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="fiscal" className="mt-6">
            <FiscalTab userRole="TRANSPORTADORA" />
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6">
            <CompanySmartFreightMatcher onTabChange={(tab) => setActiveTab(tab)} />
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
            <Tabs defaultValue="rural" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="rural" className="flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Fretes Rurais
                  <TabBadge count={activeFreights.length} />
                </TabsTrigger>
                <TabsTrigger value="urban" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Fretes Urbanos
                  <TabBadge count={activeServices.length} />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rural">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-blue-600" />
                      Fretes Rurais em Andamento
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Transportadoras podem gerenciar múltiplos fretes simultaneamente
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoadingActive ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>Carregando fretes ativos...</p>
                      </div>
                    ) : activeFreights.length === 0 ? (
                      <div className="text-center py-8">
                        <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-semibold mb-2">Nenhum frete rural em andamento</p>
                        <p className="text-sm text-muted-foreground">
                          Seus fretes aceitos aparecerão aqui automaticamente.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                        {activeFreights.map((freight) => {
                          const pickupDate = freight.pickup_date ? new Date(freight.pickup_date) : null;
                          const now = new Date();
                          const hoursSincePickup = pickupDate ? (now.getTime() - pickupDate.getTime()) / (1000 * 60 * 60) : 0;
                          const isExpired = pickupDate ? hoursSincePickup > 48 : false;

                          return (
                            <FreightInProgressCard
                              key={`freight-${freight.id}`}
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
                                    const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
                                      body: {
                                        freight_id: freight.id,
                                        reason: 'Cancelamento automático: frete não coletado em 48h após a data agendada'
                                      }
                                    });

                                    if (error) throw error;
                                    if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro ao cancelar');

                                    toast.success('Frete cancelado por vencimento');
                                    refetchActiveFreights();
                                  } catch (error) {
                                    console.error('Erro ao cancelar:', error);
                                    toast.error('Erro ao cancelar frete');
                                  }
                                } else {
                                  toast.info('Solicite o cancelamento através dos detalhes do frete');
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

              <TabsContent value="urban">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-purple-600" />
                      Fretes Urbanos em Andamento
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      PET, Pacotes, Guincho, Mudança e outros fretes urbanos atribuídos aos seus motoristas
                    </p>
                  </CardHeader>
                  <CardContent>
                    {isLoadingServices ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>Carregando serviços...</p>
                      </div>
                    ) : activeServices.length === 0 ? (
                      <div className="text-center py-8">
                        <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-semibold mb-2">Nenhum frete urbano em andamento</p>
                        <p className="text-sm text-muted-foreground">
                          Atribua fretes aos seus motoristas na aba {FRETES_IA_LABEL}.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                        {activeServices.map((service) => (
                          <ServiceRequestInProgressCard
                            key={`service-${service.id}`}
                            uiNomenclature="FREIGHT"
                            request={service}
                            onMarkOnTheWay={handleServiceOnTheWay}
                            onStartTransit={handleStartTransit}
                            onFinishService={handleFinishService}
                            onOpenChat={(req) => { setSelectedChatServiceRequest(req); setServiceChatOpen(true); }}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
            <UnifiedProposalsWrapper
              userId={profile?.id || ""}
              companyDriverIds={drivers?.filter(d => d.status === 'ACTIVE').map(d => d.driver_profile_id) || []}
            />
          </TabsContent>


          <TabsContent value="payments" className="mt-6">
            <div className="space-y-8">
              {/* Pagamentos externos dos motoristas afiliados */}
              <Suspense fallback={<ChartLoader />}>
                <CompanyExternalPaymentsPanel />
              </Suspense>
              {/* Dashboard financeiro consolidado */}
              <Suspense fallback={<ChartLoader />}>
                <CompanyFinancialDashboard companyId={company.id} companyName={company.company_name} />
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent value="cities" className="mt-6">
            <UserCityManager userRole="TRANSPORTADORA" onCitiesUpdate={() => {}} />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <div className="space-y-6">
              {/* Avaliações pendentes da transportadora para produtores */}
              <PendingRatingsPanel 
                userRole="TRANSPORTADORA" 
                userProfileId={profile.id} 
              />
              {/* Performance dos motoristas */}
              <Suspense fallback={<ChartLoader />}>
                <CompanyDriverPerformanceDashboard companyId={company.id} />
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <CompanyHistoryTab />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <UnifiedChatHub userProfileId={profile.id} userRole="TRANSPORTADORA" />
          </TabsContent>
          
          <TabsContent value="my-requests" className="mt-6">
            <MyRequestsTab />
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

      {/* ServiceChat Dialog */}
      {serviceChatOpen && selectedChatServiceRequest && (
        <ServiceChatDialog
          isOpen={serviceChatOpen}
          onClose={() => { setServiceChatOpen(false); setSelectedChatServiceRequest(null); }}
          serviceRequest={selectedChatServiceRequest}
          currentUserProfile={profile}
        />
      )}

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
