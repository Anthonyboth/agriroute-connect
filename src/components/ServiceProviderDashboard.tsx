import React, { useState, useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Button } from '@/components/ui/button';
import { HeroActionButton } from '@/components/ui/hero-action-button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { 
  MapPin, 
  Clock, 
  Phone, 
  User, 
  CheckCircle, 
  XCircle,
  MessageSquare,
  Star,
  AlertCircle,
  Calendar,
  Filter,
  Settings,
  Sparkles,
  Wrench,
  Truck,
  Circle,
  Zap,
  Key,
  Droplets,
  TrendingUp,
  Brain,
  Play,
  DollarSign,
  Package,
  Eye,
  EyeOff,
  X,
  Banknote,
  Shield,
  Users,
  Navigation,
  ClipboardList
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProviderCardCounts } from '@/hooks/useDashboardCardCounts';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { ContactInfoCard } from '@/components/ContactInfoCard';
import ServiceProviderAreasManager from '@/components/ServiceProviderAreasManager';
import { ServiceProviderPayouts } from '@/components/ServiceProviderPayouts';
import { ServiceChatDialog } from '@/components/ServiceChatDialog';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';

import { LocationManager } from '@/components/LocationManager';
import { RegionalFreightFilter } from '@/components/RegionalFreightFilter';
import { ServiceProviderServiceTypeManager } from '@/components/ServiceProviderServiceTypeManager';
import { UserCityManager } from '@/components/UserCityManager';
import { ProviderHistoryTab } from '@/pages/provider/ProviderHistoryTab';
// ServiceProviderReportsDashboard removido - usando ProviderReportsTab
import { ProviderReportsTab } from '@/pages/provider/ProviderReportsTab';
import { PendingServiceRatingsPanel } from '@/components/PendingServiceRatingsPanel';
import { RatingsHistoryPanel } from '@/components/RatingsHistoryPanel';
import { ServicesModal } from '@/components/ServicesModal';
import { SystemAnnouncementsBoard } from '@/components/SystemAnnouncementsBoard';
import { normalizeServiceType } from '@/lib/pt-br-validator';
import { canProviderHandleService } from '@/lib/service-types';
import { FiscalTab } from '@/components/fiscal/tabs/FiscalTab';
import { FileText } from 'lucide-react';
import { useHeroBackground } from '@/hooks/useHeroBackground';
import { MyRequestsTab } from '@/components/MyRequestsTab';
import { ServiceWorkflowActions } from '@/components/service-provider/ServiceWorkflowActions';
import { ServiceStatusBadge } from '@/components/service-provider/ServiceStatusBadge';
import { maskServiceRequestPii, isPiiVisibleForStatus } from '@/security/serviceRequestPiiGuard';

interface ServiceRequest {
  id: string;
  client_id: string | null;
  provider_id: string | null;
  service_type: string;
  location_address: string;
  location_address_safe?: string;
  city_name?: string;
  state?: string;
  location_lat?: number;
  location_lng?: number;
  problem_description: string;
  vehicle_info?: string;
  urgency: string;
  contact_phone: string;
  contact_phone_safe?: string;
  contact_name?: string;
  preferred_datetime?: string;
  additional_info?: string;
  is_emergency: boolean;
  estimated_price?: number;
  final_price?: number;
  status: string;
  created_at: string;
  updated_at?: string;
  accepted_at?: string;
  completed_at?: string;
  request_source?: string;
  profiles?: {
    id: string;
    full_name: string;
    profile_photo_url?: string;
    phone?: string;
    user_id?: string;
  } | null;
}

import { SISTEMA_IA_LABEL } from '@/lib/ui-labels';

interface ServiceProviderStats {
  total_requests: number;
  pending_requests: number;
  accepted_requests: number;
  completed_requests: number;
  average_rating: number;
  total_earnings: number;
}

// Helper para sempre mostrar a cidade, não o endereço específico
const getDisplayLocation = (request: ServiceRequest): string => {
  // Prioridade 1: city_name + state
  if (request.city_name && request.state) {
    return `${request.city_name}, ${request.state}`;
  }
  
  // Prioridade 2: city_name sozinho
  if (request.city_name) {
    return request.city_name;
  }
  
  // Prioridade 3: Tentar extrair cidade do location_address se tiver formato "Cidade, UF"
  if (request.location_address?.includes(',')) {
    const match = request.location_address.match(/([^,]+),\s*([A-Z]{2})/);
    if (match) {
      return `${match[1].trim()}, ${match[2]}`;
    }
  }
  
  // Fallback: mostrar location_address mesmo
  return request.location_address || 'Localização não especificada';
};

