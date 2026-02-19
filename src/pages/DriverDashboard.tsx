import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { devLog } from '@/lib/devLogger';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabBadge } from '@/components/ui/TabBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import { FreightDetails } from '@/components/FreightDetails';
import { MyAssignmentCard } from '@/components/MyAssignmentCard';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { PageDOMErrorBoundary } from '@/components/PageDOMErrorBoundary';

import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightCheckinModal from '@/components/FreightCheckinModal';
import FreightWithdrawalModal from '@/components/FreightWithdrawalModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLocationPermissionSync } from '@/hooks/useLocationPermissionSync';
import { useNotifications } from '@/hooks/useNotifications';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Brain, Settings, Play, DollarSign, Package, Banknote, Star, MessageSquare, AlertTriangle, Users, Wrench, X, ClipboardList } from 'lucide-react';
import { useFreightGPSMonitoring } from '@/hooks/useFreightGPSMonitoring';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { TrackingConsentModal } from '@/components/TrackingConsentModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { isFinalStatus } from '@/lib/freight-status';
import { ServicesModal } from '@/components/ServicesModal';
import UnifiedLocationManager from '@/components/UnifiedLocationManager';
import { CompanyDriverBadge } from '@/components/CompanyDriverBadge';
import { SystemAnnouncementsBoard } from '@/components/SystemAnnouncementsBoard';
import { UnifiedTrackingControl } from '@/components/UnifiedTrackingControl';
import { ServiceRequestInProgressCard } from '@/components/ServiceRequestInProgressCard';
import { MyRequestsTab } from '@/components/MyRequestsTab';
import { useAutoRating } from '@/hooks/useAutoRating';
import { AutoRatingModal } from '@/components/AutoRatingModal';
import { useDriverPermissions } from '@/hooks/useDriverPermissions';
import { normalizeServiceType } from '@/lib/service-type-normalization';
import { debounce } from '@/lib/utils';
import { fetchBatchCheckins } from '@/hooks/useBatchCheckins';
import { FRETES_IA_LABEL, AREAS_IA_LABEL, VER_FRETES_IA_LABEL } from '@/lib/ui-labels';
import { DriverProposalDetailsModal } from '@/components/DriverProposalDetailsModal';
import { ProposalCounterModal } from '@/components/ProposalCounterModal';
import { getPricePerTruck } from '@/lib/formatters';
import { forceLogoutAndRedirect } from '@/utils/authRecovery';
import { usePendingRatingsCount } from '@/hooks/usePendingRatingsCount';

// Sub-components refatorados
import { 
  DriverDashboardHero,
  DriverDashboardStats,
  DriverOngoingTab,
  DriverProposalsTab,
  DriverPaymentsTab,
  DriverDashboardModals,
  DriverAvailableTab,
  DriverScheduledTab,
  DriverAreasTab,
  DriverCitiesTab,
  DriverServicesTab,
  DriverVehiclesTab,
  DriverAdvancesTab,
  DriverRatingsTab,
  DriverChatTab,
  DriverHistoryTab,
  DriverAffiliationsTab,
  DriverReportsTab,
  type Freight, 
  type Proposal 
} from './driver';
import { FiscalTab } from '@/components/fiscal/tabs/FiscalTab';
import { FileText } from 'lucide-react';

// LocalProposal type removed - using imported Proposal from ./driver/types

const DriverDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'MOTORISTA'
  );
  const { isCompanyDriver, companyName, companyId, canManageVehicles, isAffiliated } = useCompanyDriver();
  const { canAcceptFreights, mustUseChat } = useDriverPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  
  // ✅ Sincronizar permissão de localização real do dispositivo com o banco
  const { isLocationEnabled, isSyncing: isLocationSyncing } = useLocationPermissionSync();

  // ✅ Definir permissão unificada: autônomo vê fretes, empresa só se canAcceptFreights
  const canSeeFreights = !isCompanyDriver || canAcceptFreights;

  // Redirect to correct dashboard based on role and mode
  React.useEffect(() => {
    if (!profile?.id) return;

    // Check if user is in transport company mode
    const checkTransportMode = async () => {
      // ✅ NÃO redirecionar motoristas afiliados mesmo se tiverem active_mode TRANSPORTADORA
      if (profile.active_mode === 'TRANSPORTADORA' && profile.role !== 'MOTORISTA_AFILIADO') {
        setIsTransportCompany(true);
        navigate('/dashboard/company', { replace: true });
        return;
      }

      // Also check if user has a transport company record
      const { data } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (data) {
        setIsTransportCompany(true);
        navigate('/dashboard/company', { replace: true });
        return;
      }
    };

    checkTransportMode();

    // Redirect service providers
    if (profile.role === 'PRESTADOR_SERVICOS') {
      navigate('/dashboard/service-provider', { replace: true });
      return;
    }

    // Redirect other roles
    if (profile.role && profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO') {
      const correctRoute = profile.role === 'PRODUTOR' ? '/dashboard/producer' : 
                          profile.role === 'ADMIN' ? '/admin' : '/';
      navigate(correctRoute, { replace: true });
      return;
    }
  }, [profile?.id, profile?.role, profile?.active_mode, navigate]);
  
  // ✅ PERF: Removido useEffect duplicado de checkTransportCompany
  // O useEffect acima (linha 101) já faz essa verificação e redireciona se necessário.
  // setIsTransportCompany é atualizado pelo resultado do redirect check.
  
  
  const { pendingRatingsCount } = usePendingRatingsCount(profile?.id);
  const [availableFreights, setAvailableFreights] = useState<Freight[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [counterOffers, setCounterOffers] = useState<any[]>([]);
  const [ongoingFreights, setOngoingFreights] = useState<Freight[]>([]);
  const [acceptedServiceRequests, setAcceptedServiceRequests] = useState<any[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [transportRequests, setTransportRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('available');
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { visible: showEarnings, toggle: toggleEarnings } = useEarningsVisibility(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
  const [initialCheckinType, setInitialCheckinType] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<Freight | null>(null);
  
  // Memoized handler for assignment card actions
  const handleAssignmentAction = useCallback((freightId: string) => {
    setSelectedFreightId(freightId);
    setShowDetails(true);
  }, []);

  const [showLocationManager, setShowLocationManager] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [isTransportCompany, setIsTransportCompany] = useState(false);
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
  // ✅ REMOVIDO: Dialog de service_request (motoristas não veem serviços)
  // Estados para controle de consentimento de tracking
  const [freightAwaitingConsent, setFreightAwaitingConsent] = useState<string | null>(null);
  const [showTrackingConsentModal, setShowTrackingConsentModal] = useState(false);
  
  // Estado para controlar avaliações automáticas
  const [activeFreightForRating, setActiveFreightForRating] = useState<Freight | null>(null);
  
  // Estado para modal de detalhes de proposta
  const [proposalDetailsModal, setProposalDetailsModal] = useState<{
    open: boolean;
    proposal: any | null;
  }>({ open: false, proposal: null });

  // Estado para modal de contra-proposta do motorista
  const [driverCounterModal, setDriverCounterModal] = useState<{
    open: boolean;
    proposal: any | null;
    freight: any | null;
  }>({ open: false, proposal: null, freight: null });

  
  const [filters, setFilters] = useState({
    cargo_type: 'all',
    service_type: 'all',
    min_weight: '',
    max_weight: '',
    max_distance: '',
    min_price: '',
    max_price: '',
    origin_city: '',
    destination_city: '',
    vehicle_type: 'all',
  });

  // Flag de montagem para evitar setState após unmount
  const isMountedRef = React.useRef(true);
  // Evitar duplo clique/dupla execução em ações sensíveis (propor/aceitar)
  const freightActionInFlightRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Abrir frete ou aba automaticamente quando vem de notificação
  useEffect(() => {
    const state = location.state as any;
    if (!state || !profile?.id) return;
    
    // ✅ Se veio com openTab (ex: notificação de pagamento), abrir aba diretamente
    if (state.openTab) {
      setActiveTab(state.openTab);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const freightId = state.openFreightId || state.openChatFreightId;
    if (freightId && ongoingFreights.length > 0) {
      const freight = ongoingFreights.find(f => f.id === freightId);
      if (freight) {
        setSelectedFreightId(freight.id);
        setShowDetails(true);
      }
      // Limpar state
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, profile?.id, ongoingFreights, navigate, location.pathname]);

  // Monitoramento GPS para fretes em andamento
  const activeFreight = ongoingFreights.find(f =>
    f.status === 'IN_TRANSIT' || f.status === 'ACCEPTED' || f.status === 'LOADING' || f.status === 'LOADED'
  );
  const isFreightActive = !!activeFreight;
  
  // ✅ Hook novo com guardas fortes - só roda se tiver freightId, driverProfileId e frete ativo
  useFreightGPSMonitoring(
    activeFreight?.id || null, 
    profile?.id || null, 
    isFreightActive
  );

  // Utility functions for WhatsApp integration
  const formatPhone = (phoneNumber: string) => {
    // Remove caracteres não numéricos
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Formato brasileiro
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    return phoneNumber;
  };

  const getWhatsAppUrl = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const formattedForWhatsApp = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    return `https://wa.me/${formattedForWhatsApp}`;
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      cargo_type: 'all',
      service_type: 'all',
      min_weight: '',
      max_weight: '',
      max_distance: '',
      min_price: '',
      max_price: '',
      origin_city: '',
      destination_city: '',
      vehicle_type: 'all',
    });
  };
  
  // ✅ REMOVIDO: handleCompleteServiceRequest (motoristas não gerenciam service_requests)


  const [loading, setLoading] = useState(true);
  const [availableCountUI, setAvailableCountUI] = useState(0);

  // Eliminar duplicações entre myAssignments e ongoingFreights
  const assignmentFreightIds = useMemo(() => 
    new Set((myAssignments || []).map(a => a.freight_id)), 
    [myAssignments]
  );

  // ✅ Usar função canônica para determinar status final + filtro de data
  const visibleOngoing = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return (ongoingFreights || []).filter(f => {
      if (isFinalStatus(f.status) || assignmentFreightIds.has(f.id)) return false;

      // ✅ NÃO esconder fretes realmente em andamento por data.
      // Regra mínima e segura:
      // - ACCEPTED (e OPEN de multi-carretas) pode ser ocultado se pickup_date for futura
      // - demais status ativos (LOADING/LOADED/IN_TRANSIT/DELIVERED_PENDING_CONFIRMATION) sempre entram
      const status = String((f as any)?.status || '').trim().toUpperCase();
      const shouldGateByPickupDate = status === 'ACCEPTED' || status === 'OPEN';

      if (!shouldGateByPickupDate) return true;

      if (f.pickup_date) {
        const pickupDate = new Date(f.pickup_date);
        pickupDate.setHours(0, 0, 0, 0);
        return pickupDate <= today;
      }

      return true; // sem pickup_date: mantém visível
    });
  }, [ongoingFreights, assignmentFreightIds]);

  // Buscar fretes disponíveis - com match inteligente por região
  const fetchAvailableFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    devLog('[fetchAvailableFreights] isCompanyDriver:', isCompanyDriver, 'canAcceptFreights:', canAcceptFreights, 'companyId:', companyId);

    try {
      let companyFreights: Freight[] = [];
      let platformFreights: Freight[] = [];

      // Se é motorista de empresa SEM permissão de aceitar fretes: buscar APENAS fretes da transportadora
      if (isCompanyDriver && companyId && !canAcceptFreights) {
        devLog('[fetchAvailableFreights] Motorista de empresa SEM canAcceptFreights → apenas fretes da transportadora');
        const { data, error } = await supabase
          .from('freights')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'OPEN')
          .order('created_at', { ascending: false });

        if (error) throw error;

        companyFreights = (data || []).map((f: any) => ({
          id: f.id,
          cargo_type: f.cargo_type,
          weight: f.weight,
          origin_address: f.origin_address,
          destination_address: f.destination_address,
          pickup_date: f.pickup_date,
          delivery_date: f.delivery_date,
          price: f.price,
          urgency: f.urgency,
          status: f.status,
          distance_km: f.distance_km,
          minimum_antt_price: f.minimum_antt_price,
          service_type: f.service_type ? normalizeServiceType(f.service_type) : undefined,
          pricing_type: f.pricing_type || 'FIXED',
          price_per_km: f.price_per_km || undefined
        }));

        devLog('[fetchAvailableFreights] Fretes da transportadora:', companyFreights.length);
        if (isMountedRef.current) setAvailableFreights(companyFreights);
        return;
      }

      // CASO CONTRÁRIO: buscar fretes da plataforma (matching espacial + RPC + fallback)

    if (import.meta.env.DEV) console.log('[fetchAvailableFreights] Buscando fretes da plataforma (matching espacial + RPC)');
    const { data: { session } } = await supabase.auth.getSession();
      const { data: spatialData, error: spatialError } = await supabase.functions.invoke(
        'driver-spatial-matching',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          }
        }
      );

      if (spatialError) {
        console.warn('[fetchAvailableFreights] ⚠️ Erro no matching espacial:', spatialError);
      } else {
        devLog('[fetchAvailableFreights] ✅ Matching espacial retornou:', spatialData);
      }

      // 1️⃣ PRIORIDADE: Usar fretes do matching espacial imediatamente
      if (spatialData?.freights && Array.isArray(spatialData.freights)) {
        platformFreights = spatialData.freights
          .filter((f: any) => (f.accepted_trucks || 0) < (f.required_trucks || 1))
          .map((f: any) => ({
            id: f.id || f.freight_id,
            cargo_type: f.cargo_type,
            weight: f.weight || 0,
            origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
            destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
            pickup_date: String(f.pickup_date || ''),
            delivery_date: String(f.delivery_date || ''),
            price: f.price || 0,
            urgency: f.urgency || 'LOW',
            status: f.status,
            distance_km: f.distance_km || 0,
            minimum_antt_price: f.minimum_antt_price || 0,
            service_type: f.service_type ? normalizeServiceType(f.service_type) : undefined,
            accepted_trucks: f.accepted_trucks || 0,
            required_trucks: f.required_trucks || 1,
            pricing_type: f.pricing_type || 'FIXED',
            price_per_km: f.price_per_km || undefined
          }));
        devLog('[fetchAvailableFreights] 📦 Fretes do matching espacial:', platformFreights.length);
      }

      // 2️⃣ TENTAR RPC: Se funcionar, combinar com espacial (deduplicar)
      const { data: freights, error: rpcError } = await supabase.rpc(
        'get_freights_for_driver',
        { p_driver_id: profile.id }
      );

      if (rpcError) {
        console.warn('[fetchAvailableFreights] ⚠️ RPC falhou (não bloqueante):', rpcError);
        // Continuar com os fretes do matching espacial
      } else if (freights && Array.isArray(freights)) {
        devLog('[fetchAvailableFreights] ✅ RPC retornou:', freights.length, 'fretes');
        const rpcFreights = freights
          .filter((f: any) => (f.accepted_trucks || 0) < (f.required_trucks || 1))
          .map((f: any) => ({
            id: f.id,
            cargo_type: f.cargo_type,
            weight: f.weight,
            origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
            destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
            pickup_date: String(f.pickup_date || ''),
            delivery_date: String(f.delivery_date || ''),
            price: f.price,
            urgency: f.urgency,
            status: f.status,
            distance_km: f.distance_km,
            minimum_antt_price: f.minimum_antt_price,
            service_type: f.service_type ? normalizeServiceType(f.service_type) : undefined,
            accepted_trucks: f.accepted_trucks || 0,
            required_trucks: f.required_trucks || 1,
            pricing_type: f.pricing_type || 'FIXED',
            price_per_km: f.price_per_km || undefined
          }));

        // Combinar com spatial e deduplicar
        const combined = [...platformFreights, ...rpcFreights];
        const uniqueMap = new Map<string, Freight>();
        combined.forEach(f => {
          if (!uniqueMap.has(f.id)) {
            uniqueMap.set(f.id, f);
          }
        });
        platformFreights = Array.from(uniqueMap.values());
        devLog('[fetchAvailableFreights] 🔀 Após combinar spatial + RPC:', platformFreights.length);
      }

      // 3️⃣ FALLBACK: Se ainda vazio, buscar por user_cities
      if (platformFreights.length === 0) {
        devLog('[fetchAvailableFreights] 🔄 Usando fallback por cidades');
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const userId = userRes?.user?.id;
          if (!userId) throw new Error('Usuário não autenticado');

          // Ajustar query para cobrir user_id OU profile_id
          const { data: uc } = await supabase
            .from('user_cities')
            .select('city_id, cities(name, state)')
            .eq('user_id', userId)
            .eq('is_active', true)
            .in('type', ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO']);

          const cityIds = (uc || []).map((u: any) => u.city_id).filter(Boolean);
          const cityNames = (uc || []).map((u: any) => ({ 
            city: u.cities?.name, 
            state: u.cities?.state
          })).filter((c: any) => c.city && c.state);

          if (cityIds.length === 0 && cityNames.length === 0) {
            devLog('[fetchAvailableFreights] ℹ️ Sem cidades configuradas');
            if (isMountedRef.current) setAvailableFreights([]);
            return;
          }

          let freightsByCity: any[] = [];

          // Tentar buscar por city_id primeiro
          if (cityIds.length > 0) {
            const { data: cityIdFreights } = await supabase
              .from('freights')
              .select('*')
              .eq('status', 'OPEN')
              .or(`origin_city_id.in.(${cityIds.join(',')}),destination_city_id.in.(${cityIds.join(',')})`)
              .order('created_at', { ascending: false })
              .limit(200);

            if (cityIdFreights) {
              freightsByCity = cityIdFreights;
            }
          }

          // Fallback secundário: buscar por nome/estado se não achou por ID
          if (freightsByCity.length === 0 && cityNames.length > 0) {
            devLog('[fetchAvailableFreights] 🔄 Fallback: busca por nome/estado');
            
            const orConditions: string[] = [];
            for (const { city, state } of cityNames) {
              orConditions.push(`and(origin_city.ilike.%${city}%,origin_state.ilike.%${state}%)`);
              orConditions.push(`and(destination_city.ilike.%${city}%,destination_state.ilike.%${state}%)`);
            }
            
            const { data: nameFreights } = await supabase
              .from('freights')
              .select('*')
              .eq('status', 'OPEN')
              .or(orConditions.join(','))
              .order('created_at', { ascending: false })
              .limit(200);
              
            if (nameFreights) {
              freightsByCity = nameFreights;
            }
          }

          const onlyWithSlots = (freightsByCity || []).filter((f: any) => 
            (f.accepted_trucks || 0) < (f.required_trucks || 1)
          );

          platformFreights = onlyWithSlots.map((f: any) => ({
            id: f.id,
            cargo_type: f.cargo_type,
            weight: f.weight,
            origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
            destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
            pickup_date: String(f.pickup_date || ''),
            delivery_date: String(f.delivery_date || ''),
            price: f.price,
            urgency: f.urgency,
            status: f.status,
            distance_km: f.distance_km,
            minimum_antt_price: f.minimum_antt_price,
            service_type: f.service_type ? normalizeServiceType(f.service_type) : undefined,
            accepted_trucks: f.accepted_trucks || 0,
            required_trucks: f.required_trucks || 1,
            pricing_type: f.pricing_type || 'FIXED',
            price_per_km: f.price_per_km || undefined
          }));

          devLog('[fetchAvailableFreights] 📦 Fretes da plataforma (fallback):', platformFreights.length);
        } catch (fbErr) {
          console.error('[fetchAvailableFreights] ❌ Fallback por cidades falhou:', fbErr);
          if (isMountedRef.current) toast.error('Erro ao carregar fretes. Tente novamente.');
        }
      }

      // Se também é motorista de empresa COM permissão: buscar fretes da transportadora e combinar
      if (isCompanyDriver && companyId && canAcceptFreights) {
        devLog('[fetchAvailableFreights] Motorista de empresa COM canAcceptFreights → combinando fretes');
        const { data, error: companyError } = await supabase
          .from('freights')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'OPEN')
          .order('created_at', { ascending: false });

        if (companyError) {
          console.error('[fetchAvailableFreights] Erro ao buscar fretes da transportadora:', companyError);
        } else {
          companyFreights = (data || []).map((f: any) => ({
            id: f.id,
            cargo_type: f.cargo_type,
            weight: f.weight,
            origin_address: f.origin_address,
            destination_address: f.destination_address,
            pickup_date: f.pickup_date,
            delivery_date: f.delivery_date,
            price: f.price,
            urgency: f.urgency,
            status: f.status,
            distance_km: f.distance_km,
            minimum_antt_price: f.minimum_antt_price,
            service_type: f.service_type ? normalizeServiceType(f.service_type) : undefined
          }));
          devLog('[fetchAvailableFreights] Fretes da transportadora:', companyFreights.length);
        }
      }

      // Combinar e deduplicar
      const combined = [...platformFreights, ...companyFreights];
      const uniqueMap = new Map<string, Freight>();
      combined.forEach(f => {
        if (!uniqueMap.has(f.id)) {
          uniqueMap.set(f.id, f);
        }
      });
      const finalFreights = Array.from(uniqueMap.values());
      devLog('[fetchAvailableFreights] Total após deduplicação:', finalFreights.length);

      if (isMountedRef.current) setAvailableFreights(finalFreights);
    } catch (error) {
      console.error('Error fetching available freights:', error);
      if (isMountedRef.current) toast.error('Erro ao carregar fretes disponíveis');
    }
  }, [profile?.id, profile?.role, isCompanyDriver, companyId]);

  // Buscar propostas do motorista - otimizado
  // ✅ Buscar propostas do motorista - otimizado com tratamento de erro detalhado
  const fetchMyProposals = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    try {
      const { data, error } = await supabase.functions.invoke('driver-proposals');
      
      if (error) {
        console.error('[fetchMyProposals] Erro na edge function:', {
          message: error.message,
          context: error.context
        });
        
        // Extrair código de erro se disponível
        const errorData = error.context?.json || {};
        const errorCode = errorData.code || 'UNKNOWN';
        
        // Mensagens específicas baseadas no código
        if (errorCode === 'MISSING_AUTH' || errorCode === 'INVALID_TOKEN') {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
        } else if (errorCode === 'USER_NOT_FOUND') {
          toast.error('Perfil de motorista não encontrado.');
        } else if (isMountedRef.current) {
          // Erro genérico apenas se outros checks falharem
          toast.error('Não foi possível carregar suas propostas. Tente novamente.');
        }
        return;
      }

      const proposals = (data?.proposals as any[]) || [];
      const ongoing = (data?.ongoingFreights as any[]) || [];
      
      if (isMountedRef.current) setMyProposals(proposals);
      
      // ✅ Não mesclar service_requests (motoristas não veem serviços)
      if (isMountedRef.current) {
        // Remover duplicatas mas não mesclar com service_requests
        const dedupedOngoing = ongoing.filter(
          (item: any, index: number, self: any[]) => self.findIndex((x: any) => x.id === item.id) === index
        );
        setOngoingFreights(dedupedOngoing);
      }

      // ✅ OTIMIZADO: Usar query única com .in() ao invés de N+1
      if (ongoing.length > 0) {
        const freightIds = ongoing.map((f: any) => f.id);
        const checkinCounts = await fetchBatchCheckins(freightIds, profile.id);
        
        if (isMountedRef.current) {
          setFreightCheckins(prev => ({ ...prev, ...checkinCounts }));
        }
      }
    } catch (error: any) {
      console.error('[fetchMyProposals] Erro inesperado:', {
        message: error?.message,
        stack: error?.stack
      });
      
      // Só mostrar toast se for motorista e componente montado
      if ((profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO') && isMountedRef.current) {
        toast.error('Erro ao carregar suas propostas. Verifique sua conexão.');
      }
    }
  }, [profile?.id, profile?.role]);

  // Buscar assignments do motorista (fretes com valores individualizados)
  const fetchMyAssignments = useCallback(async () => {
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-driver-assignments', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (error) {
        const status = (error as any)?.status ?? (error as any)?.context?.response?.status ?? null;
        if (status === 401) {
          await forceLogoutAndRedirect('/auth');
          return;
        }
        console.error('[fetchMyAssignments] ❌ Edge function error:', {
          message: error.message,
          context: error.context,
          details: error
        });
        return;
      }
      
      if (isMountedRef.current) setMyAssignments(data?.assignments || []);
    } catch (error: any) {
      console.error('[fetchMyAssignments] ❌ Catch error:', {
        message: error?.message,
        stack: error?.stack,
        full: error
      });
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar fretes em andamento E service_requests aceitos
  const fetchOngoingFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    if (import.meta.env.DEV) console.log('🔍 Buscando fretes ativos e serviços aceitos do motorista:', profile.id);
    try {
      // Data de hoje para filtrar apenas fretes atuais/passados
      const todayStr = new Date().toISOString().split('T')[0];
      
      // ✅ Buscar fretes vinculados ao motorista diretamente
      // CRÍTICO: Apenas fretes com pickup_date <= hoje OU pickup_date NULL
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select(`
          *,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          producer_id
        `)
        .eq('driver_id', profile.id)
        // ✅ Incluir DELIVERED_PENDING_CONFIRMATION (ainda é “andamento” até confirmar)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'])
        .order('updated_at', { ascending: false })
        .limit(100);

      if (freightError) {
        console.error('❌ Erro buscando fretes diretos:', freightError);
        throw freightError;
      }

      // ✅ Multi-carretas: o status pode permanecer OPEN para manter visibilidade no marketplace
      // (accepted_trucks < required_trucks). Se o motorista já estiver em `drivers_assigned`,
      // ele precisa ver esse frete na aba "Em Andamento".
      const { data: multiTruckData, error: multiTruckError } = await supabase
        .from('freights')
        .select(`
          *,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          producer_id
        `)
        .contains('drivers_assigned', [profile.id])
        .eq('status', 'OPEN')
        .gt('accepted_trucks', 0)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (multiTruckError) {
        console.warn('[fetchOngoingFreights] Falha ao buscar multi-carretas atribuídos (drivers_assigned):', multiTruckError);
      }

      // ✅ Buscar fretes via freight_assignments
      // Buscar assignments primeiro, depois filtrar por data no client-side (pois não temos pickup_date no assignment)
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('freight_assignments')
        .select(`
          freight:freights(
            *,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            producer_id
          ),
          status,
          agreed_price,
          accepted_at
        `)
        .eq('driver_id', profile.id)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'])
        .order('accepted_at', { ascending: false })
        .limit(100);

      if (assignmentError) {
        console.error('❌ Erro buscando assignments:', assignmentError);
      }

      // ✅ SEGURANÇA: Usar view segura para proteção de PII do cliente
      const { data: serviceRequestsData, error: serviceRequestsError } = await supabase
        .from('service_requests_secure')
        .select('*')
        .eq('provider_id', profile.id)
        .in('service_type', ['GUINCHO', 'MUDANCA', 'FRETE_URBANO', 'FRETE_MOTO', 'ENTREGA_PACOTES', 'TRANSPORTE_PET'])
        .in('status', ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'])
        .order('accepted_at', { ascending: false })
        .limit(50);

      if (serviceRequestsError) {
        console.error('❌ Erro buscando service_requests aceitos:', serviceRequestsError);
      } else {
        if (import.meta.env.DEV) console.log('🚗 Service requests aceitos:', serviceRequestsData?.length || 0);
        if (isMountedRef.current) setAcceptedServiceRequests(serviceRequestsData || []);
      }

      // Extract and map assignment freights, using agreed_price as price
      // FILTRAR: Apenas fretes com data hoje/passada ou NULL
      const assignmentFreights = (assignmentData ?? [])
        .map((a: any) => {
          const freight = a.freight;
          if (a.agreed_price) {
            freight.price = a.agreed_price;
          }
          return freight;
        })
        .filter((freight: any) => {
          // ✅ NÃO esconder fretes realmente em andamento por data.
          // Regra: ACCEPTED com pickup_date futura pode ficar fora; demais status sempre entram.
          if (freight.status !== 'ACCEPTED') return true;
          if (!freight.pickup_date) return true;
          const pickupDate = new Date(freight.pickup_date);
          pickupDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return pickupDate <= today;
        });
      
      // ✅ REMOVIDO: Não buscar service_requests aqui (motoristas não veem serviços)
      
      // ✅ Combinar APENAS fretes diretos e assignments (sem service_requests)
      const allOngoing = [...(freightData || []), ...((multiTruckData as any[]) || []), ...(assignmentFreights || [])];
      
      // Deduplicate by id
      const seen = new Set();
      const dedupedOngoing = allOngoing.filter((item: any) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      // ✅ FIX CRÍTICO: manter compatibilidade com fluxos que dependem de `freight.producer`.
      // Como removemos o JOIN direto em `profiles` (pode falhar por RLS), resolvemos o produtor via `profiles_secure`.
      const producerIds = Array.from(
        new Set(
          dedupedOngoing
            .map((f: any) => f.producer_id)
            .filter((id: any) => typeof id === 'string' && id.length > 0),
        ),
      );

      let producerMap = new Map<string, any>();
      if (producerIds.length > 0) {
        const { data: producers, error: producersError } = await supabase
          .from('profiles_secure')
          .select('id, full_name, contact_phone, phone, profile_photo_url')
          .in('id', producerIds);

        if (producersError) {
          console.warn('[fetchOngoingFreights] Falha ao carregar produtores (profiles_secure):', producersError.message);
        } else if (producers?.length) {
          producerMap = new Map((producers || []).map((p: any) => [p.id, p]));
        }
      }

      const dedupedOngoingWithProducer = dedupedOngoing.map((f: any) => ({
        ...f,
        producer: f.producer_id ? producerMap.get(f.producer_id) || null : null,
      }));
      
      // ✅ CORREÇÃO: Remover update assíncrono do filter e criar função separada
      const filteredOngoing = dedupedOngoingWithProducer.filter((item: any) => {
        // Sempre excluir status finais
        if (['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(item.status)) {
          if (import.meta.env.DEV) console.log(`🔍 [DriverDashboard] Excluindo frete ${item.id} - Status: ${item.status}`);
          return false;
        }
        
        // Para service_requests, manter a lógica atual
        if (item.is_service_request) {
          return true;
        }
        
        // Para fretes tradicionais, verificar metadata de conclusão
        const metadata = item.metadata || {};
        const isConfirmedByProducer = 
          metadata.delivery_confirmed_at || 
          metadata.confirmed_by_producer === true ||
          metadata.confirmed_by_producer_at ||
          metadata.delivery_confirmed_by_producer === true;
        
        // ✅ APENAS logar para diagnóstico - NÃO fazer update aqui
        if (isConfirmedByProducer) {
          console.warn('🚨 [DriverDashboard] Frete confirmado com status inconsistente:', {
            id: item.id,
            status: item.status,
            metadata_keys: Object.keys(metadata)
          });
          return false; // Não mostrar como ativo
        }

        // Para multi-carretas, se não está OPEN e sem vagas, não exibir
        if (item.required_trucks && item.required_trucks > 1) {
          const availableSlots = (item.required_trucks || 1) - (item.accepted_trucks || 0);
          if (item.status !== 'OPEN' && availableSlots <= 0) {
            return false;
          }
        }

        return true;
      });
      
      // ✅ Identificar fretes com status inconsistente para correção
      const inconsistentFreights = dedupedOngoingWithProducer.filter((item: any) => {
        const metadata = item.metadata || {};
        return metadata.delivery_confirmed_at || 
               metadata.confirmed_by_producer === true ||
               metadata.confirmed_by_producer_at ||
               metadata.delivery_confirmed_by_producer === true;
      });
      
      if (import.meta.env.DEV) {
        console.log('📦 Fretes diretos:', freightData?.length || 0, '🚚 Assignments:', assignmentFreights?.length || 0, '📊 Total:', dedupedOngoingWithProducer.length, '✅ Filtrado:', filteredOngoing.length);
      }
      if (isMountedRef.current) setOngoingFreights(filteredOngoing);

      // ✅ Corrigir status APÓS setState, sem bloquear o fluxo
      if (inconsistentFreights.length > 0 && isMountedRef.current) {
        Promise.all(
          inconsistentFreights.map(item =>
            supabase
              .from('freights')
              .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
              .eq('id', item.id)
          )
        ).then(() => {
          if (isMountedRef.current) {
            if (import.meta.env.DEV) console.log('✅ Status dos fretes corrigidos automaticamente');
          }
        }).catch(err => {
          console.error('❌ Erro ao corrigir status dos fretes:', err);
        });
      }

      // ✅ OTIMIZADO: Usar query única com .in() ao invés de N+1
      if (freightData && freightData.length > 0) {
        const freightIds = freightData.map((f: any) => f.id);
        const checkinCounts = await fetchBatchCheckins(freightIds, profile.id);
        
        if (isMountedRef.current) {
          setFreightCheckins(prev => ({ ...prev, ...checkinCounts }));
        }
      }
    } catch (error) {
      console.error('Error fetching ongoing freights:', error);
      toast.error('Erro ao carregar fretes em andamento');
    }
  }, [profile?.id, profile?.role]);

  // Buscar solicitações de transporte (guincho, mudanças) disponíveis para motoristas
  const fetchTransportRequests = useCallback(async () => {
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    try {
      if (import.meta.env.DEV) console.log('🔍 Buscando solicitações de transporte para motorista:', profile.id);
      
      // ✅ SEGURANÇA: Usar view segura para proteção de PII do cliente
      const { data, error } = await supabase
        .from('service_requests_secure')
        .select('*')
        .in('service_type', ['GUINCHO', 'MUDANCA'])
        .eq('status', 'OPEN')
        .is('provider_id', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar solicitações de transporte:', error);
        throw error;
      }
      
      if (import.meta.env.DEV) console.log('🚛 Solicitações de transporte encontradas:', data?.length || 0);
      
      if (isMountedRef.current) setTransportRequests(data || []);
    } catch (error) {
      console.error('Error fetching transport requests:', error);
      toast.error('Erro ao carregar solicitações de transporte');
    }
  }, [profile?.id, profile?.role]);

  // Aceitar solicitação de transporte
  const handleAcceptTransportRequest = async (requestId: string) => {
    try {
      if (!profile?.id) {
        toast.error('Perfil não encontrado');
        return;
      }

      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: profile.id,
        p_request_id: requestId,
      });

      if (error) throw error;

      toast.success('Solicitação aceita com sucesso!');
      
      // ✅ PERF: Update otimista — mover da lista de disponíveis para aceitos
      setTransportRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Background refetch
      fetchTransportRequests();
      fetchOngoingFreights();
      setActiveTab('ongoing');
    } catch (error) {
      console.error('Error accepting transport request:', error);
      toast.error('Erro ao aceitar solicitação');
    }
  };

  // Marcar serviço como "A Caminho" (para usuários cadastrados)
  const handleMarkServiceOnTheWay = async (requestId: string) => {
    try {
      // ✅ PERF: Update otimista IMEDIATO
      setAcceptedServiceRequests(prev => 
        prev.map(r => r.id === requestId ? { ...r, status: 'ON_THE_WAY', updated_at: new Date().toISOString() } : r)
      );

      const { data, error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: requestId,
        p_next_status: 'ON_THE_WAY',
      });

      if (error) {
        // Rollback otimista
        await fetchOngoingFreights();
        throw error;
      }

      toast.success('Status atualizado: A Caminho!');
      // Background refetch para consistência
      setTimeout(() => fetchOngoingFreights(), 500);
    } catch (error) {
      console.error('Error updating service request:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  // Encerrar/Concluir serviço — usa RPC para garantir atomicidade e criar pagamento
  const handleFinishService = async (requestId: string) => {
    try {
      // ✅ PERF: Update otimista IMEDIATO — remover da lista de em andamento
      setAcceptedServiceRequests(prev => prev.filter(r => r.id !== requestId));

      const { data, error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: requestId,
        p_next_status: 'COMPLETED',
        p_final_price: null,
      });

      if (error) {
        // Rollback otimista
        await fetchOngoingFreights();
        throw error;
      }

      const result = data as any;
      if (!result?.success) {
        // Rollback otimista
        await fetchOngoingFreights();
        toast.error(result?.error || 'Não foi possível concluir o serviço');
        return;
      }

      toast.success('Serviço concluído com sucesso!');
      // Background refetch para consistência
      setTimeout(() => fetchOngoingFreights(), 500);
    } catch (error) {
      console.error('Error finishing service request:', error);
      toast.error('Erro ao finalizar serviço');
    }
  };

  // Helper para extrair preço da mensagem de contraproposta
  // Retorna { unitPrice, total, unit } para exibição consistente
  const parseCounterPriceInfo = useCallback((message: string): { unitPrice: number | null; total: number | null; unit: string | null } => {
    if (!message) return { unitPrice: null, total: null, unit: null };
    
    // Detectar tipo: PER_KM, PER_TON ou FIXED
    const isPerKm = /POR KM|\/km/i.test(message);
    const isPerTon = /POR TONELADA|\/ton/i.test(message);
    
    // Extrair valor unitário: "R$ 90/ton" ou "R$ 10/km"
    const unitPattern = /contra[- ]?proposta[^:]*:\s*R\$\s*([\d.,]+)\s*\/(km|ton)/i;
    const unitMatch = message.match(unitPattern);
    
    // Extrair total do "(Total: R$ 2.700,00 ...)"
    const totalPattern = /\(Total:\s*R\$\s*([\d.,]+)/i;
    const totalMatch = message.match(totalPattern);
    
    // Extrair preço fixo: "CONTRA-PROPOSTA: R$ 2.500,00" (sem /km ou /ton)
    const fixedPattern = /contra[- ]?proposta[^:]*:\s*R\$\s*([\d.,]+)/i;
    const fixedMatch = message.match(fixedPattern);
    
    const parseBR = (val: string) => {
      const cleaned = val.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return !isNaN(num) && num > 0 ? num : null;
    };
    
    if (isPerKm || isPerTon) {
      const unit = isPerKm ? 'km' : 'ton';
      const unitPrice = unitMatch ? parseBR(unitMatch[1]) : null;
      const total = totalMatch ? parseBR(totalMatch[1]) : null;
      return { unitPrice, total, unit };
    }
    
    // FIXED: o valor é o total
    const total = fixedMatch ? parseBR(fixedMatch[1]) : null;
    return { unitPrice: null, total, unit: null };
  }, []);
  
  // Backward compat wrapper
  const parseCounterPrice = useCallback((message: string): number | null => {
    const info = parseCounterPriceInfo(message);
    return info.total ?? info.unitPrice;
  }, [parseCounterPriceInfo]);

  const fetchCounterOffers = useCallback(async () => {
    if (!profile?.id || myProposals.length === 0) return;

    try {
      // Buscar TODAS as contrapropostas (não filtrar por read_at)
      const counterProposedFreightIds = myProposals
        .filter(p => p.status === 'COUNTER_PROPOSED')
        .map(p => p.freight_id);
      
      if (counterProposedFreightIds.length === 0) {
        if (isMountedRef.current) setCounterOffers([]);
        return;
      }

      const { data, error } = await supabase
        .from('freight_messages')
        .select('*')
        .eq('message_type', 'COUNTER_PROPOSAL')
        .in('freight_id', counterProposedFreightIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[fetchCounterOffers] Erro ao buscar contra-ofertas:', error);
        throw error;
      }

      // Buscar nomes dos senders separadamente via profiles_secure
      const messages = data || [];
      if (messages.length > 0) {
        const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
        const { data: senders } = await (supabase as any)
          .from('profiles_secure')
          .select('id, full_name')
          .in('id', senderIds);
        
        const senderMap = new Map((senders || []).map((s: any) => [s.id, s]));
        const enriched = messages.map(m => ({
          ...m,
          sender: senderMap.get(m.sender_id) || { full_name: 'Produtor' }
        }));
        if (isMountedRef.current) setCounterOffers(enriched);
      } else {
        if (isMountedRef.current) setCounterOffers([]);
      }
    } catch (error) {
      console.error('[fetchCounterOffers] Exception:', error);
    }
  }, [profile?.id, myProposals]);

  const handleAcceptCounterOffer = async (messageId: string, freightId: string) => {
    try {
      // 1. Buscar a contraproposta para extrair o preço
      const counterOffer = counterOffers.find(co => co.id === messageId);
      const counterPrice = counterOffer ? parseCounterPrice(counterOffer.message) : null;

      // 2. Buscar a proposta do motorista para este frete
      const proposal = myProposals.find(p => p.freight_id === freightId);
      if (!proposal) throw new Error('Proposta não encontrada');

      // 3. Atualizar proposta com o preço aceito e status ACCEPTED
      const updateData: any = { status: 'ACCEPTED' };
      if (counterPrice) {
        updateData.proposed_price = counterPrice;
      }
      
      const { error: proposalError } = await supabase
        .from('freight_proposals')
        .update(updateData)
        .eq('id', proposal.id)
        .eq('driver_id', profile?.id);

      if (proposalError) throw proposalError;

      // 4. Marcar mensagem como lida
      await supabase
        .from('freight_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      // 5. Chamar accept-freight-proposal edge function para criar assignment
      const { data: acceptData, error: acceptError } = await supabase.functions.invoke('accept-freight-proposal', {
        body: {
          proposal_id: proposal.id,
          producer_id: proposal.freight?.producer?.id || (proposal.freight as any)?.producer_id
        }
      });

      if (acceptError) {
        console.error('Erro ao aceitar via edge function:', acceptError);
        // Já atualizamos o status da proposta, o produtor pode aceitar manualmente
      }

      toast.success('Contra-proposta aceita com sucesso!');
      fetchCounterOffers();
      fetchMyProposals();
      fetchOngoingFreights();
      setProposalDetailsModal({ open: false, proposal: null });
    } catch (error) {
      console.error('Error accepting counter offer:', error);
      toast.error('Erro ao aceitar contra-proposta');
    }
  };

  const handleRejectCounterOffer = async (messageId: string) => {
    if (!confirm('Tem certeza que deseja recusar esta negociação? A proposta será encerrada.')) return;
    
    try {
      // 1. Encontrar a proposta associada
      const counterOffer = counterOffers.find(co => co.id === messageId);
      if (counterOffer) {
        const proposal = myProposals.find(p => p.freight_id === counterOffer.freight_id);
        if (proposal) {
          // Atualizar proposta para REJECTED
          await supabase
            .from('freight_proposals')
            .update({ status: 'REJECTED' })
            .eq('id', proposal.id)
            .eq('driver_id', profile?.id);
        }
      }

      // 2. Marcar mensagem como lida
      await supabase
        .from('freight_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      toast.success('Negociação encerrada');
      fetchCounterOffers();
      fetchMyProposals();
      setProposalDetailsModal({ open: false, proposal: null });
    } catch (error) {
      console.error('Error rejecting counter offer:', error);
      toast.error('Erro ao recusar contra-proposta');
    }
  };

  // Handler para abrir modal de contra-proposta do motorista
  const handleDriverCounterProposal = (proposal: any) => {
    if (!proposal?.freight) return;
    setDriverCounterModal({
      open: true,
      proposal,
      freight: proposal.freight
    });
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'ACCEPTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta aceita com sucesso!');
      fetchMyProposals();
    } catch (error) {
      console.error('Error accepting proposal:', error);
      toast.error('Erro ao aceitar proposta');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta rejeitada');
      fetchMyProposals();
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      toast.error('Erro ao rejeitar proposta');
    }
  };

  const handleCancelProposal = async (proposalId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta proposta?')) return;
    
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'CANCELLED' })
        .eq('id', proposalId)
        .eq('driver_id', profile?.id);
      
      if (error) throw error;
      
      toast.success('Proposta cancelada com sucesso');
      fetchMyProposals();
      setProposalDetailsModal({ open: false, proposal: null });
    } catch (error) {
      console.error('Erro ao cancelar proposta:', error);
      toast.error('Erro ao cancelar proposta');
    }
  };


  // Estado para contar check-ins
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [freightCheckins, setFreightCheckins] = useState<Record<string, number>>({});
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  // Função para buscar total de check-ins do motorista
  const fetchDriverCheckins = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const { count, error } = await supabase
        .from('freight_checkins' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);
      
      if (error) throw error;
      if (isMountedRef.current) setTotalCheckins(count || 0);
    } catch (error) {
      console.error('Error fetching checkins count:', error);
      if (isMountedRef.current) setTotalCheckins(0);
    }
  }, [profile?.id]);

  // Função para buscar pagamentos que o motorista pode confirmar
  // ✅ Busca pagamentos visíveis para o motorista:
  // - 'proposed': produtor propôs pagamento (motorista aguarda produtor pagar)
  // - 'paid_by_producer': produtor já pagou (motorista pode confirmar recebimento)
  const fetchPendingPayments = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      if (import.meta.env.DEV) console.log('🔍 Buscando pagamentos pendentes para driver:', profile.id);
      
      // ✅ FIX: Buscar pagamentos SEM join em profiles (CLS bloqueia colunas sensíveis)
      const { data: payments, error } = await supabase
        .from('external_payments')
        .select(`
          *,
          freight:freights!external_payments_freight_id_fkey(
            id,
            cargo_type,
            origin_city,
            origin_state,
            origin_address,
            destination_city,
            destination_state,
            destination_address,
            pickup_date,
            status,
            price
          )
        `)
        .eq('driver_id', profile.id)
        .in('status', ['proposed', 'paid_by_producer'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // ✅ FIX: Buscar dados do produtor via profiles_secure (contorna CLS)
      const producerIds = Array.from(new Set((payments || []).map((p: any) => p.producer_id).filter(Boolean)));
      let producerMap = new Map<string, any>();
      
      if (producerIds.length > 0) {
        const { data: producers } = await supabase
          .from('profiles_secure')
          .select('id, full_name, contact_phone, profile_photo_url')
          .in('id', producerIds);
        
        if (producers?.length) {
          producerMap = new Map(producers.map((p: any) => [p.id, p]));
        }
      }
      
      // Anexar produtor aos pagamentos
      const paymentsWithProducer = (payments || []).map((p: any) => ({
        ...p,
        producer: producerMap.get(p.producer_id) || null,
      }));
      
      if (import.meta.env.DEV) console.log('💰 Pagamentos pendentes:', paymentsWithProducer.length);
      
      if (isMountedRef.current) setPendingPayments(paymentsWithProducer);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      if (isMountedRef.current) setPendingPayments([]);
    }
  }, [profile?.id]);

  // Função para confirmar recebimento de pagamento e disparar avaliação
  // ✅ CORREÇÃO: Valida que o status é 'paid_by_producer' antes de confirmar
  const confirmPaymentReceived = async (payment: { id: string; freight_id: string; producer_id: string }) => {
    try {
      // Verificar se o pagamento existe e está no status correto
      const { data: existingPayment, error: checkError } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('id', payment.id)
        .single();

      if (checkError || !existingPayment) {
        toast.error('Pagamento não encontrado. Atualize a página e tente novamente.');
        return;
      }

      if (existingPayment.status === 'confirmed') {
        toast.info('Este pagamento já foi confirmado anteriormente.');
        fetchPendingPayments();
        return;
      }

      // ✅ CORREÇÃO: Validar que o produtor já confirmou que fez o pagamento
      if (existingPayment.status !== 'paid_by_producer') {
        toast.error('O produtor ainda não confirmou que fez o pagamento.', {
          description: 'Aguarde o produtor informar que efetuou o pagamento para você confirmar o recebimento.'
        });
        return;
      }

      const { error } = await supabase
        .from('external_payments')
        .update({ 
          status: 'confirmed',
          accepted_by_driver: true,
          accepted_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(), // ✅ Adicionar timestamp de confirmação
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)
        .eq('status', 'paid_by_producer'); // ✅ Double check no banco

      if (error) {
        console.error('Erro ao confirmar pagamento:', error);
        toast.error('Erro ao confirmar recebimento. Tente novamente.');
        return;
      }

      toast.success('Recebimento confirmado com sucesso! 🎉', {
        description: 'Agora você pode avaliar o produtor.'
      });
      fetchPendingPayments();

      // ✅ CORREÇÃO: Mover frete para COMPLETED após pagamento confirmado
      if (payment.freight_id) {
        try {
          if (import.meta.env.DEV) console.log('🏁 Movendo frete para COMPLETED:', payment.freight_id);
          
          const { error: freightUpdateError } = await supabase
            .from('freights')
            .update({
              status: 'COMPLETED',
              tracking_status: 'COMPLETED',
              updated_at: new Date().toISOString(),
              metadata: {
                payment_confirmed_at: new Date().toISOString(),
                moved_to_history_at: new Date().toISOString()
              }
            })
            .eq('id', payment.freight_id);

          if (freightUpdateError) {
            console.warn('Aviso: Erro ao mover frete para histórico:', freightUpdateError);
            // Não bloquear o fluxo, apenas logar
          } else {
            if (import.meta.env.DEV) console.log('✅ Frete movido para COMPLETED com sucesso');
            
            // Notificar UI que frete foi para histórico
            window.dispatchEvent(new CustomEvent('freight:movedToHistory', { 
              detail: { freightId: payment.freight_id } 
            }));
          }
        } catch (freightError) {
          console.warn('Aviso: Erro ao atualizar status do frete:', freightError);
        }
      }

      // Disparar modal de avaliação do produtor
      if (payment.freight_id && payment.producer_id) {
        try {
          const { data: producerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payment.producer_id)
            .single();

          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('show-freight-rating', {
              detail: {
                freightId: payment.freight_id,
                ratedUserId: payment.producer_id,
                ratedUserName: producerProfile?.full_name || 'Produtor'
              }
            }));
          }, 500);
        } catch (ratingError) {
          console.warn('Erro ao buscar dados para avaliação:', ratingError);
        }
      }
    } catch (error) {
      console.error('Erro ao confirmar recebimento:', error);
      toast.error('Erro ao confirmar recebimento. Tente novamente.');
    }
  };

  // Aliases para manter compatibilidade com handlers no JSX
  const handleConfirmPayment = confirmPaymentReceived;

  const handleDisputePayment = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('external_payments')
        .update({ 
          status: 'disputed',
          accepted_by_driver: false,
          disputed_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast.success('Pagamento contestado. O produtor será notificado.');
      fetchPendingPayments();
    } catch (error) {
      console.error('Error disputing payment:', error);
      toast.error('Erro ao contestar pagamento');
    }
  };

  // Função para verificar se existe checkin para um frete específico
  const checkFreightCheckins = useCallback(async (freightId: string) => {
    if (!profile?.id) return false;
    
    try {
      // Usar any para contornar problema de tipos do Supabase
      const { count, error } = await (supabase as any)
        .from('freight_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('freight_id', freightId)
        .eq('user_id', profile.id);
      
      if (error) throw error;
      
      const hasCheckins = (count || 0) > 0;
      setFreightCheckins(prev => ({ ...prev, [freightId]: count || 0 }));
      return hasCheckins;
    } catch (error) {
      console.error('Error checking freight checkins:', error);
      return false;
    }
  }, [profile?.id]);

  // Carregar dados - otimizado com fetches condicionais baseados em permissões
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id || !isMountedRef.current) return;
      
      // ✅ CORREÇÃO: Não carregar dados se não for motorista (evita erros 403)
      if (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO') {
        if (import.meta.env.DEV) console.log('[DriverDashboard] ⚠️ Usuário não é motorista, ignorando fetch');
        return;
      }
      
      if (isMountedRef.current) setLoading(true);
      
      console.log('[DriverDashboard] 🚀 Perfil:', { 
        isCompanyDriver, 
        canAcceptFreights, 
        canSeeFreights, 
        role: profile?.role 
      });
      
      try {
        // Construir lista de fetches baseado em permissões
        const fetchPromises = [
          fetchOngoingFreights(),
          fetchMyAssignments(),
          fetchDriverCheckins(),
          fetchPendingPayments()
        ];
        
        // ✅ Usar canSeeFreights: autônomos sempre veem, empresas só se permitido
        if (canSeeFreights) {
          fetchPromises.push(
            fetchAvailableFreights(),
            fetchMyProposals(),
            fetchTransportRequests()
          );
        } else {
          // Se não pode ver fretes, garantir que estados estão vazios
          if (isMountedRef.current) {
            setAvailableFreights([]);
            setMyProposals([]);
            setTransportRequests([]);
          }
        }
        
        await Promise.all(fetchPromises);
        
        // ✅ Se deve usar chat ou não pode ver fretes, ir para tab "ongoing"
        if (mustUseChat || !canSeeFreights) {
          setActiveTab('ongoing');
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error('Erro ao carregar dados do dashboard do motorista:', err);
          toast.error('Erro ao carregar dados do dashboard');
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    loadData();
  }, [profile?.id, profile?.role, canSeeFreights, mustUseChat]);

  // Listener para redirecionar para histórico quando frete for movido
  useEffect(() => {
    const handleMovedToHistory = () => {
      setActiveTab('history');
      setShowDetails(false);
      setSelectedFreightId(null);
      // Recarregar dados
      fetchOngoingFreights();
    };
    
    window.addEventListener('freight:movedToHistory', handleMovedToHistory);
    return () => window.removeEventListener('freight:movedToHistory', handleMovedToHistory);
  }, [fetchOngoingFreights]);

  // ✅ Listener para navegação automática para aba "Em Andamento" após aceitar frete
  useEffect(() => {
    const handleFreightAccepted = (event: CustomEvent) => {
      if (import.meta.env.DEV) console.log('🎯 Frete aceito, navegando para aba Em Andamento:', event.detail?.freightId);
      
      // Invalidar queries e recarregar dados
      queryClient.invalidateQueries({ queryKey: ['driver-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-freights'] });
      queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });
      
      fetchOngoingFreights();
      fetchMyAssignments();
      fetchAvailableFreights();
      
      // ✅ Navegar para aba "Em Andamento"
      setActiveTab('ongoing');
    };
    
    // Escutar ambos os eventos: freight:accepted (fretes rurais) e service_request:accepted (MOTO/GUINCHO/MUDANÇA)
    window.addEventListener('freight:accepted', handleFreightAccepted as EventListener);
    window.addEventListener('service_request:accepted', handleFreightAccepted as EventListener);
    
    return () => {
      window.removeEventListener('freight:accepted', handleFreightAccepted as EventListener);
      window.removeEventListener('service_request:accepted', handleFreightAccepted as EventListener);
    };
  }, [queryClient, fetchOngoingFreights, fetchMyAssignments, fetchAvailableFreights]);

  // ✅ CORREÇÃO: Criar versões debounced das funções de fetch
  const debouncedFetchOngoing = useCallback(
    debounce(() => {
      if (isMountedRef.current) fetchOngoingFreights();
    }, 300),
    [fetchOngoingFreights]
  );

  const debouncedFetchAssignments = useCallback(
    debounce(() => {
      if (isMountedRef.current) fetchMyAssignments();
    }, 300),
    [fetchMyAssignments]
  );

  const debouncedFetchAvailable = useCallback(
    debounce(() => {
      if (isMountedRef.current) fetchAvailableFreights();
    }, 300),
    [fetchAvailableFreights]
  );

  const debouncedFetchProposals = useCallback(
    debounce(() => {
      if (isMountedRef.current) fetchMyProposals();
    }, 300),
    [fetchMyProposals]
  );

  const debouncedFetchTransportRequests = useCallback(
    debounce(() => {
      if (isMountedRef.current) fetchTransportRequests();
    }, 300),
    [fetchTransportRequests]
  );

  // Atualizar em tempo real contadores e listas ao mudar fretes/propostas
  useEffect(() => {
    if (!profile?.id) return;
    
    // Monitoramento de mudanças de status para avaliação automática
    const ratingChannel = supabase
      .channel('driver-rating-trigger')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'freights',
        filter: `driver_id=eq.${profile.id}`
      }, async (payload) => {
        const newStatus = payload.new.status;
        const oldStatus = payload.old?.status;

        // ✅ CORREÇÃO: Avaliação SOMENTE após COMPLETED (pagamento confirmado)
        // Anteriormente disparava em DELIVERED_PENDING_CONFIRMATION, antes do pagamento
        if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          // Verificar se pagamento foi confirmado antes de mostrar avaliação
          const { data: confirmedPayment } = await supabase
            .from('external_payments')
            .select('id')
            .eq('freight_id', payload.new.id)
            .eq('status', 'confirmed')
            .maybeSingle();

          if (!confirmedPayment) return;

          const { data: freightData } = await supabase
            .from('freights')
            .select(`
              *,
              producer:profiles!freights_producer_id_fkey(id, full_name, role)
            `)
            .eq('id', payload.new.id)
            .single();

          if (freightData?.producer) {
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freightData.id)
              .eq('rater_id', profile.id)
              .maybeSingle();

            if (!existingRating) {
              setActiveFreightForRating(freightData as Freight);
            }
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'freight_assignments',
        filter: `driver_id=eq.${profile.id}`
      }, async (payload) => {
        const newStatus = payload.new.status;
        const oldStatus = payload.old?.status;

        // ✅ CORREÇÃO: Avaliação SOMENTE após COMPLETED (pagamento confirmado)
        if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          const { data: confirmedPayment } = await supabase
            .from('external_payments')
            .select('id')
            .eq('freight_id', payload.new.freight_id)
            .eq('status', 'confirmed')
            .maybeSingle();

          if (!confirmedPayment) return;

          const { data: freightData } = await supabase
            .from('freights')
            .select(`
              *,
              producer:profiles!freights_producer_id_fkey(id, full_name, role)
            `)
            .eq('id', payload.new.freight_id)
            .single();

          if (freightData?.producer) {
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freightData.id)
              .eq('rater_id', profile.id)
              .maybeSingle();

            if (!existingRating) {
              setActiveFreightForRating(freightData as Freight);
            }
          }
        }
      })
      .subscribe();

    // ✅ Canal normal de updates com debounce
    const channelBuilder = supabase.channel('realtime-freights-driver');
    
    // Sempre escutar mudanças nos fretes do motorista e assignments
    channelBuilder.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'freights',
      filter: `driver_id=eq.${profile.id}`
    }, () => {
      debouncedFetchOngoing(); // ✅ Debounced
    });
    
    channelBuilder.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'freight_assignments',
      filter: `driver_id=eq.${profile.id}`
    }, () => {
      debouncedFetchAssignments(); // ✅ Debounced
    });
    
    channelBuilder.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'external_payments', 
      filter: `driver_id=eq.${profile.id}` 
    }, (payload) => {
      if (import.meta.env.DEV) console.log('Mudança detectada em external_payments:', payload);
      fetchPendingPayments();
    });
    
    // ✅ Usar canSeeFreights para subscriptions
    if (canSeeFreights) {
      channelBuilder.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freights' 
      }, () => {
        debouncedFetchAvailable(); // ✅ Debounced
      });
      
      channelBuilder.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freight_matches' 
      }, () => {
        debouncedFetchAvailable(); // ✅ Debounced
      });
      
      channelBuilder.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freight_proposals' 
      }, () => {
        debouncedFetchProposals(); // ✅ Debounced
      });
      
      channelBuilder.on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'service_requests', 
        filter: `provider_id=eq.${profile.id}` 
      }, () => {
        debouncedFetchOngoing(); // ✅ Debounced
        debouncedFetchTransportRequests(); // ✅ Debounced
      });
    }
    
    const channel = channelBuilder.subscribe();

    return () => {
      // ✅ Cancelar debounces pendentes
      if (typeof (debouncedFetchOngoing as any).cancel === 'function') (debouncedFetchOngoing as any).cancel();
      if (typeof (debouncedFetchAssignments as any).cancel === 'function') (debouncedFetchAssignments as any).cancel();
      if (typeof (debouncedFetchAvailable as any).cancel === 'function') (debouncedFetchAvailable as any).cancel();
      if (typeof (debouncedFetchProposals as any).cancel === 'function') (debouncedFetchProposals as any).cancel();
      if (typeof (debouncedFetchTransportRequests as any).cancel === 'function') (debouncedFetchTransportRequests as any).cancel();
      
      supabase.removeChannel(ratingChannel);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, canSeeFreights, debouncedFetchOngoing, debouncedFetchAssignments, debouncedFetchAvailable, debouncedFetchProposals, debouncedFetchTransportRequests]);

  // Carregar contra-ofertas quando myProposals tiver itens COUNTER_PROPOSED
  // ✅ FIX: Depende de myProposals para evitar race condition onde counterOffers fica vazio
  const hasCounterProposed = useMemo(
    () => myProposals.some(p => p.status === 'COUNTER_PROPOSED'),
    [myProposals]
  );
  
  useEffect(() => {
    if (!profile?.id || !hasCounterProposed) {
      // Limpar counterOffers se não há mais propostas COUNTER_PROPOSED
      if (!hasCounterProposed && counterOffers.length > 0) {
        setCounterOffers([]);
      }
      return;
    }
    
    const timeoutId = setTimeout(() => {
      fetchCounterOffers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [profile?.id, hasCounterProposed, fetchCounterOffers]);

  // ✅ Filtrar assignments ativos usando função canônica isFinalStatus + filtro de data
  const activeAssignments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return (myAssignments || []).filter(assignment => {
      if (!assignment) return false;
      
      const freightStatus = assignment.freight?.status;
      const assignmentStatus = assignment.status;

      const freightFinal = freightStatus ? isFinalStatus(freightStatus) : false;
      const assignmentFinal = assignmentStatus ? isFinalStatus(assignmentStatus) : false;

      // Excluir de "Em Andamento" se qualquer um for final
      if (freightFinal || assignmentFinal) return false;
      
      // Filtrar por data: só mostrar em "Em Andamento" se pickup_date <= hoje
      const pickupDate = assignment.freight?.pickup_date;
      if (pickupDate) {
        const date = new Date(pickupDate);
        date.setHours(0, 0, 0, 0);
        return date <= today;
      }
      
      return true; // Se não tem pickup_date, manter comportamento anterior
    });
  }, [myAssignments]);

  // Calcular estatísticas - memoizado para performance
  const statistics = useMemo(() => {
    const acceptedProposals = myProposals.filter(p => p.status === 'ACCEPTED');
    const pendingProposalsCount = myProposals.filter(p => p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED').length;
    
    // ✅ FIX: Filtro robusto - excluir fretes agendados (pickup_date futura) do contador
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isCurrentOrPast = (item: any) => {
      const status = String(item?.status || '').toUpperCase();
      // Fretes em status ativo (não ACCEPTED/OPEN) sempre contam
      if (status !== 'ACCEPTED' && status !== 'OPEN') return true;
      // ACCEPTED/OPEN: só conta se pickup_date <= hoje
      const pickupDate = item?.pickup_date;
      if (!pickupDate) return true;
      const d = new Date(pickupDate);
      d.setHours(0, 0, 0, 0);
      return d <= today;
    };
    
    // Contar fretes ativos diretos (sem assignments, com filtro de data)
    const activeFreightsCount = visibleOngoing.filter(isCurrentOrPast).length;
    
    // Contar assignments ativos (com filtro de data no frete)
    const activeAssignmentsCount = activeAssignments.filter(a => {
      const freight = a.freight || a;
      return isCurrentOrPast(freight);
    }).length;
    
    // Contar service requests ativos (GUINCHO, MUDANÇA, PET, PACOTES, etc.)
    const activeServiceRequestsCount = acceptedServiceRequests.length;
    
    // Total de viagens ativas = fretes diretos + assignments + service requests
    const activeTripsCount = activeFreightsCount + activeAssignmentsCount + activeServiceRequestsCount;
    
    if (import.meta.env.DEV) console.log('[stats] activeTrips:', activeTripsCount, '(freights:', activeFreightsCount, 'assignments:', activeAssignmentsCount, 'services:', activeServiceRequestsCount, ')');
    
    return {
      activeTrips: activeTripsCount,
      completedTrips: acceptedProposals.filter(p => p.freight?.status === 'DELIVERED').length,
      availableCount: availableFreights.length + transportRequests.length,
      totalEarnings: acceptedProposals
        .filter(p => p.freight?.status === 'DELIVERED')
        .reduce((sum, proposal) => sum + (proposal.proposed_price || 0), 0),
      totalCheckins: totalCheckins,
      pendingProposals: pendingProposalsCount,
    };
  }, [myProposals, availableFreights, totalCheckins, visibleOngoing, activeAssignments, acceptedServiceRequests]);

  const handleLogout = async () => {
    // ✅ Logout silencioso - sem toasts
    await signOut();
  };

  const handleMenuClick = () => {
    // Menu lateral funcionalidade futura
    console.log('Menu clicked');
  };

  const handleFreightAction = async (freightId: string, action: 'propose' | 'accept' | 'complete' | 'cancel' | 'proposal_sent') => {
    if (!profile?.id) return;

    // Travar reentrância (evita múltiplas tentativas gerando mensagens duplicadas)
    const lockKey = `${action}:${freightId}`;
    if (action === 'propose' || action === 'accept') {
      if (freightActionInFlightRef.current.has(lockKey)) return;
      freightActionInFlightRef.current.add(lockKey);
    }

    try {
      // Proposta já foi enviada pelo modal - apenas atualizar dados
      if (action === 'proposal_sent') {
        fetchMyProposals();
        return;
      }

      if (action === 'cancel') {
        // Cancelar proposta/aceite
        const { error } = await supabase
          .from('freight_proposals')
          .update({ status: 'CANCELLED' })
          .eq('freight_id', freightId)
          .eq('driver_id', profile.id)
          .eq('status', 'PENDING');

        if (error) throw error;
        
        toast.success('Proposta cancelada com sucesso!');
        fetchMyProposals();
        return;
      }

      if (action === 'propose' || action === 'accept') {
        // Buscar proposta existente (se houver)
        const { data: existingProposal, error: existingError } = await supabase
          .from('freight_proposals')
          .select('id, status')
          .eq('freight_id', freightId)
          .eq('driver_id', profile.id)
          .maybeSingle();
        if (existingError) throw existingError;

        // Encontrar o frete selecionado
        const freight = availableFreights.find(f => f.id === freightId);
        if (!freight) return;

        if (action === 'propose') {
          // Impedir múltiplas propostas ativas para o mesmo frete (apenas ao propor)
          if (existingProposal && (existingProposal.status === 'PENDING' || existingProposal.status === 'ACCEPTED')) {
            toast.info(
              existingProposal.status === 'PENDING'
                ? 'Você já enviou uma contra proposta para este frete. Aguarde a resposta.'
                : 'Sua proposta já foi aceita.'
            );
            return;
          }

          // Criar nova proposta pendente
          const { error } = await supabase
            .from('freight_proposals')
            .insert({
              freight_id: freightId,
              driver_id: profile.id,
              proposed_price: freight.price,
              status: 'PENDING',
              message: null,
            });
          if (error) throw error;

          toast.success('Contra proposta enviada. Aguarde a resposta.');
        } else if (action === 'accept') {
          // Check if user is a transport company
          const { data: transportCompanyData } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', profile.id)
            .maybeSingle();

          const isTransportCompany = !!transportCompanyData || profile.active_mode === 'TRANSPORTADORA';

          // Only require location for non-transport companies
          // ✅ Usa isLocationEnabled que considera permissão real do dispositivo
          if (!isTransportCompany && !isLocationEnabled) {
            toast.error('❌ Você precisa ativar a localização para aceitar fretes', {
              description: 'Vá em Configurações → Localização para ativar'
            });
            return;
          }

          // ✅ FASE 1 - CRÍTICO: Verificar status de validação antes de aceitar
          if (profile.status !== 'APPROVED') {
            toast.error('❌ Seus documentos ainda estão em validação', {
              description: 'Aguarde a aprovação do administrador para aceitar fretes'
            });
            return;
          }
          
          // Verificar se já tem consentimento de tracking
          const { data: existingConsent } = await supabase
            .from('tracking_consents')
            .select('id, consent_given')
            .eq('freight_id', freightId)
            .eq('user_id', profile.user_id)
            .maybeSingle();
            
          if (!existingConsent?.consent_given) {
            // Mostrar modal de consentimento ANTES de aceitar
            setFreightAwaitingConsent(freightId);
            setShowTrackingConsentModal(true);
            return;
          }

          // Verificar se o solicitante tem cadastro completo
          const { data: checkData, error: checkError } = await (supabase as any).functions.invoke('check-freight-requester', {
            body: { freight_id: freightId },
          });

          if (checkError) {
            throw checkError;
          }

          if (!checkData?.has_registration) {
            toast.error('O solicitante não possui cadastro. Este frete foi movido para o histórico.');
            return;
          }

          // ✅ CORREÇÃO: Verificar TODOS os status de assignment (incluindo DELIVERED_PENDING_CONFIRMATION)
          const activeStatuses = ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED_PENDING_CONFIRMATION'] as const;

          // 1) Verificar se já existe atribuição ativa para ESTE frete (evita 409)
          let assignmentQuery = supabase
            .from('freight_assignments')
            .select('id,status')
            .eq('freight_id', freightId)
            .in('status', activeStatuses);

          if (isTransportCompany && transportCompanyData?.id) {
            assignmentQuery = assignmentQuery.eq('company_id', transportCompanyData.id);
          } else {
            assignmentQuery = assignmentQuery.eq('driver_id', profile.id);
          }

          const { data: existingAssignment } = await assignmentQuery.maybeSingle();

          if (existingAssignment) {
            const statusMsg = existingAssignment.status === 'DELIVERED_PENDING_CONFIRMATION' 
              ? 'Sua entrega está aguardando confirmação do produtor.'
              : 'Abrindo seus fretes em andamento…';
            toast.info('Você já aceitou este frete', {
              description: statusMsg,
            });
            setActiveTab('ongoing');
            return;
          }

          // 2) Motorista autônomo: verificar se já tem QUALQUER frete ativo (Edge Function linha 342-386)
          if (!isTransportCompany && profile?.id) {
            // Checar freights.driver_id
            const { data: activeFreights } = await supabase
              .from('freights')
              .select('id, cargo_type')
              .eq('driver_id', profile.id)
              .in('status', activeStatuses);

            // Checar freight_assignments.driver_id
            const { data: activeAssignments } = await supabase
              .from('freight_assignments')
              .select('id, freight_id')
              .eq('driver_id', profile.id)
              .in('status', activeStatuses);

            const totalActive = (activeFreights?.length || 0) + (activeAssignments?.length || 0);

            if (totalActive > 0) {
              const currentCargo = activeFreights?.[0]?.cargo_type || 'Carga';
              toast.error('Você já possui um frete em andamento', {
                description: `Complete a entrega atual (${currentCargo}) antes de aceitar um novo frete.`,
              });
              setActiveTab('ongoing');
              return;
            }
          }

          // Aceitação direta: não bloquear por proposta existente
          // Aceitar via Edge Function (bypass RLS com service role)
          const { data: acceptData, error: acceptError } = await (supabase as any).functions.invoke('accept-freight-multiple', {
            body: { freight_id: freightId, num_trucks: 1 },
          });

          console.log('[handleFreightAction] Edge function response:', { acceptData, acceptError });

          if (acceptError) {
            console.error('[handleFreightAction] Error details:', {
              message: acceptError.message,
              acceptData,
              context: acceptError.context
            });
            
            // Supabase JS v2: error response body may be in acceptData OR error.context
            let errorBody = acceptData;
            if (!errorBody && acceptError.context?.body) {
              errorBody = acceptError.context.body;
              if (typeof errorBody === 'string') {
                try { errorBody = JSON.parse(errorBody); } catch (e) { /* ignore */ }
              }
            }
            
            // Extract user-friendly message
            let errorMsg = errorBody?.error || acceptError.message || 'Falha ao aceitar o frete';
            let errorDetails = errorBody?.details || '';
            const errorCode = errorBody?.code;

            // ✅ Tratamento robusto de erros conhecidos
            const alreadyAccepted =
              errorCode === 'ALREADY_ACCEPTED' ||
              errorCode === 'PENDING_CONFIRMATION' ||
              (typeof errorMsg === 'string' &&
                (errorMsg.includes('active assignment') || 
                 errorMsg.includes('already have an active assignment') ||
                 errorMsg.includes('Você já aceitou')));

            if (alreadyAccepted || errorCode === 'ALREADY_ACCEPTED') {
              toast.info('Você já aceitou este frete', {
                description: errorDetails || 'Você já tem uma carreta aceita para este frete. Abrindo seus fretes em andamento…',
              });

              // Atualizar listas e ir para "Em Andamento" (comportamento idempotente)
              queryClient.invalidateQueries({ queryKey: ['driver-assignments'] });
              queryClient.invalidateQueries({ queryKey: ['available-freights'] });
              queryClient.invalidateQueries({ queryKey: ['driver-proposals'] });
              queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });
              await queryClient.refetchQueries({ queryKey: ['driver-assignments'] });
              fetchOngoingFreights();
              fetchMyProposals();
              setActiveTab('ongoing');
              return;
            }

            if (errorCode === 'PENDING_CONFIRMATION') {
              toast.info('Entrega aguardando confirmação', {
                description: errorDetails || 'Aguarde a confirmação do produtor.',
              });
              setActiveTab('ongoing');
              return;
            }

            // ✅ PT-BR fallback (evitar inglês na UI)
            if (
              typeof errorMsg === 'string' &&
              (errorMsg.includes('Edge function returned') || /\d{3}/.test(errorMsg))
            ) {
              errorMsg = 'Não foi possível aceitar o frete';
            }

            toast.error(errorMsg, { description: errorDetails });
            return;
          }
          if (!acceptData?.success) {
            toast.error('Falha ao aceitar o frete');
            return;
          }

          toast.success(
            freight.service_type === 'GUINCHO'
              ? 'Chamado aceito com sucesso!'
              : freight.service_type === 'MUDANCA'
              ? 'Orçamento enviado com sucesso!'
              : 'Frete aceito com sucesso!'
          );

          // ✅ INVALIDAR CACHE DO REACT QUERY para forçar refetch imediato
          queryClient.invalidateQueries({ queryKey: ['driver-assignments'] });
          queryClient.invalidateQueries({ queryKey: ['available-freights'] });
          queryClient.invalidateQueries({ queryKey: ['driver-proposals'] });
          queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });

          // Forçar refetch imediato das queries para obter dados atualizados do banco
          await queryClient.refetchQueries({ queryKey: ['driver-assignments'] });

          // Atualizar listas locais
          fetchOngoingFreights();
          fetchMyProposals();
          
          // Mudar para tab "Em Andamento"
          setActiveTab('ongoing');
        }

      }
    } catch (error: any) {
      console.error('Error handling freight action:', error);
      toast.error('Erro ao processar ação. Tente novamente.');
    } finally {
      if (action === 'propose' || action === 'accept') {
        freightActionInFlightRef.current.delete(lockKey);
      }
    }
  };

  const handleFreightWithdrawal = (freight: Freight) => {
    // Blindagem adicional: só permitir desistência se ACCEPTED ou LOADING
    if (!['ACCEPTED','LOADING'].includes(freight.status)) {
      toast.error('Não é possível desistir do frete neste status.');
      return;
    }
    setSelectedFreightForWithdrawal(freight);
    setShowWithdrawalModal(true);
  };

  const confirmFreightWithdrawal = async () => {
    if (!profile?.id || !selectedFreightForWithdrawal) return;

    try {
      const freightId = selectedFreightForWithdrawal.id;

      // Verificação rápida no cliente (mensagem mais amigável)
      const hasCheckins = await checkFreightCheckins(freightId);
      if (hasCheckins) {
        toast.error('Não é possível desistir do frete após o primeiro check-in.');
        return;
      }

      // Processar via Edge Function para evitar bloqueios de RLS
      const { data, error } = await (supabase as any).functions.invoke('withdraw-freight', {
        method: 'POST',
        body: { freight_id: freightId },
      });

      if (error) {
        // Edge function pode retornar erro sem lançar exception
        console.error('withdraw-freight error:', error);
        const msg = (error as any)?.message || 'Erro ao processar desistência. Tente novamente.';
        toast.error(msg);
        return;
      }

      if (data?.error === 'HAS_CHECKINS') {
        toast.error('Não é possível desistir do frete após o primeiro check-in.');
        return;
      }

      toast.success('Desistência processada. O frete está novamente disponível para outros motoristas.');

      // Fechar modal e atualizar listas
      setShowWithdrawalModal(false);
      setSelectedFreightForWithdrawal(null);

      // ✅ INVALIDAR CACHE DO REACT QUERY para forçar refetch imediato
      queryClient.invalidateQueries({ queryKey: ['driver-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['available-freights'] });
      queryClient.invalidateQueries({ queryKey: ['driver-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['ongoing-freights'] });
      
      // Forçar refetch imediato das queries
      await queryClient.refetchQueries({ queryKey: ['driver-assignments'] });
      
      fetchOngoingFreights();
      fetchMyProposals();
    } catch (error: any) {
      console.error('Error processing freight withdrawal:', error);
      toast.error('Erro ao processar desistência. Tente novamente.');
    }
  };

  // Função para cancelar frete aceito - usa Edge Function obrigatoriamente
  const handleFreightCancel = async (freightId: string) => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
        body: {
          freight_id: freightId,
          reason: 'Cancelado pelo motorista',
        },
      });

      if (error) throw error;

      toast.success('Frete cancelado com sucesso! O frete está novamente disponível para outros motoristas.');
      
      // Atualizar as listas
      fetchOngoingFreights();
      fetchMyProposals();
      
    } catch (error: any) {
      console.error('Error canceling freight:', error);
      toast.error(error?.message || 'Erro ao cancelar frete. Tente novamente.');
    }
  };

  if (loading) {
    return <AppSpinner fullscreen />;
  }

  if (showDetails && selectedFreightId) {
    return (
      <FreightDetails
        freightId={selectedFreightId}
        currentUserProfile={profile}
        initialTab={(location.state as any)?.notificationType === 'chat_message' || (location.state as any)?.notificationType === 'advance_request' ? 'chat' : 'status'}
        onClose={() => {
          setShowDetails(false);
          setSelectedFreightId(null);
        }}
        onFreightWithdraw={(freight) => {
          handleFreightWithdrawal(freight);
          setShowDetails(false);
          setSelectedFreightId(null);
        }}
      />
    );
  }

  return (
    <PageDOMErrorBoundary>
      <div className="min-h-screen bg-background">
        <Header
          user={{ 
            name: profile?.full_name || (profile?.active_mode === 'TRANSPORTADORA' ? 'Transportadora' : 'Motorista'), 
            role: 'MOTORISTA' 
          }}
          onMenuClick={handleMenuClick}
          onLogout={handleLogout}
          userProfile={profile}
          notifications={unreadCount}
        />
      {/* Hero Section Compacto */}
      <DriverDashboardHero
        profileName={profile?.full_name}
        activeMode={profile?.active_mode}
        isCompanyDriver={isCompanyDriver}
        companyName={companyName}
        canSeeFreights={canSeeFreights}
        onTabChange={setActiveTab}
        onServicesModalOpen={() => setServicesModalOpen(true)}
      />

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Stats Cards Compactos - Navegáveis */}
        <DriverDashboardStats
          canSeeFreights={canSeeFreights}
          availableCount={availableCountUI}
          activeTrips={statistics.activeTrips}
          pendingProposals={statistics.pendingProposals}
          showEarnings={showEarnings}
          toggleEarnings={toggleEarnings}
          isCompanyDriver={isCompanyDriver}
          isAffiliated={isAffiliated}
          onTabChange={setActiveTab}
        />

        {/* Botão Mural de Avisos */}
        <div className="mb-6">
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

        {/* Tabs Compactas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
             <TabsList className="inline-flex h-11 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              {/* ✅ Mostrar tab "available" se canSeeFreights */}
              {canSeeFreights && (
                <TabsTrigger 
                  value="available" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <Brain className="h-3.5 w-3.5 mr-1" />
                  <span>{FRETES_IA_LABEL}</span>
                  <TabBadge count={availableFreights.length} />
                </TabsTrigger>
              )}
              <TabsTrigger
                value="ongoing" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-ongoing"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Em Andamento</span>
                <TabBadge count={visibleOngoing.length + activeAssignments.length + acceptedServiceRequests.length} />
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Agendados</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calendar" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MapPin className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">{AREAS_IA_LABEL}</span>
                <span className="sm:hidden">Áreas</span>
              </TabsTrigger>
              <TabsTrigger 
                value="cities" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-cities"
              >
                <MapPin className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Cidades</span>
                <span className="sm:hidden">Cidades</span>
              </TabsTrigger>
              {/* ✅ Mostrar tab "my-trips" (propostas) se canSeeFreights */}
              {canSeeFreights && (
                <TabsTrigger 
                  value="my-trips" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  <span translate="no">Propostas</span>
                  <TabBadge count={statistics.pendingProposals} />
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-services"
              >
                <Settings className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Serviços</span>
              </TabsTrigger>
              <TabsTrigger 
                value="my-requests" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-my-requests"
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Solicitações</span>
              </TabsTrigger>
              <TabsTrigger
                value="vehicles" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-vehicles"
              >
                <Truck className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline" translate="no">Meus Veículos</span>
                <span className="sm:hidden" translate="no">Veículos</span>
              </TabsTrigger>
              {/* Tabs de pagamentos e saldo - apenas para motoristas não afiliados */}
              {!isCompanyDriver && !isAffiliated && (
                <>
                  <TabsTrigger 
                    value="payments" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" />
                    <span translate="no">Pagamentos</span>
                    <TabBadge count={pendingPayments.filter(p => p.status === 'paid_by_producer').length} />
                  </TabsTrigger>
                  <TabsTrigger 
                    value="advances" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Banknote className="h-3.5 w-3.5 mr-1" />
                    <span translate="no">Saldo</span>
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger 
                value="ratings" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Avaliações</span>
                <TabBadge count={pendingRatingsCount} />
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-chat"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Chat</span>
                <TabBadge count={chatUnreadCount} />
              </TabsTrigger>
              <TabsTrigger 
                value="historico" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-history"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Histórico</span>
              </TabsTrigger>
              <TabsTrigger 
                value="affiliations" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Afiliações</span>
              </TabsTrigger>
              <TabsTrigger 
                value="fiscal" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Fiscal</span>
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-reports"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                <span translate="no">Relatórios</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Notificação de assinatura */}
          <div className="mb-4">
            <SubscriptionExpiryNotification />
          </div>

          {/* Badge de motorista de empresa/afiliado */}
          {isCompanyDriver && companyName && (
            <div className="mb-4">
              <CompanyDriverBadge companyName={companyName} isAffiliated={isAffiliated} />
            </div>
          )}

          {/* Controle unificado de rastreamento */}
          <UnifiedTrackingControl />
          
          {/* ✅ Banner informativo para afiliados sem permissão de aceitar fretes */}
          {isAffiliated && !canAcceptFreights && (
            <Alert className="mb-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">Motorista Afiliado</AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Você é motorista afiliado a <strong>{companyName}</strong>. As negociações de fretes ocorrem via transportadora. 
                Entre em contato com a empresa pelo chat para informações sobre fretes disponíveis.
              </AlertDescription>
            </Alert>
          )}

          {/* ✅ FASE 4 - Alerta de Localização Desativada (apenas para motoristas independentes) */}
          {/* Usa isLocationEnabled que verifica permissão real do dispositivo */}
          {!isTransportCompany && !isLocationEnabled && !isLocationSyncing && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Localização Desativada</AlertTitle>
              <AlertDescription>
                Você não pode aceitar fretes sem localização ativa.
                <Button 
                  variant="link" 
                  onClick={() => navigate('/complete-profile')}
                  className="p-0 h-auto ml-2 text-destructive-foreground underline"
                >
                  Ativar agora
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* ✅ FASE 1/3 - Alerta de Documentos Pendentes */}
          {profile?.status === 'PENDING' && (
            <Alert variant="default" className="mb-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">Documentos em Validação</AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                Seus documentos estão sendo analisados. Você poderá aceitar fretes após a aprovação.
              </AlertDescription>
            </Alert>
          )}
          
          <TabsContent value="available" className="space-y-4">
            <DriverAvailableTab
              profileId={profile?.id}
              onFreightAction={handleFreightAction}
              onCountsChange={({ total }) => setAvailableCountUI(total)}
              onFetchAvailable={fetchAvailableFreights}
            />
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-3">
            {/*
              ✅ Restauração do card completo de frete em andamento.
              O bloco abaixo estava usando um card “simplificado” (só De/Para/Valor) e por isso sumiram:
              - botões de status (A caminho / Carregado / Em trânsito / Entrega)
              - ações completas (cancelamento, acesso a NF-es, adiantamento via tela de detalhes)
              - e a cidade/UF aparecia no formato errado.

              A aba volta a usar o componente dedicado DriverOngoingTab (fonte única do card em andamento).
            */}
            <DriverOngoingTab />
          </TabsContent>

          <TabsContent value="scheduled">
            <DriverScheduledTab />
          </TabsContent>


          <TabsContent value="calendar" className="space-y-4">
            <DriverAreasTab
              driverId={profile?.id}
              onFreightAction={handleFreightAction}
              canAcceptFreights={canAcceptFreights}
              isAffiliated={isAffiliated}
              companyId={companyId}
            />
          </TabsContent>

          <TabsContent value="cities" className="space-y-4">
            <DriverCitiesTab
              onCitiesUpdate={() => {
                fetchAvailableFreights();
                toast.success('Configuração de cidades atualizada!');
              }}
            />
          </TabsContent>

          <TabsContent value="services">
            <DriverServicesTab />
          </TabsContent>

          <TabsContent value="my-requests">
            <MyRequestsTab />
          </TabsContent>

          <TabsContent value="my-trips" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Minhas Propostas Enviadas</h3>
              <Badge variant="secondary" className="text-sm font-medium">
                {myProposals.filter(p => p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED').length} proposta{myProposals.filter(p => p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED').length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {myProposals.some(p => p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED') ? (
              <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando propostas...</div>}>
                  {myProposals.filter(p => p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED').map((proposal) => 
                    proposal.freight && proposal.id ? (
                      <div 
                        key={proposal.id} 
                        className="relative cursor-pointer rounded-xl border bg-card shadow-sm overflow-hidden"
                        role="button"
                        tabIndex={0}
                        onClick={() => setProposalDetailsModal({ open: true, proposal })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setProposalDetailsModal({ open: true, proposal });
                          }
                        }}
                      >
                         <FreightCard 
                           freight={{
                             ...proposal.freight,
                             status: proposal.freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED',
                             service_type: proposal.freight.service_type 
                               ? normalizeServiceType(proposal.freight.service_type) 
                               : undefined
                           }}
                          showActions={false}
                        />
                        
                        {/* Informações compactas da proposta */}
                        {(() => {
                          // Buscar a ÚLTIMA contraproposta (sem filtrar por read_at)
                          const matchingCounterOffer = proposal.status === 'COUNTER_PROPOSED' 
                            ? counterOffers.find(co => co.freight_id === proposal.freight_id)
                            : null;
                          
                          // Extrair informações completas da contraproposta
                          const counterInfo = matchingCounterOffer 
                            ? parseCounterPriceInfo(matchingCounterOffer.message) 
                            : { unitPrice: null, total: null, unit: null };
                          
                          const driverTotal = proposal.proposed_price;
                          const driverUnitPrice = proposal.proposal_unit_price;
                          const driverPricingType = proposal.proposal_pricing_type;
                          
                          const counterUnit = counterInfo.unitPrice;
                          const counterTotal = counterInfo.total;
                          const counterUnitLabel = counterInfo.unit;
                          
                          // Derivar valor unitário: usar proposal_unit_price se existir,
                          // senão calcular a partir do total e dados do frete
                          const freightPricingType = proposal.freight?.pricing_type;
                          const effectivePricingType = (driverPricingType && driverPricingType !== 'FIXED') ? driverPricingType : freightPricingType;
                          
                          let derivedUnitPrice = driverUnitPrice;
                          let unitSuffix = '';
                          
                          if (effectivePricingType === 'PER_TON') {
                            unitSuffix = '/ton';
                            if (!derivedUnitPrice && driverTotal && proposal.freight?.weight) {
                              const weightInTons = proposal.freight.weight >= 1000 ? proposal.freight.weight / 1000 : proposal.freight.weight;
                              derivedUnitPrice = driverTotal / weightInTons;
                            }
                          } else if (effectivePricingType === 'PER_KM') {
                            unitSuffix = '/km';
                            if (!derivedUnitPrice && driverTotal && proposal.freight?.distance_km) {
                              derivedUnitPrice = driverTotal / proposal.freight.distance_km;
                            }
                          }
                          
                          const driverDisplayValue = derivedUnitPrice && unitSuffix
                            ? `R$ ${derivedUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unitSuffix}`
                            : `R$ ${driverTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                          
                          return (
                            <div className={`p-3 border-t ${proposal.status === 'COUNTER_PROPOSED' ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20' : 'bg-gradient-to-r from-card to-secondary/10'}`}>
                              {/* Valor do motorista */}
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">Sua Proposta:</span>
                                <span className={`text-lg font-bold ${proposal.status === 'COUNTER_PROPOSED' ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                                  {driverDisplayValue}
                                </span>
                              </div>

                              {/* Contraproposta do produtor */}
                              {proposal.status === 'COUNTER_PROPOSED' && (
                                <div className="mb-2 p-2 bg-orange-100/50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                                      💰 Contraproposta:
                                    </span>
                                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                      {counterUnit && counterUnitLabel
                                        ? `R$ ${counterUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/${counterUnitLabel}`
                                        : counterTotal 
                                          ? `R$ ${counterTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                                          : 'Ver detalhes'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    de {matchingCounterOffer?.sender?.full_name || 'Produtor'} • {matchingCounterOffer ? new Date(matchingCounterOffer.created_at).toLocaleDateString('pt-BR') : ''}
                                  </p>
                                </div>
                              )}

                              {/* Botões de ação para contraproposta - 3 opções */}
                              {proposal.status === 'COUNTER_PROPOSED' && (
                                <div className="flex gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="sm"
                                    className="flex-1 gradient-primary text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (matchingCounterOffer) {
                                        handleAcceptCounterOffer(matchingCounterOffer.id, proposal.freight_id);
                                      }
                                    }}
                                  >
                                    Aceitar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDriverCounterProposal(proposal);
                                    }}
                                  >
                                    Negociar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (matchingCounterOffer) {
                                        handleRejectCounterOffer(matchingCounterOffer.id);
                                      }
                                    }}
                                  >
                                    Recusar
                                  </Button>
                                </div>
                              )}
                          
                              <div className="flex justify-between items-center">
                                <Badge 
                                  variant={
                                    proposal.status === 'ACCEPTED' ? 'default' :
                                    proposal.status === 'COUNTER_PROPOSED' ? 'outline' :
                                    proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                                  }
                                  className={`text-xs ${proposal.status === 'COUNTER_PROPOSED' ? 'border-orange-400 text-orange-700 dark:text-orange-400' : ''}`}
                                >
                                  {proposal.status === 'ACCEPTED' ? '✅ Aceita' :
                                   proposal.status === 'COUNTER_PROPOSED' ? '🔄 Em Negociação' :
                                   proposal.status === 'PENDING' ? '⏳ Pendente' : '❌ Rejeitada'}
                                </Badge>
                                
                                <span className="text-xs text-muted-foreground">
                                  Enviada {new Date(proposal.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                          
                              {proposal.message && proposal.status !== 'COUNTER_PROPOSED' && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-xs text-muted-foreground mb-1">Mensagem:</p>
                                  <p className="text-sm">{proposal.message}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : null
                  )}
                </SafeListWrapper>
              </div>
            ) : (
              <div className="text-center py-12 space-y-6">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-muted-foreground" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    Comece Enviando Propostas
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Suas propostas enviadas aparecerão aqui. Explore os fretes disponíveis e envie propostas para começar a trabalhar.
                  </p>
                </div>

                {/* Cards informativos */}
                <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
                  <Card className="p-4">
                    <div className="text-center space-y-2">
                      <Brain className="h-8 w-8 text-primary mx-auto" />
                      <h4 className="font-medium">IA Inteligente</h4>
                      <p className="text-sm text-muted-foreground">
                        Nossa IA encontra fretes compatíveis com seu perfil automaticamente
                      </p>
                    </div>
                  </Card>
                  
                  <Card className="p-4">
                    <div className="text-center space-y-2">
                      <DollarSign className="h-8 w-8 text-green-500 mx-auto" />
                      <h4 className="font-medium">Melhores Preços</h4>
                      <p className="text-sm text-muted-foreground">
                        Valores baseados na tabela ANTT para garantir preços justos
                      </p>
                    </div>
                  </Card>
                </div>


                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => setActiveTab('available')}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    {VER_FRETES_IA_LABEL}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab('services')}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Configurar Perfil
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="counter-offers" className="space-y-4">
            <SafeListWrapper>
              <h3 className="text-lg font-semibold">Contra-ofertas Recebidas</h3>
            {counterOffers.length > 0 ? (
              <div className="space-y-4">
                <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando ofertas...</div>}>
                  {counterOffers.map((offer) => (
                    <Card key={offer.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">
                              Contra-proposta de {offer.sender?.full_name || 'Produtor'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {offer.freight?.cargo_type} - {offer.freight?.origin_address} → {offer.freight?.destination_address}
                            </p>
                          </div>
                          <Badge variant={offer.read_at ? 'default' : 'secondary'}>
                            {offer.read_at ? 'Processada' : 'Nova'}
                          </Badge>
                        </div>

                        <div className="bg-secondary/30 p-3 rounded-lg">
                          <p className="text-sm whitespace-pre-line">{offer.message}</p>
                        </div>

                        {!offer.read_at && (
                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleAcceptCounterOffer(offer.id, offer.freight_id)}
                              className="gradient-primary"
                            >
                              Aceitar R$ {offer.proposed_price?.toLocaleString('pt-BR')}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRejectCounterOffer(offer.id)}
                            >
                              Recusar
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </SafeListWrapper>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Você não tem contra-ofertas pendentes
              </p>
            )}
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4">
            <DriverVehiclesTab driverProfile={profile} />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <SafeListWrapper>
              <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pagamentos Pendentes</h3>
              <Badge variant="secondary" className="text-sm font-medium">
                {pendingPayments.length} pendente{pendingPayments.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {pendingPayments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Nenhum pagamento pendente
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Quando um produtor informar um pagamento, aparecerá aqui para confirmação
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando pagamentos...</div>}>
                  {pendingPayments && pendingPayments.length > 0 && pendingPayments.map((payment) => {
                    const isProposed = payment.status === 'proposed';
                    const isPaidByProducer = payment.status === 'paid_by_producer';
                    
                    return (
                    <Card 
                      key={payment.id} 
                      className={`border-l-4 ${
                        isPaidByProducer 
                          ? 'border-l-green-500 bg-green-50/50 dark:bg-green-900/10' 
                          : 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-lg">
                                {isPaidByProducer ? '💰 Pagamento Disponível' : '📋 Pagamento Proposto'}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Frete: {payment.freight?.cargo_type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payment.freight?.origin_city}/{payment.freight?.origin_state} → {payment.freight?.destination_city}/{payment.freight?.destination_state}
                              </p>
                            </div>
                            <Badge 
                              variant="secondary" 
                              className={
                                isPaidByProducer
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              }
                            >
                              {isPaidByProducer ? 'Produtor Pagou' : 'Aguardando Pagamento'}
                            </Badge>
                          </div>

                          <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg border">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm font-medium">
                                  {isPaidByProducer ? 'Valor pago pelo produtor:' : 'Valor proposto:'}
                                </p>
                                <p className={`text-2xl font-bold ${isPaidByProducer ? 'text-green-600' : 'text-yellow-600'}`}>
                                  R$ {payment.amount?.toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Produtor:</p>
                                <p className="text-sm font-medium">{payment.producer?.full_name}</p>
                              </div>
                            </div>
                          </div>

                          {/* Ações: só mostrar "Confirmar Recebimento" se produtor já pagou */}
                          {isPaidByProducer ? (
                            <div className="flex gap-2">
                              <Button 
                                className="gradient-primary flex-1"
                                onClick={() => handleConfirmPayment({
                                  id: payment.id,
                                  freight_id: payment.freight_id,
                                  producer_id: payment.producer_id
                                })}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirmar Recebimento
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => handleDisputePayment(payment.id)}
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Contestar
                              </Button>
                            </div>
                          ) : (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
                              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ⏳ O produtor ainda não confirmou o pagamento. Você será notificado quando o pagamento for efetuado.
                              </p>
                            </div>
                          )}

                          {payment.payment_method && (
                            <p className="text-xs text-muted-foreground">
                              Método: {payment.payment_method === 'PIX' ? '💳 PIX' : 
                                      payment.payment_method === 'TED' ? '🏦 TED' : 
                                      payment.payment_method === 'MONEY' ? '💵 Dinheiro' : payment.payment_method}
                              {payment.created_at && ` • ${new Date(payment.created_at).toLocaleDateString('pt-BR')}`}
                            </p>
                          )}

                          {payment.notes && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Observações:</p>
                              <p className="text-muted-foreground">{payment.notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </SafeListWrapper>
              </div>
            )}
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="advances" className="space-y-4">
            <DriverAdvancesTab driverId={profile?.id || ''} />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <DriverRatingsTab userProfileId={profile?.id || ''} />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <DriverChatTab userProfileId={profile?.id || ''} userRole={profile?.active_mode || profile?.role || 'MOTORISTA'} />
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <DriverHistoryTab />
          </TabsContent>

          <TabsContent value="affiliations" className="mt-6">
            <DriverAffiliationsTab />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <DriverReportsTab driverId={profile?.id || ''} />
          </TabsContent>

          <TabsContent value="fiscal" className="mt-6">
            <FiscalTab userRole="MOTORISTA" />
          </TabsContent>

        </Tabs>
      </div>
      
      {/* Modal de Check-in */}
      {selectedFreightForCheckin ? (
        <FreightCheckinModal
          key={selectedFreightForCheckin}
          isOpen={showCheckinModal}
          onClose={() => {
            setShowCheckinModal(false);
            setSelectedFreightForCheckin(null);
            setInitialCheckinType(null);
          }}
          freightId={selectedFreightForCheckin}
          currentUserProfile={profile}
          initialType={initialCheckinType || undefined}
          onCheckinCreated={() => {
            fetchOngoingFreights();
            fetchDriverCheckins();
            setShowCheckinModal(false);
            setSelectedFreightForCheckin(null);
            setInitialCheckinType(null);
          }}
        />
      ) : null}

      {/* Modal de Desistência */}
      <FreightWithdrawalModal
        key={selectedFreightForWithdrawal?.id || 'withdrawal-modal'}
        isOpen={showWithdrawalModal}
        onClose={() => {
          setShowWithdrawalModal(false);
          setSelectedFreightForWithdrawal(null);
        }}
        onConfirm={confirmFreightWithdrawal}
        freightInfo={selectedFreightForWithdrawal ? {
          cargo_type: selectedFreightForWithdrawal.cargo_type,
          origin_address: selectedFreightForWithdrawal.origin_address,
          destination_address: selectedFreightForWithdrawal.destination_address,
          price: selectedFreightForWithdrawal.price
        } : undefined}
      />

      {/* Modal de Configuração de Localização */}
      {showLocationManager ? (
        <div key="location-manager-overlay" className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Configurar Áreas de Atendimento</h2>
                <Button variant="ghost" onClick={() => setShowLocationManager(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <UnifiedLocationManager 
                userType="MOTORISTA" 
                onAreasUpdate={() => {
                  // Refresh matches when areas are updated
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {/* ✅ REMOVIDO: Dialog de service_request (motoristas não veem serviços) */}
      
      <ServicesModal
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />

      {/* ✅ FASE 1 - Modal de Consentimento de Tracking */}
      <TrackingConsentModal
        isOpen={showTrackingConsentModal}
        freightId={freightAwaitingConsent || ''}
        onConsent={async (consented) => {
          setShowTrackingConsentModal(false);
          if (consented && freightAwaitingConsent) {
            // Agora aceitar o frete
            await handleFreightAction(freightAwaitingConsent, 'accept');
          }
          setFreightAwaitingConsent(null);
        }}
      />

      {/* Modal de Avaliação Automática */}
      {activeFreightForRating && (
        <AutoRatingModal
          isOpen={true}
          onClose={() => setActiveFreightForRating(null)}
          freightId={activeFreightForRating.id}
          userToRate={
            activeFreightForRating.producer
              ? {
                  id: activeFreightForRating.producer.id,
                  full_name: activeFreightForRating.producer.full_name,
                  role: 'PRODUTOR' as const
                }
              : null
          }
          currentUserProfile={profile}
        />
      )}

      {/* Modal de Detalhes da Proposta */}
      <DriverProposalDetailsModal
        isOpen={proposalDetailsModal.open}
        onClose={() => setProposalDetailsModal({ open: false, proposal: null })}
        proposal={proposalDetailsModal.proposal}
        counterOffers={counterOffers}
        onCancelProposal={handleCancelProposal}
        onAcceptCounterOffer={async (counterOfferId) => {
          const counterOffer = counterOffers.find(co => co.id === counterOfferId);
          if (counterOffer) {
            await handleAcceptCounterOffer(counterOfferId, counterOffer.freight_id);
          }
        }}
        onRejectCounterOffer={handleRejectCounterOffer}
      />

      {/* Modal de Contra-Proposta do Motorista */}
      {driverCounterModal.open && driverCounterModal.proposal && (
        <ProposalCounterModal
          isOpen={driverCounterModal.open}
          onClose={() => setDriverCounterModal({ open: false, proposal: null, freight: null })}
          originalProposal={{
            id: driverCounterModal.proposal.id,
            freight_id: driverCounterModal.proposal.freight_id,
            proposed_price: driverCounterModal.proposal.proposed_price,
            proposal_pricing_type: driverCounterModal.proposal.proposal_pricing_type,
            proposal_unit_price: driverCounterModal.proposal.proposal_unit_price,
            message: driverCounterModal.proposal.message,
            driver_name: profile?.full_name || 'Motorista',
            driver_id: profile?.id || '',
          }}
          freightPrice={driverCounterModal.proposal.freight?.price || 0}
          freightDistance={driverCounterModal.proposal.freight?.distance_km || 0}
          freightWeight={driverCounterModal.proposal.freight?.weight || 0}
          requiredTrucks={driverCounterModal.proposal.freight?.required_trucks || 1}
          freightPricingType={driverCounterModal.proposal.freight?.pricing_type}
          freightPricePerKm={driverCounterModal.proposal.freight?.price_per_km}
          onSuccess={() => {
            fetchMyProposals();
            fetchCounterOffers();
            setDriverCounterModal({ open: false, proposal: null, freight: null });
          }}
        />
      )}
      </div>
    </PageDOMErrorBoundary>
  );
};

export default DriverDashboard;