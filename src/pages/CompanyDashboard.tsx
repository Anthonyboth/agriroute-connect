import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
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
  ClipboardList,
  Plus,
  Play,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';
import { usePendingRatingsCount } from '@/hooks/usePendingRatingsCount';
import { usePendingDeliveryConfirmations } from '@/hooks/usePendingDeliveryConfirmations';
import { PendingDeliveryConfirmationCard } from '@/components/PendingDeliveryConfirmationCard';
import { DeliveryConfirmationModal } from '@/components/DeliveryConfirmationModal';
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
import { UnifiedServiceCard } from '@/components/UnifiedServiceCard';
import { ServiceChatDialog } from '@/components/ServiceChatDialog';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { UnifiedProposalsWrapper } from '@/components/proposal/UnifiedProposalsWrapper';
import { UserCityManager } from '@/components/UserCityManager';
import { CompanyHistoryTab } from '@/pages/company/CompanyHistoryTab';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { CompanyVehicleAssignments } from '@/components/CompanyVehicleAssignments';
import { FreightDetails } from '@/components/FreightDetails';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServicesModal } from '@/components/ServicesModal';
import { FiscalTab } from '@/components/fiscal/tabs/FiscalTab';
import { useHeroBackground } from '@/hooks/useHeroBackground';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { MyRequestsTab } from '@/components/MyRequestsTab';
import { useMyRequestsCount } from '@/hooks/useMyRequestsCount';
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
const getCompanyTabs = (activeCount: number, chatCount: number, ratingsCount: number, myRequestsCount: number, pendingDeliveryCount: number) => [
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
  { value: 'freights', label: 'Gerenciamento', shortLabel: 'Gerenciar', icon: Package, badge: undefined },
  { value: 'scheduled', label: 'Agendamentos', shortLabel: 'Agendamentos', icon: Calendar, badge: undefined },
  { 
    value: 'active', 
    label: 'Em Andamento', 
    shortLabel: 'Em Andamento', 
    icon: Play,
    badge: activeCount > 0 ? activeCount : undefined
  },
  { value: 'proposals', label: 'Propostas', shortLabel: 'Propostas', icon: FileText, badge: undefined },
  { 
    value: 'confirm-delivery', 
    label: 'Confirmar Entrega', 
    shortLabel: 'Entregas', 
    icon: ShieldCheck,
    badge: pendingDeliveryCount > 0 ? pendingDeliveryCount : undefined
  },
  { value: 'payments', label: 'Carteira', shortLabel: 'Carteira', icon: DollarSign, badge: undefined },
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
  { value: 'my-requests', label: 'Solicitações', shortLabel: 'Solicitações', icon: ClipboardList, badge: myRequestsCount > 0 ? myRequestsCount : undefined },
  { value: 'fiscal', label: 'Fiscal', shortLabel: 'Fiscal', icon: FileText, badge: undefined },
  { value: 'reports', label: 'Relatórios', shortLabel: 'Relatórios', icon: BarChart, badge: undefined }
];