export const ServiceProviderDashboard: React.FC = () => {
  const { toast } = useToast();
  const { user, profile, profiles } = useAuth();
  const { desktopUrl: heroDesktop } = useHeroBackground();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Separate states for available and own requests
  const [availableRequests, setAvailableRequests] = useState<ServiceRequest[]>([]);
  const [ownRequests, setOwnRequests] = useState<ServiceRequest[]>([]);
  
  // Loading states - separate for initial load and refresh
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('pending');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { visible: showEarnings, toggle: toggleEarnings } = useEarningsVisibility(false);
  const [lastAvailableRefresh, setLastAvailableRefresh] = useState<Date>(new Date());
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  
  // Chat dialog state
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [selectedChatRequest, setSelectedChatRequest] = useState<ServiceRequest | null>(null);
  
  // Mural de avisos - padronizado
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

  // ✅ Consumir location.state vindo de notificações (abrir aba/chat específico)
  useEffect(() => {
    const state = location.state as any;
    if (!state || !profile?.id) return;

    // Abrir chat de serviço específico
    if (state.openServiceChat) {
      const serviceId = state.openServiceChat;
      // Mudar para aba de aceitos e buscar o serviço
      setActiveTab('accepted');
      // Aguardar os dados carregarem e abrir chat
      const timer = setTimeout(() => {
        const found = ownRequests.find(r => r.id === serviceId);
        if (found) {
          setSelectedChatRequest(found);
          setChatDialogOpen(true);
        }
      }, 500);
      navigate(location.pathname, { replace: true, state: null });
      return () => clearTimeout(timer);
    }

    // Abrir serviço específico
    if (state.openServiceRequest) {
      const serviceId = state.openServiceRequest;
      if (state.openTab) setActiveTab(state.openTab);
      const timer = setTimeout(() => {
        const found = ownRequests.find(r => r.id === serviceId);
        if (found) {
          setSelectedRequest(found);
          setShowRequestModal(true);
        }
      }, 500);
      navigate(location.pathname, { replace: true, state: null });
      return () => clearTimeout(timer);
    }

    // Abrir aba específica
    if (state.openTab) {
      setActiveTab(state.openTab);
      navigate(location.pathname, { replace: true, state: null });
    }

    // Abrir histórico de pagamentos
    if (state.openPaymentHistory) {
      setActiveTab('payouts');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, profile?.id, ownRequests, navigate, location.pathname]);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [serviceToCancel, setServiceToCancel] = useState<ServiceRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Throttle control
  const lastFetchRef = React.useRef<number>(0);
  const inFlightRef = React.useRef<boolean>(false);

  const getProviderProfileId = () => {
    if (profile?.role === 'PRESTADOR_SERVICOS') return profile.id;
    const alt = (profiles || []).find((p: any) => p.role === 'PRESTADOR_SERVICOS');
    return alt?.id as string | undefined;
  };
  
  const providerId = getProviderProfileId();
  
  // ✅ Contagens derivadas dos mesmos arrays que as abas usam (sem drift)
  const cardCounts = useProviderCardCounts({
    availableRequests: availableRequests,
    ownRequests: ownRequests,
  });

  // Contador de mensagens não lidas
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'PRESTADOR_SERVICOS'
  );

  useEffect(() => {
    if (!profile?.id || profile.role !== 'PRESTADOR_SERVICOS') return;

    // Buscar dados iniciais (scope: all)
    fetchServiceRequests({ scope: 'all', silent: true });
    fetchTotalEarnings();

    // Configurar realtime para service_requests
    const channel = supabase
      .channel('service-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'service_requests'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          const currentProviderId = getProviderProfileId();
          
          // Se for UPDATE e envolver o serviço selecionado no modal
          if (payload.eventType === 'UPDATE' && 
              selectedRequest?.id === payload.new.id &&
              showRequestModal) {
            
            // Verificar se foi aceito por outro prestador
            if (payload.new.provider_id !== null && 
                payload.new.provider_id !== currentProviderId) {
              toast({
                title: "Serviço Não Disponível",
                description: "Este serviço foi aceito por outro prestador.",
                variant: "destructive",
              });
              setShowRequestModal(false);
              setSelectedRequest(null);
            }
          }
          
          // ✅ FIX: Se o update envolve serviço do próprio prestador (status mudou, etc.)
          // precisamos recarregar TUDO (scope: 'all') para atualizar ownRequests
          const isOwnService = payload.new && 
            (payload.new as any).provider_id === currentProviderId;
          
          if (isOwnService) {
            // Serviço do próprio prestador mudou (ex: COMPLETED) → refetch completo sem spatial
            fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
          } else {
            // Serviço de outro → apenas disponíveis sem spatial
            fetchServiceRequests({ scope: 'available', silent: true, skipSpatialMatching: true });
          }
        }
      )
      .subscribe();

    // Reagir a updates no perfil do prestador (cidade/estado/serviços)
    const providerProfileId = getProviderProfileId();
    const profilesChannel = supabase
      .channel('profiles-provider-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: providerProfileId ? `id=eq.${providerProfileId}` : undefined as any
        },
        (payload) => {
          console.log('Profile update detected for provider, refetching...', payload?.new?.id);
          fetchServiceRequests({ scope: 'available', silent: true, skipSpatialMatching: true });
        }
      )
      .subscribe();

    // Subscription para user_cities do prestador
    const userCitiesChannel = supabase
      .channel('provider-user-cities-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'user_cities',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('user_cities mudou para prestador:', payload);
          
          // Filtrar apenas mudanças que afetam matching
          const relevantChanges = ['INSERT', 'DELETE'];
          const isActiveToggle = payload.eventType === 'UPDATE' && 
            payload.old?.is_active !== payload.new?.is_active;
          
          if (relevantChanges.includes(payload.eventType) || isActiveToggle) {
            fetchServiceRequests({ scope: 'available', silent: true, skipSpatialMatching: true });
          }
          // Ignorar updates de radius_km - não afetam disponibilidade
        }
      )
      .subscribe();

    // ✅ ATUALIZAÇÃO CONTROLADA: refresh a cada 10 MINUTOS (não 30 segundos)
    // Isso evita spam de requests e melhora performance
    const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutos
    const interval = setInterval(() => {
      console.log('[ServiceProviderDashboard] Auto-refresh (10min)');
      fetchServiceRequests({ scope: 'available', silent: true, skipSpatialMatching: true });
      fetchTotalEarnings();
    }, AUTO_REFRESH_MS);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(userCitiesChannel);
      clearInterval(interval);
    };
  }, [user, profile]);

  // Monitorar disponibilidade do serviço em tempo real enquanto modal está aberto
  // Polling com backoff: 3s → 5s → 10s (máximo)
  useEffect(() => {
    if (!showRequestModal || !selectedRequest?.id) return;

    let pollCount = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const getNextInterval = () => {
      if (pollCount < 3) return 3000;  // primeiras 3 vezes: 3s
      if (pollCount < 8) return 5000;  // próximas 5: 5s
      return 10000;                     // depois: 10s
    };

    const checkAvailability = async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('provider_id, status')
          .eq('id', selectedRequest.id)
          .maybeSingle();

        if (error || !data) return;

        // Se foi aceito por outro prestador, parar polling e fechar
        if (data.provider_id !== null || data.status !== 'OPEN') {
          toast({
            title: "Serviço Não Disponível",
            description: "Este serviço foi aceito por outro prestador.",
            variant: "destructive",
          });
          setShowRequestModal(false);
          setSelectedRequest(null);
          fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
          return; // não re-agendar
        }

        // Re-agendar com backoff
        pollCount++;
        timeoutId = setTimeout(checkAvailability, getNextInterval());
      } catch (error) {
        console.error('Error checking service availability:', error);
        pollCount++;
        timeoutId = setTimeout(checkAvailability, getNextInterval());
      }
    };

    // Iniciar polling
    timeoutId = setTimeout(checkAvailability, 3000);

    return () => clearTimeout(timeoutId);
  }, [showRequestModal, selectedRequest]);

  const fetchServiceRequests = async (options: { 
    scope?: 'all' | 'available'; 
    silent?: boolean;
    /** ✅ PERF: Pular spatial matching em refetches de status change */
    skipSpatialMatching?: boolean;
  } = {}) => {
    const { scope = 'all', silent = true, skipSpatialMatching = false } = options;
    
    // ✅ PERF: Throttle reduzido para 3s (era 10s)
    const now = Date.now();
    if (silent && (now - lastFetchRef.current) < 3000) {
      console.log('Throttled fetch request');
      return;
    }
    
    // Prevent concurrent fetches
    if (inFlightRef.current) {
      console.log('Fetch already in progress');
      return;
    }
    
    const providerId = getProviderProfileId();
    if (!providerId) {
      console.warn('Provider ID not found');
      setInitialLoading(false);
      return;
    }

    try {
      inFlightRef.current = true;
      
      // Show appropriate loading state
      if (scope === 'all') {
        setInitialLoading(true);
      }
      
      lastFetchRef.current = now;
      
      console.log('🔍 [ServiceProviderDashboard] Fetching requests...', {
        providerId,
        timestamp: new Date().toISOString()
      });

      // 1. Execute spatial matching APENAS no carregamento inicial (não em status changes)
      if (!skipSpatialMatching) {
        console.log('🔍 Executing spatial matching for provider...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const { data: spatialData, error: spatialError } = await supabase.functions.invoke(
            'provider-spatial-matching',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
              }
            }
          );

          if (spatialError) {
            console.warn('Spatial matching warning:', spatialError);
          } else {
            console.log('Spatial matching completed:', spatialData);
          }
        } catch (spatialError) {
          console.warn('Spatial matching failed (non-critical):', spatialError);
        }
      } else {
        console.log('⚡ Skipping spatial matching (status change refetch)');
      }

      // 2. Fetch based on scope
      let cityBasedRequests: any[] = [];
      let providerRequests: any[] = [];
      
      if (scope === 'all' || scope === 'available') {
        console.log('🔍 Fetching service requests for provider (APENAS serviços)...', {
          providerId,
          providerServiceTypes: profile?.service_types,
          profileRole: profile?.role,
          timestamp: new Date().toISOString()
        });
        try {
          // Usar RPC exclusiva que retorna APENAS serviços (nunca fretes)
          const { data, error: cityError } = await supabase.rpc(
            'get_services_for_provider',
            { p_provider_id: providerId }
          );

          if (cityError) {
            console.warn('Error fetching services:', cityError);
          } else {
            cityBasedRequests = data || [];
            console.log('Services found (já filtrado pela RPC):', {
              total: cityBasedRequests.length,
              serviceTypes: [...new Set(cityBasedRequests.map((r: any) => r.service_type))]
            });
          }
        } catch (cityError) {
          console.warn('Service requests query failed:', cityError);
        }
      }

      if (scope === 'all') {
        // 3. Fetch provider's accepted requests (usando view segura para PII)
        const { data, error: providerError } = await supabase
          .from('service_requests_secure')
          .select('*')
          .eq('provider_id', providerId)
          .order('created_at', { ascending: false });

        if (providerError) {
          console.error('Error fetching provider requests:', providerError);
          throw providerError;
        }
        
        providerRequests = data || [];
      }

      // 4. Buscar perfis dos clientes separadamente
      const clientIds = [...new Set([
        ...(providerRequests || []).map(r => r.client_id),
        ...(cityBasedRequests || []).map(r => r.client_id)
      ].filter(Boolean))];

      const clientsMap = new Map();
      if (clientIds.length > 0) {
        const { data: clients, error: clientsError } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', clientIds);

        if (!clientsError && clients) {
          clients.forEach(client => {
            clientsMap.set(client.id, client);
          });
        }
      }

      // 5. Process and update appropriate state
      if (scope === 'all') {
        // Full update: separate available and own requests
        const available: ServiceRequest[] = [];
        const own: ServiceRequest[] = [];
        
        // Process city-based (available) - RPC já filtra apenas serviços
        const providerServiceTypes = profile?.service_types || [];
        
        (cityBasedRequests || []).forEach((r: any) => {
          // Matching estrito: só mostra requests exatamente dos tipos que o prestador oferece
          if (!canProviderHandleService(providerServiceTypes, r.service_type)) {
            console.warn(`Service type ${r.service_type} não compatível com tipos do prestador:`, providerServiceTypes);
            return;
          }
          
          const client = clientsMap.get(r.client_id);
          available.push({
            id: r.id || r.request_id,
            service_type: r.service_type,
            location_address: r.location_address,
            city_name: r.city_name,
            state: r.state,
            problem_description: r.problem_description,
            urgency: r.urgency,
            contact_phone: r.contact_phone,
            contact_name: r.contact_name,
            status: r.status,
            created_at: r.created_at,
            location_lat: r.location_lat,
            location_lng: r.location_lng,
            vehicle_info: r.vehicle_info,
            additional_info: r.additional_info,
            is_emergency: r.is_emergency,
            estimated_price: r.estimated_price,
            provider_id: null,
            client_id: r.client_id,
            profiles: client ? {
              id: client.id,
              full_name: client.full_name,
              phone: client.phone
            } : null
          } as ServiceRequest);
        });
        
        // Process own requests
        (providerRequests || []).forEach((r: any) => {
          const client = clientsMap.get(r.client_id);
          own.push({
            ...r,
            profiles: client ? {
              id: client.id,
              full_name: client.full_name,
              phone: client.phone
            } : null
          } as ServiceRequest);
        });
        
        setAvailableRequests(available);
        setOwnRequests(own);
        setInitialLoading(false);
        
        console.log('🔍 DEBUG ownRequests:', {
          total: own.length,
          ids: own.map(r => r.id),
          statuses: own.map(r => r.status),
          hasProvider: own.map(r => !!r.provider_id)
        });
        
        console.log(`Full update completed`, {
          available: available.length,
          own: own.length,
          filteredOutFreight: cityBasedRequests.length - available.length
        });
      } else {
        // Update only available requests - RPC já filtra apenas serviços
        const available: ServiceRequest[] = [];
        const providerServiceTypes = profile?.service_types || [];
        
        (cityBasedRequests || []).forEach((r: any) => {
          // Matching estrito: só mostra requests exatamente dos tipos que o prestador oferece
          if (!canProviderHandleService(providerServiceTypes, r.service_type)) {
            console.warn(`Service type ${r.service_type} não compatível com tipos do prestador:`, providerServiceTypes);
            return;
          }
          
          const client = clientsMap.get(r.client_id);
          available.push({
            id: r.id || r.request_id,
            service_type: r.service_type,
            location_address: r.location_address,
            city_name: r.city_name,
            state: r.state,
            problem_description: r.problem_description,
            urgency: r.urgency,
            contact_phone: r.contact_phone,
            contact_name: r.contact_name,
            status: r.status,
            created_at: r.created_at,
            location_lat: r.location_lat,
            location_lng: r.location_lng,
            vehicle_info: r.vehicle_info,
            additional_info: r.additional_info,
            is_emergency: r.is_emergency,
            estimated_price: r.estimated_price,
            provider_id: null,
            client_id: r.client_id,
            profiles: client ? {
              id: client.id,
              full_name: client.full_name,
              phone: client.phone
            } : null
          } as ServiceRequest);
        });
        
        setAvailableRequests(available);
        setLastAvailableRefresh(new Date());
        
        console.log(`Available requests updated: ${available.length}`);
      }
      
    } catch (error: any) {
      console.error('Error fetching service requests:', error);
      setInitialLoading(false);
      toast({
        title: "Erro ao carregar solicitações",
        description: "Não foi possível carregar as solicitações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  const fetchTotalEarnings = async () => {
    const providerId = getProviderProfileId();
    if (!providerId) return;

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('final_price')
        .eq('provider_id', providerId)
        .eq('status', 'COMPLETED');

      if (error) throw error;

      const total = (data || [])
        .filter(r => r.final_price)
        .reduce((sum, r) => sum + (r.final_price || 0), 0);

      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const providerId = getProviderProfileId();
      if (!providerId) {
        toast({
          title: "Erro",
          description: "Perfil de prestador não encontrado.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: providerId,
        p_request_id: requestId,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Solicitação indisponível ou já aceita.');
      }

      toast({
        title: "Sucesso",
        description: "Solicitação aceita com sucesso!",
      });

      fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
      fetchTotalEarnings();
    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível aceitar a solicitação",
        variant: "destructive",
      });
    }
  };

  const handleAcceptFromModal = async (requestId: string) => {
    if (!requestId) {
      toast({
        title: "Erro",
        description: "ID do serviço ausente.",
        variant: "destructive",
      });
      setShowRequestModal(false);
      setSelectedRequest(null);
      return;
    }
    
    setIsAccepting(true);
    
    try {
      const providerId = getProviderProfileId();
      if (!providerId) {
        toast({
          title: "Erro",
          description: "Perfil de prestador não encontrado.",
          variant: "destructive",
        });
        return;
      }

      // A RPC accept_service_request garante atomicidade e concorrência
      // Não fazemos verificação prévia SELECT para evitar bloqueio por RLS
      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: providerId,
        p_request_id: requestId,
      });

      if (error) {
        console.error('Error accepting request:', error);
        // Verificar se é erro de concorrência ou autenticação
        if (error.message.includes('indisponível') || error.message.includes('aceita') || error.message.includes('not authenticated')) {
          toast({
            title: "Serviço Indisponível",
            description: "Este serviço foi aceito por outro prestador ou você não está autenticado.",
            variant: "destructive",
          });
        } else if (error.message.includes('provider not registered')) {
          toast({
            title: "Erro de Cadastro",
            description: "Seu perfil de prestador não está registrado corretamente.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro",
            description: error.message || "Erro ao aceitar serviço.",
            variant: "destructive",
          });
        }
        
        setShowRequestModal(false);
        fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
        return;
      }

      // Se RPC retornou 0 linhas, serviço já foi aceito por outro
      if (!data || data.length === 0) {
        toast({
          title: "Serviço Indisponível",
          description: "Este serviço já foi aceito por outro prestador.",
          variant: "destructive",
        });
        
        setShowRequestModal(false);
        fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
        return;
      }

      // Sucesso!
      toast({
        title: "Sucesso! 🎉",
        description: "Serviço aceito com sucesso! Confira na aba 'Ativas'.",
      });

      // Fechar modal e atualizar
      setShowRequestModal(false);
      fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
      fetchTotalEarnings();
      
      // Mudar para a aba de serviços ativos
      setActiveTab('accepted');

    } catch (error: any) {
      console.error('Error accepting request:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível aceitar a solicitação",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  // handleCompleteRequest REMOVIDO — toda transição de status agora passa pela RPC
  // transition_service_request_status, chamada pelo componente ServiceWorkflowActions.

  const handleStatusChange = (requestId: string, newStatus: string) => {
    // ✅ PERF: Update otimista IMEDIATO — atualiza UI antes do refetch
    setOwnRequests(prev => {
      // Se COMPLETED, remover da aba "em andamento" imediatamente
      if (newStatus === 'COMPLETED') {
        const updated = prev.map(r => 
          r.id === requestId ? { ...r, status: newStatus, completed_at: new Date().toISOString() } : r
        );
        return updated;
      }
      // Para outras transições (ON_THE_WAY, IN_PROGRESS), atualizar status in-place
      return prev.map(r => 
        r.id === requestId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r
      );
    });

    // Background refetch para consistência (sem spatial matching = rápido)
    setTimeout(() => {
      fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
      fetchTotalEarnings();
    }, 500);
  };

  const handleCancelService = async (requestId: string) => {
    setIsCancelling(true);
    try {
      const providerId = getProviderProfileId();
      if (!providerId) {
        toast({
          title: "Erro",
          description: "Perfil de prestador não encontrado.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc('cancel_accepted_service', {
        p_provider_id: providerId,
        p_request_id: requestId,
        p_cancellation_reason: 'PROVIDER_CANCELLATION'
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Não foi possível cancelar o serviço.');
      }

      toast({
        title: "Serviço Cancelado",
        description: "O serviço voltou a ficar disponível para outros prestadores.",
      });

      setCancelDialogOpen(false);
      setServiceToCancel(null);
      fetchServiceRequests({ scope: 'all', silent: true, skipSpatialMatching: true });
    } catch (error: any) {
      console.error('Error canceling service:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível cancelar o serviço",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const serviceTypes = [
    { value: 'all', label: 'Todos os Serviços' },
    { value: 'MECANICO', label: 'Mecânico' },
    { value: 'ELETRICISTA_AUTOMOTIVO', label: 'Eletricista' },
    { value: 'BORRACHEIRO', label: 'Borracheiro' },
    { value: 'CHAVEIRO', label: 'Chaveiro' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'AR_CONDICIONADO', label: 'Ar Condicionado' },
    { value: 'FREIOS', label: 'Freios' },
    { value: 'SUSPENSAO', label: 'Suspensão' },
    { value: 'SOLDADOR', label: 'Soldador' },
    { value: 'PINTURA', label: 'Pintura' },
    { value: 'VIDRACEIRO', label: 'Vidraceiro' },
    { value: 'ASSISTENCIA_TECNICA', label: 'Assistência Técnica' },
    { value: 'MANUTENCAO_EQUIPAMENTOS', label: 'Manutenção de Equipamentos' },
    { value: 'CONSULTORIA_RURAL', label: 'Consultoria Rural' },
    { value: 'SERVICOS_VETERINARIOS', label: 'Serviços Veterinários' },
    { value: 'ANALISE_SOLO', label: 'Análise de Solo' },
    { value: 'PULVERIZACAO', label: 'Pulverização' },
    { value: 'PULVERIZACAO_DRONE', label: 'Pulverização por Drone' },
    { value: 'COLHEITA_PLANTIO', label: 'Colheita e Plantio' },
    { value: 'ADUBACAO_CALCARIO', label: 'Adubação e Calagem' },
    { value: 'OPERADOR_MAQUINAS', label: 'Operador de Máquinas' },
    { value: 'SECAGEM_GRAOS', label: 'Secador / Secagem de Grãos' },
    { value: 'GUINDASTE', label: 'Guindaste' },
    { value: 'ARMAZENAGEM', label: 'Armazenagem' },
    { value: 'OUTROS', label: 'Outros' }
    // NOTA: Removidos CARGA, GUINCHO, MUDANCA pois estes são para motoristas
  ];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'default';
    }
  };

  // Combine requests based on active tab
  const allRequests = activeTab === 'pending' ? availableRequests : ownRequests;
  
  const filteredRequests = allRequests.filter(request => {
    // Filtro por tipo de serviço
    if (serviceTypeFilter !== 'all' && request.service_type !== serviceTypeFilter) {
      return false;
    }
    
    // Filtro por termo de pesquisa (buscar na descrição do problema e no tipo de serviço)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const problemDescription = (request.problem_description || '').toLowerCase();
      const serviceTypeName = normalizeServiceType(request.service_type).toLowerCase();
      
      if (!problemDescription.includes(searchLower) && !serviceTypeName.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  }).filter(request => {
    const status = (request.status || '').toUpperCase().trim();
    if (activeTab === 'pending') return !request.provider_id && (status === 'OPEN' || status === 'ABERTO');
    if (activeTab === 'accepted') return request.provider_id && (status === 'ACCEPTED' || status === 'ON_THE_WAY' || status === 'IN_PROGRESS' || status === 'ACEITO' || status === 'A_CAMINHO' || status === 'EM_ANDAMENTO');
    if (activeTab === 'completed') return request.provider_id && (status === 'COMPLETED' || status === 'CONCLUIDO');
    return true;
  }).sort((a, b) => {
    // Para pendentes, ordenar pelas mais antigas primeiro
    if (activeTab === 'pending') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    // Para outras abas, manter ordem mais recente primeiro
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (initialLoading) {
    return <CenteredSpinner size="lg" className="min-h-[40vh]" />;
  }

  return (
    <div className="bg-background">
      {/* Hero Section - Padronizado com ProducerDashboard */}
      <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden animate-fade-in">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroDesktop})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/45 to-primary/70" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Olá, {profile?.full_name?.split(' ')[0] || 'Prestador'}
            </h1>
            <p className="text-base md:text-lg mb-6 opacity-95 font-medium">
              {SISTEMA_IA_LABEL} conecta você com clientes
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <HeroActionButton 
                onClick={() => setActiveTab('cities')}
                icon={<MapPin className="h-4 w-4" />}
              >
                Configurar Região
              </HeroActionButton>
              <HeroActionButton 
                onClick={() => setActiveTab('services')}
                icon={<Wrench className="h-4 w-4" />}
              >
                Configurar Serviços
              </HeroActionButton>
              <HeroActionButton 
                onClick={() => setServicesModalOpen(true)}
                icon={<Package className="h-4 w-4" />}
              >
                Solicitar Serviço
              </HeroActionButton>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Stats Cards Premium - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-primary"
            label="Disponíveis"
            value={cardCounts.available}
            onClick={() => setActiveTab('pending')}
            className="hover:shadow-lg hover:shadow-primary/30 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
          />

          <StatsCard
            size="sm"
            icon={<Play className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Ativas"
            value={cardCounts.active}
            onClick={() => setActiveTab('accepted')}
            className="hover:shadow-lg hover:shadow-orange-200 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
          />

          <StatsCard
            size="sm"
            icon={<CheckCircle className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Concluídas"
            value={cardCounts.completed}
            onClick={() => setActiveTab('completed')}
            className="hover:shadow-lg hover:shadow-green-200 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
          />

          <StatsCard
            size="sm"
            icon={<TrendingUp className="h-5 w-5" />}
            iconColor="text-blue-500"
            label="Saldo"
            value={showEarnings 
              ? new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(totalEarnings)
              : '****'
            }
            onClick={() => setActiveTab('payouts')}
            className="hover:shadow-lg hover:shadow-blue-200 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
            actionButton={
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEarnings();
                }}
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                aria-label={showEarnings ? 'Ocultar saldo' : 'Mostrar saldo'}
              >
                {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
            }
          />
        </div>

        {/* Mural de Avisos */}
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

        {/* Tabs Premium */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm shadow-md border border-gray-200/50 dark:bg-gray-900/80 dark:border-gray-700/50 p-1.5 text-muted-foreground min-w-fit">
            <TabsTrigger 
                value="pending" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                data-tutorial="sp-available"
              >
                <Brain className="h-3 w-3 mr-1" />
                Disponível
              </TabsTrigger>
              <TabsTrigger
                value="accepted" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                data-tutorial="tab-ongoing"
              >
                <Play className="h-3 w-3 mr-1" />
                Em Andamento
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                data-tutorial="tab-completed"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Concluídos
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <Settings className="h-3 w-3 mr-1" />
                Serviços
              </TabsTrigger>
              <TabsTrigger 
                value="payouts" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <Banknote className="h-3 w-3 mr-1" />
                Saldo
              </TabsTrigger>
              <TabsTrigger 
                value="ratings" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                data-tutorial="tab-ratings-sp"
              >
                <Star className="h-3 w-3 mr-1" />
                Avaliações
              </TabsTrigger>
              <TabsTrigger 
                value="cities" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <MapPin className="h-3 w-3 mr-1" />
                Cidades
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Histórico
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Chat
                {chatUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                    {chatUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="my-requests" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                data-tutorial="tab-my-requests-sp"
              >
                <ClipboardList className="h-3 w-3 mr-1" />
                Solicitações
              </TabsTrigger>
              <TabsTrigger 
                value="fiscal" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <FileText className="h-3 w-3 mr-1" />
                Fiscal
              </TabsTrigger>
              <TabsTrigger
                value="reports" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                data-tutorial="tab-reports"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Relatórios
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Solicitações Disponíveis</h3>
                <p className="text-xs text-muted-foreground">
                  Atualizado há {Math.floor((new Date().getTime() - lastAvailableRefresh.getTime()) / 60000)} min • 
                  Atualização em tempo real
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {filteredRequests.length}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    fetchServiceRequests({ scope: 'available', silent: true, skipSpatialMatching: true });
                  }}
                  className="text-xs h-7"
                  disabled={inFlightRef.current}
                >
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Barra de Pesquisa */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar serviços por descrição ou tipo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 pr-4 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchTerm && (
                <p className="text-xs text-muted-foreground mt-2">
                  {filteredRequests.length} {filteredRequests.length === 1 ? 'resultado encontrado' : 'resultados encontrados'} para "{searchTerm}"
                </p>
              )}
            </div>

            {filteredRequests.length > 0 ? (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <Button
                    key={request.id}
                    variant="ghost"
                    className="w-full p-0 h-auto text-left hover:bg-transparent group"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowRequestModal(true);
                    }}
                  >
                    <Card className="w-full transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-primary/50 text-left bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 border-2 border-l-[6px] border-l-green-500">
                      <CardContent className="p-4 group-hover:bg-gradient-to-br group-hover:from-white group-hover:to-primary/10 dark:group-hover:from-gray-900 dark:group-hover:to-primary/5 transition-all duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">
                            {normalizeServiceType(request.service_type)}
                          </h3>
                          <Badge variant={getUrgencyColor(request.urgency)} className="text-xs shadow-sm">
                            {request.urgency === 'URGENT' ? 'Urgente' : 
                             request.urgency === 'HIGH' ? 'Alto' :
                             request.urgency === 'MEDIUM' ? 'Médio' : 'Baixo'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <p className="text-sm text-muted-foreground whitespace-normal break-words">
                            <strong>Problema:</strong> {request.problem_description || 'Não especificado'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <MapPin className="inline h-3 w-3 mr-1" />
                            {getDisplayLocation(request)}
                          </p>
                           {request.estimated_price && (
                             <p className="text-sm font-semibold text-green-600">
                               <DollarSign className="inline h-3 w-3 mr-1" />
                               Valor: R$ {request.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                             </p>
                           )}
                           <p className="text-xs text-muted-foreground">
                             <Clock className="inline h-3 w-3 mr-1" />
                             {new Date(request.created_at).toLocaleTimeString('pt-BR')}
                           </p>
                        </div>
                        
                        <div className="mt-3 text-xs text-primary font-semibold flex items-center justify-center gap-1 group-hover:gap-2 transition-all">
                          Clique para ver detalhes 
                          <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Button>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center space-y-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-md border-2 border-dashed border-gray-200 dark:border-gray-700">
                {cardCounts.available === 0 ? (
                  <>
                    <Settings className="w-16 h-16 mx-auto text-muted-foreground animate-pulse" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Configure seu perfil</h3>
                      <p className="text-muted-foreground mb-4">
                        Para começar a receber solicitações, você precisa:
                      </p>
                      <ul className="text-left max-w-md mx-auto space-y-2 mb-6 text-sm">
                        <li className="flex items-start">
                          <span className="mr-2">✓</span>
                          <span>Configurar as regiões onde você atende</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">✓</span>
                          <span>Definir os tipos de serviço que oferece</span>
                        </li>
                      </ul>
                      <div className="flex gap-3 justify-center flex-wrap">
                        <Button onClick={() => setActiveTab('cities')}>
                          <MapPin className="w-4 h-4 mr-2" />
                          Configurar Regiões
                        </Button>
                        <Button onClick={() => setActiveTab('services')} variant="outline">
                          <Wrench className="w-4 h-4 mr-2" />
                          Configurar Serviços
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Nenhuma solicitação disponível no momento</p>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Serviços em Andamento</h3>
              <Badge variant="secondary" className="text-xs">
                {ownRequests.filter(r => r.provider_id && ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(r.status?.toUpperCase())).length}
              </Badge>
            </div>
            
            {(() => {
              const acceptedFiltered = ownRequests.filter(r => r.provider_id && ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(r.status?.toUpperCase()));
              
              return acceptedFiltered.length > 0 ? (
                <div className="space-y-4">
                  {acceptedFiltered.map((request) => (
                  <Card key={request.id} className="shadow-lg border-l-[6px] border-l-orange-500 hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-orange-50/30 dark:from-gray-900 dark:to-orange-950/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">
                            {normalizeServiceType(request.service_type)}
                          </h3>
                          {!request.client_id && (
                            <Badge variant="outline" className="text-xs">
                              <User className="h-3 w-3 mr-1" />
                              Sem cadastro
                            </Badge>
                          )}
                        </div>
                        <ServiceStatusBadge status={request.status} />
                      </div>
                      
                       <div className="space-y-3 mb-4">
                         <div className="bg-muted/50 rounded-lg p-3">
                           <p className="text-sm text-muted-foreground">
                             <strong className="text-foreground">Problema:</strong> {request.problem_description}
                           </p>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Localização</p>
                             <p className="text-sm flex items-start gap-1">
                               <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                               <span>{getDisplayLocation(request)}</span>
                             </p>
                             {request.location_address && request.location_address !== getDisplayLocation(request) && (
                               <p className="text-xs text-muted-foreground pl-4">
                                 {request.location_address}
                               </p>
                             )}
                           </div>
                           
                           <div className="space-y-1">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data/Hora</p>
                             <p className="text-sm flex items-center gap-1">
                               <Calendar className="h-3.5 w-3.5 text-primary" />
                               {request.accepted_at 
                                 ? new Date(request.accepted_at).toLocaleDateString('pt-BR')
                                 : new Date(request.created_at).toLocaleDateString('pt-BR')}
                             </p>
                           </div>
                         </div>
                         
                         <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200/50">
                           <div>
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor do Serviço</p>
                             <p className="text-lg font-bold text-green-600">
                               <DollarSign className="inline h-4 w-4" />
                               {request.estimated_price 
                                 ? request.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                 : 'A combinar'}
                             </p>
                           </div>
                         </div>
                         
                         {/* Contato do Cliente — visível após aceite */}
                         {request.provider_id && (
                           <ContactInfoCard
                             requesterName={request.profiles?.full_name || request.contact_name}
                             contactPhone={request.contact_phone}
                             requesterPhone={request.profiles?.phone}
                             showWhatsApp={true}
                           />
                         )}
                       </div>
                      
                       {/* Botões sequenciais de workflow — via RPC atômica */}
                       <ServiceWorkflowActions
                         requestId={request.id}
                         currentStatus={request.status}
                         clientId={request.client_id}
                         estimatedPrice={request.estimated_price}
                         onStatusChange={handleStatusChange}
                         onOpenChat={() => {
                           setSelectedChatRequest(request);
                           setChatDialogOpen(true);
                         }}
                         onCancel={() => {
                           setServiceToCancel(request);
                           setCancelDialogOpen(true);
                         }}
                       />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center space-y-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-md border-2 border-dashed border-gray-200 dark:border-gray-700">
                <Play className="h-16 w-16 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Nenhum serviço em andamento.</p>
              </Card>
            );
            })()}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Serviços Concluídos</h3>
              <Badge variant="secondary" className="text-xs">
                {ownRequests.filter(r => r.provider_id && r.status === 'COMPLETED').length}
              </Badge>
            </div>
            
            {ownRequests.filter(r => r.provider_id && r.status === 'COMPLETED').length > 0 ? (
              <div className="space-y-4">
                {ownRequests.filter(r => r.provider_id && r.status === 'COMPLETED').map((request) => (
                  <Card key={request.id} className="shadow-md border-l-[6px] border-l-green-500 hover:shadow-lg transition-all duration-300 bg-gradient-to-r from-white to-green-50/20 dark:from-gray-900 dark:to-green-950/10">
                     <CardContent className="p-4">
                       <div className="flex items-center justify-between mb-3">
                         <h3 className="font-medium text-sm">
                           {normalizeServiceType(request.service_type)}
                         </h3>
                         <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                           Concluído
                         </Badge>
                       </div>
                       
                       <div className="space-y-2 mb-3">
                         <p className="text-sm text-muted-foreground">
                           <strong>Cliente:</strong> {request.profiles?.full_name || request.contact_name || 'Cliente'}
                         </p>
                         <p className="text-sm text-muted-foreground">
                           <MapPin className="inline h-3 w-3 mr-1" />
                           {getDisplayLocation(request)}
                         </p>
                         {request.final_price && (
                           <p className="text-sm font-medium text-green-600">
                             <DollarSign className="inline h-3 w-3 mr-1" />
                             Pago: R$ {request.final_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                           </p>
                         )}
                         <p className="text-xs text-muted-foreground">
                           <Clock className="inline h-3 w-3 mr-1" />
                           Concluído em: {new Date(request.completed_at || request.updated_at).toLocaleDateString('pt-BR')}
                         </p>
                       </div>
                     </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center space-y-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-md border-2 border-dashed border-gray-200 dark:border-gray-700">
                <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Nenhum serviço concluído ainda.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <ServiceProviderServiceTypeManager />
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <ServiceProviderPayouts providerId={getProviderProfileId() || ''} />
          </TabsContent>

          <TabsContent value="ratings" className="space-y-6">
            {/* Avaliações Pendentes (para fazer) */}
            <PendingServiceRatingsPanel />
            
            {/* Histórico Completo de Avaliações Recebidas */}
            <RatingsHistoryPanel />
          </TabsContent>

          <TabsContent value="cities" className="space-y-4">
            <UserCityManager
              userRole="PRESTADOR_SERVICOS"
              onCitiesUpdate={() => {
                console.log('Provider cities updated via UserCityManager');
                // Recarregar solicitações quando cidades forem atualizadas
                fetchServiceRequests();
              }}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ProviderHistoryTab />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <UnifiedChatHub 
              userProfileId={profile?.id || ''}
              userRole="PRESTADOR_SERVICOS"
            />
          </TabsContent>

          <TabsContent value="my-requests" className="space-y-4">
            <MyRequestsTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ProviderReportsTab />
          </TabsContent>

          <TabsContent value="fiscal" className="space-y-4">
            <FiscalTab userRole="PRESTADOR_SERVICOS" />
          </TabsContent>

        </Tabs>

        {/* Modal de Detalhes da Solicitação */}
        <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-white to-primary/10 dark:from-gray-900 dark:to-primary/5 border-2">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-green-600" />
                Detalhes da Solicitação
              </DialogTitle>
              <DialogDescription>
                Informações completas sobre a solicitação de serviço
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-6">
                {/* Tipo de Serviço e Urgência */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {normalizeServiceType(selectedRequest.service_type)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Solicitado em {new Date(selectedRequest.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant={getUrgencyColor(selectedRequest.urgency)} className="text-sm">
                    {selectedRequest.urgency === 'URGENT' ? 'Urgente' : 
                     selectedRequest.urgency === 'HIGH' ? 'Alto' :
                     selectedRequest.urgency === 'MEDIUM' ? 'Médio' : 'Baixo'}
                  </Badge>
                </div>

                <div className="h-px bg-border" />

                {/* Informações do Cliente (se disponível e se PII é visível) */}
                {isPiiVisibleForStatus(selectedRequest.status) && selectedRequest.contact_name && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Cliente
                    </h4>
                    <p className="text-sm">{selectedRequest.contact_name}</p>
                  </div>
                )}

                {/* Descrição do Problema */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Descrição do Problema
                  </h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {selectedRequest.problem_description}
                  </p>
                </div>

                {/* Localização */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Localização
                  </h4>
                  <div className="text-sm bg-muted p-3 rounded-lg space-y-2">
                    <p className="font-medium">{getDisplayLocation(selectedRequest)}</p>
                    {/* Endereço completo: SOMENTE após aceite (PII guard) */}
                    {isPiiVisibleForStatus(selectedRequest.status) &&
                     selectedRequest.location_address && 
                     selectedRequest.location_address !== getDisplayLocation(selectedRequest) && (
                      <p className="text-xs text-muted-foreground">
                        Local específico: {selectedRequest.location_address}
                      </p>
                    )}
                    {/* Aviso PII para OPEN */}
                    {!isPiiVisibleForStatus(selectedRequest.status) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 italic flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Endereço completo visível após aceitar o serviço.
                      </p>
                    )}
                    {/* Botão Abrir no Mapa — só após aceite para ter coordenadas */}
                    {isPiiVisibleForStatus(selectedRequest.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 gap-2"
                        onClick={() => {
                          let url: string;
                          if (selectedRequest.location_lat && selectedRequest.location_lng) {
                            url = `https://www.google.com/maps/search/?api=1&query=${selectedRequest.location_lat},${selectedRequest.location_lng}`;
                          } else if (selectedRequest.location_address) {
                            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedRequest.location_address)}`;
                          } else {
                            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getDisplayLocation(selectedRequest))}`;
                          }
                          window.open(url, '_blank');
                        }}
                      >
                        <Navigation className="h-4 w-4" />
                        Abrir no Mapa
                      </Button>
                    )}
                  </div>
                </div>

                {/* Informações do Veículo (se houver) */}
                {selectedRequest.vehicle_info && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Informações do Veículo
                    </h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedRequest.vehicle_info}
                    </p>
                  </div>
                )}

                {/* Valor Estimado */}
                {selectedRequest.estimated_price && (
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Valor
                    </h4>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {selectedRequest.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {/* Informações Adicionais */}
                {selectedRequest.additional_info && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Informações Adicionais</h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedRequest.additional_info}
                    </p>
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* Botões de Ação */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
                    onClick={() => setShowRequestModal(false)}
                    disabled={isAccepting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                    onClick={() => handleAcceptFromModal(selectedRequest.id)}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Aceitando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aceitar Serviço
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Chat Dialog */}
        {chatDialogOpen && selectedChatRequest && (
          <ServiceChatDialog
            isOpen={chatDialogOpen}
            onClose={() => {
              setChatDialogOpen(false);
              setSelectedChatRequest(null);
            }}
            serviceRequest={selectedChatRequest}
            currentUserProfile={profile}
          />
        )}

        {/* Cancel Service AlertDialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Cancelar Serviço?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Tem certeza que deseja cancelar este serviço?
                </p>
                {serviceToCancel && (
                  <p className="font-medium">
                    {normalizeServiceType(serviceToCancel.service_type)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  ⚠️ O serviço voltará a ficar disponível para que outros prestadores possam aceitá-lo.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCancelling}>
                Não, manter serviço
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => serviceToCancel && handleCancelService(serviceToCancel.id)}
                disabled={isCancelling}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isCancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cancelando...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Sim, cancelar serviço
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Solicitar Serviços */}
        <ServicesModal
          isOpen={servicesModalOpen}
          onClose={() => setServicesModalOpen(false)}
        />
      </div>
    </div>
  );
};