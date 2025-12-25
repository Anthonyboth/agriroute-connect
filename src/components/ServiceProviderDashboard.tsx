import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Button } from '@/components/ui/button';
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
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useServiceRequestCounts } from '@/hooks/useServiceRequestCounts';
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
import { ServiceHistory } from '@/components/ServiceHistory';
import { ServiceProviderReportsDashboard } from '@/components/ServiceProviderReportsDashboard';
import { ProviderReportsTab } from '@/pages/provider/ProviderReportsTab';
import { PendingServiceRatingsPanel } from '@/components/PendingServiceRatingsPanel';
import { RatingsHistoryPanel } from '@/components/RatingsHistoryPanel';
import { ServicesModal } from '@/components/ServicesModal';
import { SystemAnnouncementsBoardInline } from '@/components/SystemAnnouncementsBoardInline';
import { normalizeServiceType } from '@/lib/pt-br-validator';

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
  const navigate = useNavigate();
  
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
  const { counts, refreshCounts } = useServiceRequestCounts(providerId);

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
          
          // Se for UPDATE e envolver o serviço selecionado no modal
          if (payload.eventType === 'UPDATE' && 
              selectedRequest?.id === payload.new.id &&
              showRequestModal) {
            
            // Verificar se foi aceito por outro prestador
            if (payload.new.provider_id !== null && 
                payload.new.provider_id !== getProviderProfileId()) {
              toast({
                title: "Serviço Não Disponível",
                description: "Este serviço foi aceito por outro prestador.",
                variant: "destructive",
              });
              setShowRequestModal(false);
              setSelectedRequest(null);
            }
          }
          
          // Recarregar apenas disponíveis
          fetchServiceRequests({ scope: 'available', silent: true });
          refreshCounts();
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
          fetchServiceRequests({ scope: 'available', silent: true });
          refreshCounts();
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
            fetchServiceRequests({ scope: 'available', silent: true });
            refreshCounts();
          }
          // Ignorar updates de radius_km - não afetam disponibilidade
        }
      )
      .subscribe();

    // Refresh automático a cada 30 segundos (apenas disponíveis)
    const interval = setInterval(() => {
      fetchServiceRequests({ scope: 'available', silent: true });
      refreshCounts();
      fetchTotalEarnings();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(userCitiesChannel);
      clearInterval(interval);
    };
  }, [user, profile]);

  // Monitorar disponibilidade do serviço em tempo real enquanto modal está aberto
  useEffect(() => {
    if (!showRequestModal || !selectedRequest?.id) return;

    const checkInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('service_requests')
          .select('provider_id, status')
          .eq('id', selectedRequest.id)
          .maybeSingle();

        if (error || !data) {
          console.error('Error checking service availability:', error);
          return;
        }

        // Se foi aceito por outro prestador, notificar e fechar modal
        if (data.provider_id !== null || data.status !== 'OPEN') {
          toast({
            title: "Serviço Não Disponível",
            description: "Este serviço foi aceito por outro prestador.",
            variant: "destructive",
          });
          
          setShowRequestModal(false);
          setSelectedRequest(null);
          fetchServiceRequests({ scope: 'all', silent: true });
          refreshCounts();
        }
      } catch (error) {
        console.error('Error checking service availability:', error);
      }
    }, 3000); // Verificar a cada 3 segundos

    return () => clearInterval(checkInterval);
  }, [showRequestModal, selectedRequest]);

  const fetchServiceRequests = async (options: { 
    scope?: 'all' | 'available'; 
    silent?: boolean 
  } = {}) => {
    const { scope = 'all', silent = true } = options;
    
    // Throttle: minimum 10s between non-manual fetches
    const now = Date.now();
    if (silent && (now - lastFetchRef.current) < 10000) {
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

      // 1. Execute spatial matching (não crítico se falhar)
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
        // 3. Fetch provider's accepted requests
        const { data, error: providerError } = await supabase
          .from('service_requests')
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
          // FILTRO: Verificar se o service_type está na lista do prestador
          if (providerServiceTypes.length > 0 && !providerServiceTypes.includes(r.service_type)) {
            console.warn(`Service type ${r.service_type} not in provider's service list:`, providerServiceTypes);
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
          // FILTRO: Verificar se o service_type está na lista do prestador
          if (providerServiceTypes.length > 0 && !providerServiceTypes.includes(r.service_type)) {
            console.warn(`Service type ${r.service_type} not in provider's service list:`, providerServiceTypes);
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

      fetchServiceRequests({ scope: 'all', silent: true });
      refreshCounts();
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

      // VERIFICAÇÃO EM TEMPO REAL: Buscar estado atual do serviço
      const { data: currentRequest, error: checkError } = await supabase
        .from('service_requests')
        .select('provider_id, status')
        .eq('id', requestId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking service availability:', checkError);
        toast({
          title: "Erro",
          description: "Erro ao verificar disponibilidade do serviço.",
          variant: "destructive",
        });
        return;
      }

      if (!currentRequest) {
        toast({
          title: "Serviço Indisponível",
          description: "Serviço não encontrado ou indisponível.",
          variant: "destructive",
        });
        setShowRequestModal(false);
        setSelectedRequest(null);
        fetchServiceRequests({ scope: 'all', silent: true });
        refreshCounts();
        return;
      }

      // Verificar se já foi aceito por outro prestador
      if (currentRequest.provider_id !== null || currentRequest.status !== 'OPEN') {
        toast({
          title: "Serviço Indisponível",
          description: "Este serviço já foi aceito por outro prestador.",
          variant: "destructive",
        });
        
        // Fechar modal e atualizar lista
        setShowRequestModal(false);
        fetchServiceRequests({ scope: 'all', silent: true });
        refreshCounts();
        return;
      }

      // Tentar aceitar usando a função RPC
      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: providerId,
        p_request_id: requestId,
      });

      if (error) {
        // Verificar se é erro de concorrência
        if (error.message.includes('indisponível') || error.message.includes('aceita')) {
          toast({
            title: "Serviço Indisponível",
            description: "Este serviço foi aceito por outro prestador no momento.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        
        setShowRequestModal(false);
        fetchServiceRequests({ scope: 'all', silent: true });
        refreshCounts();
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "Serviço Indisponível",
          description: "Este serviço já foi aceito por outro prestador.",
          variant: "destructive",
        });
        
        setShowRequestModal(false);
        fetchServiceRequests({ scope: 'all', silent: true });
        refreshCounts();
        return;
      }

      // Sucesso!
      toast({
        title: "Sucesso! 🎉",
        description: "Serviço aceito com sucesso! Confira na aba 'Ativas'.",
      });

      // Fechar modal e atualizar
      setShowRequestModal(false);
      fetchServiceRequests({ scope: 'all', silent: true });
      refreshCounts();
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

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const request = [...availableRequests, ...ownRequests].find(r => r.id === requestId);
      if (!request) throw new Error('Solicitação não encontrada');

      // Validar que o serviço tem informações de cliente
      if (!request.client_id && !request.contact_name) {
        throw new Error('Serviço sem informações de cliente. Não é possível concluir.');
      }

      const { error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          final_price: request.estimated_price
        })
        .eq('id', requestId);

      if (error) throw error;

      // Simular pagamento para o prestador
      await simulatePayment(requestId, request.estimated_price || 0);

      toast({
        title: "Sucesso",
        description: `Serviço concluído! Você receberá R$ ${(request.estimated_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });
      
      fetchServiceRequests({ scope: 'all', silent: true });
      refreshCounts();
      fetchTotalEarnings();
    } catch (error: any) {
      console.error('Error completing request:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível marcar como concluído",
        variant: "destructive"
      });
    }
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

      console.log('🚫 [ServiceProviderDashboard] Cancelling service:', {
        serviceId: requestId,
        providerId,
        timestamp: new Date().toISOString()
      });

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

      // Fechar dialog e atualizar listas
      setCancelDialogOpen(false);
      setServiceToCancel(null);
      fetchServiceRequests({ scope: 'all', silent: true });
      refreshCounts();

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

  const simulatePayment = async (requestId: string, amount: number) => {
    try {
      // Em um sistema real, aqui seria integrado com Stripe ou outro gateway de pagamento
      // Por enquanto, vamos apenas log da simulação
      console.log(`Pagamento simulado: R$ ${amount} para solicitação ${requestId}`);
      
      // TODO: Integrar com sistema de pagamentos real
      // await processPaymentToProvider(providerId, amount, requestId);
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
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
    if (activeTab === 'pending') return !request.provider_id && request.status === 'OPEN';
    if (activeTab === 'accepted') return request.provider_id && (request.status === 'ACCEPTED' || request.status === 'IN_PROGRESS');
    if (activeTab === 'completed') return request.provider_id && request.status === 'COMPLETED';
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
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Hero Section Moderno */}
      <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden animate-fade-in">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[2px]"
          style={{ backgroundImage: `url(/hero-truck-night-moon.webp)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-accent/85 to-warning/80 backdrop-blur-sm" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Olá, {profile?.full_name?.split(' ')[0] || 'Prestador'}
            </h1>
            <p className="text-base md:text-lg mb-6 opacity-95 font-medium">
              {SISTEMA_IA_LABEL} conecta você com clientes
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('cities')}
                className="bg-white/95 text-primary hover:bg-white hover:scale-105 font-semibold rounded-full px-6 py-2.5 shadow-lg transition-all duration-300 w-full sm:w-auto"
              >
                <MapPin className="mr-1 h-4 w-4" />
                Configurar Região
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('services')}
                className="bg-white/95 text-primary hover:bg-white hover:scale-105 font-semibold rounded-full px-6 py-2.5 shadow-lg transition-all duration-300 w-full sm:w-auto"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Configurar Serviços
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-white/95 text-primary hover:bg-white hover:scale-105 font-semibold rounded-full px-6 py-2.5 shadow-lg transition-all duration-300 w-full sm:w-auto"
              >
                <Package className="mr-1 h-4 w-4" />
                Solicitar Serviço
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Stats Cards Premium - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-primary"
            label="Disponíveis"
            value={counts.pending}
            onClick={() => setActiveTab('pending')}
            className="hover:shadow-lg hover:shadow-primary/30 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
          />

          <StatsCard
            size="sm"
            icon={<Play className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Ativas"
            value={counts.accepted}
            onClick={() => setActiveTab('accepted')}
            className="hover:shadow-lg hover:shadow-orange-200 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
          />

          <StatsCard
            size="sm"
            icon={<CheckCircle className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Concluídas"
            value={counts.completed}
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
                  notation: 'compact',
                  maximumFractionDigits: 0
                }).format(totalEarnings)
              : '****'
            }
            onClick={() => setActiveTab('earnings')}
            className="hover:shadow-lg hover:shadow-warning/30 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80"
            actionButton={
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEarnings();
                }}
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              >
                {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </Button>
            }
          />
        </div>

        {/* Tabs Premium */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm shadow-md border border-gray-200/50 dark:bg-gray-900/80 dark:border-gray-700/50 p-1.5 text-muted-foreground min-w-fit">
            <TabsTrigger 
                value="pending" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <Brain className="h-3 w-3 mr-1" />
                Disponível
              </TabsTrigger>
              <TabsTrigger 
                value="accepted" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
              >
                <Play className="h-3 w-3 mr-1" />
                Em Andamento
              </TabsTrigger>
              <TabsTrigger 
                value="completed" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
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
                value="reports" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
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
                  Auto-refresh a cada 30s
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
                    fetchServiceRequests({ scope: 'available', silent: true });
                    refreshCounts();
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

            {/* PROBLEMA 5: Mural de Avisos reposicionado - APÓS busca, ANTES dos cards */}
            <SystemAnnouncementsBoardInline />
            
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
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            <strong>Problema:</strong> {request.problem_description}
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
                {counts.pending === 0 ? (
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
                {ownRequests.filter(r => r.provider_id && (r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS')).length}
              </Badge>
            </div>
            
            {(() => {
              const acceptedFiltered = ownRequests.filter(r => r.provider_id && (r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS'));
              console.log('🔍 DEBUG Accepted Tab:', {
                totalOwn: ownRequests.length,
                filtered: acceptedFiltered.length,
                ownStatuses: ownRequests.map(r => ({ id: r.id, status: r.status, hasProvider: !!r.provider_id })),
                filteredStatuses: acceptedFiltered.map(r => ({ id: r.id, status: r.status }))
              });
              
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
                        <Badge variant="default" className="text-xs bg-orange-100 text-orange-800">
                          Em Andamento
                        </Badge>
                      </div>
                      
                       {/* Problema 8: Card organizado com todas as informações */}
                       <div className="space-y-3 mb-4">
                         {/* Descrição do problema */}
                         <div className="bg-muted/50 rounded-lg p-3">
                           <p className="text-sm text-muted-foreground">
                             <strong className="text-foreground">Problema:</strong> {request.problem_description}
                           </p>
                         </div>
                         
                         {/* Grid de informações organizadas */}
                         <div className="grid grid-cols-2 gap-3">
                           {/* Localização */}
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
                           
                           {/* Data/Hora */}
                           <div className="space-y-1">
                             <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data/Hora</p>
                             <p className="text-sm flex items-center gap-1">
                               <Calendar className="h-3.5 w-3.5 text-primary" />
                               {request.accepted_at 
                                 ? new Date(request.accepted_at).toLocaleDateString('pt-BR')
                                 : new Date(request.created_at).toLocaleDateString('pt-BR')}
                             </p>
                             <p className="text-xs text-muted-foreground pl-4">
                               {request.accepted_at 
                                 ? new Date(request.accepted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                 : new Date(request.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                             </p>
                           </div>
                         </div>
                         
                         {/* Valor e Status de Pagamento */}
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
                           <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                             <Clock className="h-3 w-3 mr-1" />
                             Aguardando
                           </Badge>
                         </div>
                         
                         {/* Contato do Cliente */}
                         {request.provider_id && (request.status === 'ACCEPTED' || request.status === 'IN_PROGRESS') && (
                           <ContactInfoCard
                             requesterName={request.profiles?.full_name || request.contact_name}
                             contactPhone={request.contact_phone}
                             requesterPhone={request.profiles?.phone}
                             showWhatsApp={true}
                           />
                         )}
                       </div>
                      
                       <div className="flex gap-2">
                         <Button 
                           size="sm" 
                           variant="outline"
                           className="flex-1"
                           onClick={() => {
                             setSelectedChatRequest(request);
                             setChatDialogOpen(true);
                           }}
                         >
                           <MessageSquare className="h-4 w-4 mr-2" />
                           {request.client_id ? 'Abrir Chat' : 'Chat Indisponível'}
                         </Button>
                         
                         <Button 
                           size="sm" 
                           variant="destructive"
                           className="flex-1"
                           onClick={() => {
                             setServiceToCancel(request);
                             setCancelDialogOpen(true);
                           }}
                         >
                           <X className="h-4 w-4 mr-2" />
                           Cancelar
                         </Button>
                         
                         <Button 
                           size="sm" 
                           className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                           onClick={() => handleCompleteRequest(request.id)}
                         >
                           Concluir Serviço
                         </Button>
                       </div>
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
                refreshCounts();
              }}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ServiceHistory />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <UnifiedChatHub 
              userProfileId={profile?.id || ''}
              userRole="PRESTADOR_SERVICOS"
            />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ProviderReportsTab />
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

                {/* Informações do Cliente (se disponível) */}
                {selectedRequest.contact_name && (
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
                  <div className="text-sm bg-muted p-3 rounded-lg space-y-1">
                    <p className="font-medium">{getDisplayLocation(selectedRequest)}</p>
                    {selectedRequest.location_address && 
                     selectedRequest.location_address !== getDisplayLocation(selectedRequest) && (
                      <p className="text-xs text-muted-foreground">
                        Local específico: {selectedRequest.location_address}
                      </p>
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