const CompanyDashboard = () => {
  const { profile, profiles, switchProfile, signOut } = useAuth();
  const companyMyRequestsCount = useMyRequestsCount();
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

  // ✅ Hook para confirmações de entrega pendentes (transportadora como solicitante de frete)
  const {
    items: pendingDeliveryItems,
    loading: pendingDeliveryLoading,
    totalCount: pendingDeliveryCount,
    criticalCount: pendingDeliveryCritical,
    urgentCount: pendingDeliveryUrgent,
    refetch: refetchPendingDeliveries,
  } = usePendingDeliveryConfirmations(profile?.id);

  // Estado para modal de confirmação de entrega
  const [deliveryConfirmationModal, setDeliveryConfirmationModal] = useState(false);
  const [freightToConfirm, setFreightToConfirm] = useState<any>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'urgent'>('all');

  const openDeliveryConfirmationModal = (freight: any) => {
    setFreightToConfirm(freight);
    setDeliveryConfirmationModal(true);
  };

  const closeDeliveryConfirmationModal = () => {
    setFreightToConfirm(null);
    setDeliveryConfirmationModal(false);
  };

  const handleDeliveryConfirmed = useCallback(() => {
    if (freightToConfirm) {
      const driverId = freightToConfirm.driver_id || freightToConfirm.profiles?.id;
      const amount = freightToConfirm.price;

      if (freightToConfirm.id && driverId && typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        // Criar solicitação de pagamento externo
        supabase
          .from('external_payments')
          .select('id')
          .eq('freight_id', freightToConfirm.id)
          .eq('producer_id', profile?.id || '')
          .eq('driver_id', driverId)
          .limit(1)
          .then(({ data: existing }) => {
            if (!existing?.length) {
              supabase.from('external_payments').insert({
                freight_id: freightToConfirm.id,
                producer_id: profile?.id || '',
                driver_id: driverId,
                amount,
                status: 'proposed',
                notes: 'Pagamento do frete após entrega confirmada',
                proposed_at: new Date().toISOString(),
              }).then(() => {});
            }
          });
      }

      setActiveTab('payments');
      toast.info('Entrega confirmada. Vá em "Pagamentos" para confirmar o pagamento ao motorista.');
    }

    refetchActiveFreights();
    refetchPendingDeliveries();
    closeDeliveryConfirmationModal();
  }, [freightToConfirm, profile?.id, refetchPendingDeliveries]);
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
  // ✅ FIX: Stabilize driver IDs as a string to prevent infinite re-render loops
  const affiliatedDriverIdsKey = React.useMemo(
    () => (drivers || []).map(d => d?.driver_profile_id).filter(Boolean).sort().join(','),
    [drivers]
  );
  const affiliatedDriverIds = React.useMemo(
    () => affiliatedDriverIdsKey ? affiliatedDriverIdsKey.split(',') : [],
    [affiliatedDriverIdsKey]
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

        // ✅ CORREÇÃO CRÍTICA: Preservar pricing_type ORIGINAL do frete
        // Se PER_TON → manter PER_TON + price_per_ton original (R$ 80,00/ton)
        // Se PER_KM → manter PER_KM + price_per_km original
        // Se FIXED → manter FIXED + calcular por veículo
        const originalPricingType = mf.rawFreight?.pricing_type;
        
        return {
          ...mf.rawFreight,
          // Preservar pricing_type original — NUNCA sobrescrever
          pricing_type: originalPricingType,
          // Manter price_per_km original para PER_TON (campo sobrecarregado = R$/ton)
          price_per_km: mf.rawFreight?.price_per_km,
          price_per_ton: mf.rawFreight?.price_per_ton,
          price_display_mode: 'PER_TRUCK' as const,
          // Carretas da EMPRESA para contexto secundário
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

  // ✅ Deduplicate by freight id to prevent React duplicate key errors
  const dedupedActiveFreights = React.useMemo(() => {
    return Array.from(
      new Map(activeFreightsForCards.map(f => [f.id, f])).values()
    );
  }, [activeFreightsForCards]);

  // ✅ Legacy: manter arrays vazios para compatibilidade com código existente
  const myAssignments: any[] = []; // Não usar mais - fretes já agrupados
  const activeFreights = dedupedActiveFreights;

  // ✅ NOVO: Buscar serviços urbanos (PET, Pacotes, etc.) dos motoristas afiliados
  const [activeServices, setActiveServices] = useState<any[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const fetchActiveServices = useCallback(async () => {
    const driverIds = affiliatedDriverIdsKey ? affiliatedDriverIdsKey.split(',') : [];
    if (!driverIds.length) {
      setActiveServices([]);
      return;
    }
    setIsLoadingServices(true);
    try {
      const { data, error } = await supabase
        .from('service_requests_secure')
        .select('*')
        .in('provider_id', driverIds)
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
  }, [affiliatedDriverIdsKey]);

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

  // ✅ FIX: Use refs for callbacks to prevent infinite re-subscription loop (React #185)
  const refetchActiveFreightsRef = useRef(refetchActiveFreights);
  refetchActiveFreightsRef.current = refetchActiveFreights;
  const fetchActiveServicesRef = useRef(fetchActiveServices);
  fetchActiveServicesRef.current = fetchActiveServices;

  React.useEffect(() => {
    if (!company?.id) return;

    const driverIds = affiliatedDriverIdsKey ? affiliatedDriverIdsKey.split(',') : [];
    
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
        () => refetchActiveFreightsRef.current()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `company_id=eq.${company.id}`
        },
        () => refetchActiveFreightsRef.current()
      )
      .subscribe();

    if (driverIds.length > 0) {
      driverIds.forEach(driverId => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'freight_assignments',
            filter: `driver_id=eq.${driverId}`
          },
          () => refetchActiveFreightsRef.current()
        );
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_requests',
            filter: `provider_id=eq.${driverId}`
          },
          () => fetchActiveServicesRef.current()
        );
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, affiliatedDriverIdsKey]);

  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      setActiveTab(e.detail);
    };
    
    window.addEventListener('navigate-to-tab', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handleNavigate as EventListener);
  }, []);

  // Stable refs to avoid infinite loop (profiles/switchProfile change refs on every render)
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const switchProfileRef = useRef(switchProfile);
  switchProfileRef.current = switchProfile;

  // ✅ FIX: Guard against infinite profile-switch loops
  // NEVER auto-reset this ref — only reset on unmount
  const switchAttemptedRef = useRef(false);
  // ✅ FIX: Track rapid effect cycles to detect loops
  const effectCycleCountRef = useRef(0);
  const effectCycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset cycle counter after 2s of quiet
    if (effectCycleTimerRef.current) clearTimeout(effectCycleTimerRef.current);
    effectCycleTimerRef.current = setTimeout(() => { effectCycleCountRef.current = 0; }, 2000);
    
    // ✅ CRITICAL: Detect rapid cycling (>5 runs in 2s = probable loop)
    effectCycleCountRef.current++;
    if (effectCycleCountRef.current > 5) {
      console.warn('[CompanyDashboard] ⚠️ Profile switch effect cycling too fast, breaking loop');
      setIsSwitchingProfile(false);
      return;
    }

    if (companyLoading) return;

    const handleProfileSwitch = async () => {
      if (!company) {
        // Only attempt switch ONCE to prevent infinite loops
        if (switchAttemptedRef.current) {
          setIsSwitchingProfile(false);
          return;
        }
        const transportProfile = profilesRef.current.find(p => p.role === 'TRANSPORTADORA');
        
        if (transportProfile && profile?.id !== transportProfile.id) {
          switchAttemptedRef.current = true;
          setIsSwitchingProfile(true);
          await switchProfileRef.current(transportProfile.id);
          return;
        }
      }
      // ✅ FIX: NEVER reset switchAttemptedRef here — it was causing loops
      // when company flickered between states. The ref is only reset on unmount.
      setIsSwitchingProfile(false);
    };

    handleProfileSwitch();
    // Only re-run when company loading state or identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, companyLoading, profile?.id]);

  // ✅ Reset guard on unmount only
  useEffect(() => {
    return () => {
      switchAttemptedRef.current = false;
      if (effectCycleTimerRef.current) clearTimeout(effectCycleTimerRef.current);
    };
  }, []);

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
  const COMPANY_TABS = getCompanyTabs(totalActiveFreights, chatUnreadCount, pendingRatingsCount, companyMyRequestsCount, pendingDeliveryCount);

  return (
    <div data-dashboard-ready="true" className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-background via-background to-primary/5 pb-[env(safe-area-inset-bottom,0px)]">
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
            {/* Hero layout: Info da empresa centralizada */}
            <div className="flex justify-center">
              <div className="text-center bg-black/20 backdrop-blur-sm rounded-xl px-8 py-5 border border-white/10">
                <h2 className="text-2xl font-bold text-white drop-shadow-md">
                  {company?.company_name || 'Transportadora'}
                </h2>
                <p className="text-base text-white/80 mt-1.5 font-mono tracking-wide drop-shadow-sm">
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
          <div className="w-full overflow-x-auto pb-2 mb-6 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
            <TabsList className="inline-flex h-12 items-center rounded-xl bg-card shadow-md border border-border/50 p-1.5 text-muted-foreground min-w-fit gap-0.5">
              {COMPANY_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:bg-muted/60"
                    {...(tab.value === 'freights' ? { 'data-tutorial': 'company-freights' } :
                         tab.value === 'drivers' ? { 'data-tutorial': 'company-drivers' } :
                         tab.value === 'ongoing' ? { 'data-tutorial': 'tab-ongoing' } :
                         tab.value === 'my-requests' ? { 'data-tutorial': 'tab-my-requests-co' } :
                         tab.value === 'vehicles' ? { 'data-tutorial': 'tab-vehicles-co' } :
                         tab.value === 'history' ? { 'data-tutorial': 'tab-history' } :
                         tab.value === 'chat' ? { 'data-tutorial': 'tab-chat-co' } :
                         tab.value === 'reports' ? { 'data-tutorial': 'tab-reports' } : {})}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
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
              {/* Add Vehicle button + Dialog */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Frota da Empresa</h3>
                <Button onClick={() => setEditingVehicle(undefined)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Veículo
                </Button>
              </div>

              {/* Vehicle Form Dialog */}
              <Dialog open={editingVehicle !== null} onOpenChange={(open) => { if (!open) setEditingVehicle(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[10000]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
                    </DialogTitle>
                    <DialogDescription>
                      Preencha as informações do veículo para transporte de cargas.
                    </DialogDescription>
                  </DialogHeader>
                  <AdvancedVehicleManager 
                    onVehicleAdd={(data) => {
                      handleAddVehicle(data);
                      setEditingVehicle(null);
                    }}
                    editingVehicle={editingVehicle || undefined}
                    onEditComplete={() => setEditingVehicle(null)}
                  />
                </DialogContent>
              </Dialog>
              
              <CompanyVehiclesList
                companyId={company.id}
                onEdit={(vehicle) => setEditingVehicle(vehicle)}
                onDelete={handleDeleteVehicle}
              />
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
                      <CenteredSpinner />
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
                          const isExpired = pickupDate ? hoursSincePickup > 72 && ['OPEN', 'IN_NEGOTIATION'].includes(freight.status) : false;

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
                                        reason: 'Cancelamento por vencimento: 72h após data de coleta'
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
                      <CenteredSpinner />
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
                          <UnifiedServiceCard
                            key={`service-${service.id}`}
                            serviceRequest={service}
                            viewerRole="DRIVER"
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

          {/* ✅ CONFIRMAR ENTREGA - Transportadora como solicitante de frete */}
          <TabsContent value="confirm-delivery" className="mt-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={urgencyFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("all")}
                >
                  Todos ({pendingDeliveryCount})
                </Button>
                <Button
                  variant={urgencyFilter === "critical" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("critical")}
                >
                  🚨 Críticos ({pendingDeliveryCritical})
                </Button>
                <Button
                  variant={urgencyFilter === "urgent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("urgent")}
                  className={urgencyFilter === "urgent" ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  ⚠️ Urgentes ({pendingDeliveryUrgent})
                </Button>
              </div>
            </div>

            {pendingDeliveryLoading ? (
              <CenteredSpinner />
            ) : pendingDeliveryItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhuma entrega aguardando confirmação</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Quando motoristas reportarem entregas dos fretes que você solicitou, aparecerão aqui para confirmação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                  {pendingDeliveryItems
                    .filter((item) => {
                      const hours = item.deliveryDeadline.hoursRemaining;
                      if (urgencyFilter === "all") return true;
                      if (urgencyFilter === "critical") return hours < 6;
                      if (urgencyFilter === "urgent") return hours < 24 && hours >= 6;
                      return true;
                    })
                    .map((item) => (
                      <PendingDeliveryConfirmationCard
                        key={item.id}
                        item={item}
                        onDispute={() => {
                          toast.info('Disputa de entrega em breve');
                        }}
                        onConfirmDelivery={() => {
                          const reportedAt =
                            item.deliveryDeadline?.reportedAt ||
                            item.delivered_at ||
                            (item.freight as any)?.updated_at ||
                            new Date().toISOString();

                          const confirmationDeadline = new Date(
                            new Date(reportedAt).getTime() + 72 * 60 * 60 * 1000,
                          ).toISOString();

                          const confirmationData = {
                            id: item.freight_id,
                            assignment_id: item.id,
                            driver_id: item.driver_id,
                            cargo_type: item.freight.cargo_type,
                            origin_address: item.freight.origin_address,
                            destination_address: item.freight.destination_address,
                            price: item.agreed_price || (item.freight.price / item.freight.required_trucks),
                            updated_at: reportedAt,
                            status: 'DELIVERED_PENDING_CONFIRMATION',
                            metadata: {
                              ...(item.freight as any).metadata,
                              confirmation_deadline: confirmationDeadline,
                            },
                            profiles: {
                              id: item.driver.id,
                              full_name: item.driver.full_name,
                              contact_phone: item.driver.contact_phone,
                            },
                            _isIndividualConfirmation: true,
                            _assignmentId: item.id,
                          };
                          openDeliveryConfirmationModal(confirmationData);
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            {(() => {
              const { WalletTab } = require('@/components/wallet');
              return (
                <WalletTab
                  role="TRANSPORTADORA"
                  legacyPaymentContent={
                    <div className="space-y-8">
                      <Suspense fallback={<ChartLoader />}>
                        <CompanyExternalPaymentsPanel />
                      </Suspense>
                      <Suspense fallback={<ChartLoader />}>
                        <CompanyFinancialDashboard companyId={company.id} companyName={company.company_name} />
                      </Suspense>
                    </div>
                  }
                />
              );
            })()}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" hideCloseButton>
          <DialogTitle className="sr-only">Detalhes do Frete</DialogTitle>
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

      {/* Modal de Confirmação de Entrega */}
      {freightToConfirm && (
        <DeliveryConfirmationModal
          freight={{
            id: freightToConfirm.id,
            cargo_type: freightToConfirm.cargo_type,
            origin_address: freightToConfirm.origin_address,
            destination_address: freightToConfirm.destination_address,
            status: freightToConfirm.status,
            updated_at: freightToConfirm.updated_at,
            metadata: freightToConfirm.metadata,
            driver: freightToConfirm.profiles
              ? {
                  full_name: freightToConfirm.profiles.full_name,
                  contact_phone: freightToConfirm.profiles.contact_phone || freightToConfirm.profiles.phone,
                }
              : undefined,
            profiles: freightToConfirm.profiles,
            _isIndividualConfirmation: freightToConfirm._isIndividualConfirmation,
            _assignmentId: freightToConfirm._assignmentId,
            driver_id: freightToConfirm.driver_id,
            price: freightToConfirm.price,
          }}
          isOpen={deliveryConfirmationModal}
          onClose={closeDeliveryConfirmationModal}
          onConfirm={handleDeliveryConfirmed}
        />
      )}
    </div>
  );
};

export default CompanyDashboard;
