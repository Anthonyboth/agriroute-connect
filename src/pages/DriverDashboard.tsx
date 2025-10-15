import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import { VehicleManager } from '@/components/VehicleManager';
import { FreightDetails } from '@/components/FreightDetails';
import { DriverAvailabilityCalendar } from '@/components/DriverAvailabilityCalendar';
import { UserCityManager } from '@/components/UserCityManager';
import { DriverAvailabilityAreasManager } from '@/components/DriverAvailabilityAreasManager';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SmartFreightMatcher } from '@/components/SmartFreightMatcher';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
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
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Brain, Settings, Play, DollarSign, Package, Calendar, Eye, EyeOff, X, Banknote, Star, MessageSquare, AlertTriangle, Users } from 'lucide-react';
import { useGPSMonitoring } from '@/hooks/useGPSMonitoring';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { TrackingConsentModal } from '@/components/TrackingConsentModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Wrench } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ServiceRegionSelector } from '@/components/ServiceRegionSelector';
import { DriverRegionManager } from '@/components/DriverRegionManager';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import heroLogistics from '@/assets/hero-logistics.jpg';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';
import UnifiedLocationManager from '@/components/UnifiedLocationManager';
import { ServicesModal } from '@/components/ServicesModal';
import { UnifiedHistory } from '@/components/UnifiedHistory';
import { CompanyDriverBadge } from '@/components/CompanyDriverBadge';

interface Freight {
  id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string; // Allow all database status values
  distance_km: number;
  minimum_antt_price: number;
  service_type?: string;
  // Flag para identificar serviços urbanos (GUINCHO/MUDANCA) convertidos
  is_service_request?: boolean;
  // Propriedades específicas de service_requests
  problem_description?: string;
  contact_phone?: string;
  contact_name?: string;
  additional_info?: string;
  producer?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    role: string;
  };
}

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  status: string; // Allow all database status values
  created_at: string;
  message?: string;
  freight?: Freight;
  producer?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

const DriverDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { isCompanyDriver, companyName, companyId, canAcceptFreights, canManageVehicles, isAffiliated } = useCompanyDriver();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to correct dashboard based on role and mode
  React.useEffect(() => {
    if (!profile?.id) return;

    // Check if user is in transport company mode
    const checkTransportMode = async () => {
      if (profile.active_mode === 'TRANSPORTADORA') {
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
    if (profile.role && profile.role !== 'MOTORISTA') {
      const correctRoute = profile.role === 'PRODUTOR' ? '/dashboard/producer' : 
                          profile.role === 'ADMIN' ? '/admin' : '/';
      navigate(correctRoute, { replace: true });
      return;
    }
  }, [profile?.id, profile?.role, profile?.active_mode, navigate]);
  
  // Check if user is a transport company
  React.useEffect(() => {
    const checkTransportCompany = async () => {
      if (!profile?.id) return;

      const { data } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      setIsTransportCompany(!!data || profile.active_mode === 'TRANSPORTADORA');
    };

    checkTransportCompany();
  }, [profile?.id, profile?.active_mode]);
  
  const [availableFreights, setAvailableFreights] = useState<Freight[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [counterOffers, setCounterOffers] = useState<any[]>([]);
  const [ongoingFreights, setOngoingFreights] = useState<Freight[]>([]);
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

  const [showLocationManager, setShowLocationManager] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [isTransportCompany, setIsTransportCompany] = useState(false);
  // Dialog para detalhes de serviços urbanos (GUINCHO/MUDANCA)
  const [showServiceRequestDialog, setShowServiceRequestDialog] = useState(false);
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<Freight | null>(null);
  // Estados para controle de consentimento de tracking
  const [freightAwaitingConsent, setFreightAwaitingConsent] = useState<string | null>(null);
  const [showTrackingConsentModal, setShowTrackingConsentModal] = useState(false);
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
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Abrir frete automaticamente quando vem de notificação
  useEffect(() => {
    const state = location.state as any;
    if (!state || !profile?.id) return;
    
    if (state.openFreightId && ongoingFreights.length > 0) {
      const freight = ongoingFreights.find(f => f.id === state.openFreightId);
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
    f.status === 'IN_TRANSIT' || f.status === 'ACCEPTED'
  );
  useGPSMonitoring(activeFreight?.id || null, !!activeFreight);

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
  
  // Função para encerrar chamado de serviço
  const handleCompleteServiceRequest = async (serviceId: string) => {
    if (!profile?.id) {
      toast.error("Erro: perfil não encontrado");
      return;
    }

    try {
      // Validar que o serviço pertence ao prestador e está no status correto
      const { data: updateData, error } = await supabase
        .from('service_requests')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', serviceId)
        .eq('provider_id', profile.id)
        .eq('status', 'ACCEPTED')
        .select();

      if (error) {
        console.error('Erro ao encerrar chamado:', error);
        toast.error("Não foi possível encerrar o chamado. Tente novamente.");
        return;
      }

      if (!updateData || updateData.length === 0) {
        toast.error("Este serviço já não está mais disponível ou não pertence a você");
        await fetchOngoingFreights();
        return;
      }

      toast.success("O chamado foi encerrado com sucesso.");

      // Fechar dialog e atualizar lista
      setShowServiceRequestDialog(false);
      setSelectedServiceRequest(null);
      await fetchOngoingFreights();
      
    } catch (error) {
      console.error('Erro ao encerrar chamado:', error);
      toast.error("Erro inesperado ao encerrar o chamado.");
    }
  };

  const [loading, setLoading] = useState(true);
  const [availableCountUI, setAvailableCountUI] = useState(0);

  // Buscar fretes disponíveis - com match inteligente por região
  const fetchAvailableFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      // Motoristas de empresa: buscar apenas fretes da transportadora
      if (isCompanyDriver && companyId) {
        const { data: companyFreights, error } = await supabase
          .from('freights')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'OPEN')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedFreights = (companyFreights || []).map((f: any) => ({
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
          service_type: f.service_type
        }));

        if (isMountedRef.current) setAvailableFreights(formattedFreights);
        return;
      }

      // Motoristas independentes: usar matching espacial
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
        console.warn('Erro no matching espacial:', spatialError);
      }

      // Usar a mesma RPC que o SmartFreightMatcher usa para consistência
      let query = supabase.rpc(
        'get_compatible_freights_for_driver',
        { p_driver_id: profile.id }
      );

      const { data: freights, error } = await query;

      if (error) {
        console.error('Erro ao carregar fretes:', error);
        // Fallback geral usando user_cities (IDs) se a RPC falhar por qualquer motivo
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const userId = userRes?.user?.id;
          if (!userId) throw new Error('Usuário não autenticado');

          const { data: uc } = await supabase
            .from('user_cities')
            .select('city_id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .in('type', ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO']);

          const cityIds = (uc || []).map((u: any) => u.city_id).filter(Boolean);
          if (cityIds.length === 0) {
            if (isMountedRef.current) setAvailableFreights([]);
            return;
          }

          const { data: freightsByCity } = await supabase
            .from('freights')
            .select('*')
            .eq('status', 'OPEN')
            .or(`origin_city_id.in.(${cityIds.join(',')}),destination_city_id.in.(${cityIds.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(200);

          const onlyWithSlots = (freightsByCity || []).filter((f: any) => 
            (f.accepted_trucks || 0) < (f.required_trucks || 1)
          );

          const formattedFreights = onlyWithSlots.map((f: any) => ({
            id: f.id,
            cargo_type: f.cargo_type,
            weight: f.weight,
            origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
            destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
            pickup_date: f.pickup_date,
            delivery_date: f.delivery_date,
            price: f.price,
            urgency: f.urgency,
            status: f.status,
            distance_km: f.distance_km,
            minimum_antt_price: f.minimum_antt_price,
            service_type: f.service_type
          }));

          if (isMountedRef.current) setAvailableFreights(formattedFreights);
          return;
        } catch (fbErr) {
          console.error('Fallback por cidades falhou:', fbErr);
          if (isMountedRef.current) toast.error('Erro ao carregar fretes. Tente novamente.');
          return;
        }
      }

      // Mapear os dados para o formato esperado
      const formattedFreights = (freights || []).map((f: any) => ({
        id: f.freight_id,
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
        service_type: f.service_type,
        producer: f.producer_name ? {
          id: f.producer_id,
          full_name: f.producer_name,
          contact_phone: f.producer_phone,
          role: 'PRODUTOR'
        } : undefined
      }));

      if (isMountedRef.current) setAvailableFreights(formattedFreights);
    } catch (error) {
      console.error('Error fetching available freights:', error);
      if (isMountedRef.current) toast.error('Erro ao carregar fretes disponíveis');
    }
  }, [profile?.id, profile?.role, isCompanyDriver, companyId]);

  // Buscar propostas do motorista - otimizado
  const fetchMyProposals = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      const { data, error } = await (supabase as any).functions.invoke('driver-proposals');
      if (error) {
        throw error;
      }

      const proposals = (data?.proposals as any[]) || [];
      const ongoing = (data?.ongoingFreights as any[]) || [];
      
      if (isMountedRef.current) setMyProposals(proposals);
      // Preservar serviços aceitos (service_requests) já no estado e mesclar com fretes em andamento da edge function
      if (isMountedRef.current) {
        setOngoingFreights((prev) => {
          const serviceRequests = (prev || []).filter((f: any) => (f as any).is_service_request);
          const merged = [...ongoing, ...serviceRequests].filter(
            (item, index, self) => self.findIndex((x: any) => x.id === item.id) === index
          );
          return merged;
        });
      }

      if (ongoing.length > 0) {
        ongoing.forEach(async (freight: any) => {
          try {
            const { count } = await (supabase as any)
              .from('freight_checkins')
              .select('*', { count: 'exact', head: true })
              .eq('freight_id', freight.id)
              .eq('user_id', profile.id);
            if (isMountedRef.current) setFreightCheckins(prev => ({ ...prev, [freight.id]: count || 0 }));
          } catch (err) {
            console.error('Error checking freight checkins for freight:', freight.id, err);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching proposals:', error);
      // Só mostrar toast se for motorista
      if (profile?.role === 'MOTORISTA' && isMountedRef.current) {
        toast.error('Erro ao carregar suas propostas');
      }
    }
  }, [profile?.id, profile?.role]);

  // Buscar assignments do motorista (fretes com valores individualizados)
  const fetchMyAssignments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      const { data, error } = await supabase.functions.invoke('get-driver-assignments');
      
      if (error) {
        console.error('Error fetching assignments:', error);
        return;
      }
      
      if (isMountedRef.current) setMyAssignments(data?.assignments || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  }, [profile?.id, profile?.role]);

  // Buscar fretes em andamento - baseado em propostas aceitas
  const fetchOngoingFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    console.log('🔍 Buscando fretes e serviços ativos do motorista:', profile.id);
    try {
      // Buscar fretes vinculados ao motorista diretamente
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('*, producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone, role)')
        .eq('driver_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (freightError) {
        console.error('❌ Erro buscando fretes diretos:', freightError);
        throw freightError;
      }

      // Buscar fretes via freight_assignments (transportadora scenarios)
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('freight_assignments')
        .select(`
          freight:freights(*, producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone, role)),
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

      // Extract and map assignment freights, using agreed_price as price
      const assignmentFreights = (assignmentData ?? []).map((a: any) => {
        const freight = a.freight;
        if (a.agreed_price) {
          freight.price = a.agreed_price;
        }
        return freight;
      });
      
      // Buscar service_requests aceitos pelo motorista
      const { data: serviceData, error: serviceError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('provider_id', profile.id)
        .in('status', ['ACCEPTED', 'IN_PROGRESS'])
        .order('updated_at', { ascending: false })
        .limit(100);

      if (serviceError) {
        console.error('❌ Erro buscando serviços aceitos:', serviceError);
      }
      
      // Converter service_requests para formato de frete
      const convertedServices = (serviceData || []).map(service => ({
        id: service.id,
        cargo_type: service.service_type === 'GUINCHO' ? 'Guincho' : 'Mudança',
        weight: 0,
        origin_address: service.location_address,
        destination_address: service.location_address,
        pickup_date: service.created_at,
        delivery_date: service.created_at,
        price: service.estimated_price || 0,
        status: service.status,
        service_type: service.service_type,
        producer_id: service.client_id,
        driver_id: service.provider_id,
        created_at: service.created_at,
        updated_at: service.updated_at,
        urgency: 'MEDIUM' as const,
        distance_km: 0,
        minimum_antt_price: 0,
        is_service_request: true, // Flag para identificar que é um service_request
        // Informações específicas do service_request
        problem_description: service.problem_description,
        contact_phone: service.contact_phone,
        contact_name: service.contact_name,
        additional_info: service.additional_info,
      }));
      
      // Combinar fretes diretos, assignments e serviços aceitos
      const allOngoing = [...(freightData || []), ...(assignmentFreights || []), ...convertedServices];
      
      // Deduplicate by id
      const seen = new Set();
      const dedupedOngoing = allOngoing.filter((item: any) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      
      console.log('📦 Fretes diretos encontrados:', freightData?.length || 0);
      console.log('🚚 Fretes via assignments encontrados:', assignmentFreights?.length || 0);
      console.log('🔧 Serviços aceitos encontrados:', serviceData?.length || 0);
      console.log('📊 Total de itens ativos (deduplicado):', dedupedOngoing.length);
      if (isMountedRef.current) setOngoingFreights(dedupedOngoing);

      // Verificar checkins para cada frete tradicional
      if (freightData && freightData.length > 0) {
        freightData.forEach(async (freight) => {
          try {
            const { count } = await (supabase as any)
              .from('freight_checkins')
              .select('*', { count: 'exact', head: true })
              .eq('freight_id', (freight as any).id)
              .eq('user_id', profile.id);
            if (isMountedRef.current) setFreightCheckins(prev => ({ ...prev, [(freight as any).id]: count || 0 }));
          } catch (error) {
            console.error('Error checking freight checkins for freight:', (freight as any).id, error);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching ongoing freights:', error);
      toast.error('Erro ao carregar fretes em andamento');
    }
  }, [profile?.id, profile?.role]);

  // Buscar solicitações de transporte (guincho, mudanças) disponíveis para motoristas
  const fetchTransportRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      console.log('🔍 Buscando solicitações de transporte para motorista:', profile.id);
      console.log('📍 Role do usuário:', profile.role);
      
      // Primeiro, vamos verificar se a query simples funciona
      const { data: allRequests, error: allError } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
      console.log('📋 Todas as service_requests encontradas:', allRequests?.length || 0);
      console.log('📊 Dados completos das service_requests:', allRequests);
      
      if (allError) {
        console.error('❌ Erro ao buscar TODAS as service_requests:', allError);
      }
      
      // Agora vamos buscar especificamente GUINCHO/MUDANCA
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .in('service_type', ['GUINCHO', 'MUDANCA'])
        .eq('status', 'OPEN')
        .is('provider_id', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar solicitações de transporte:', error);
        throw error;
      }
      
      console.log('🚛 Solicitações de transporte GUINCHO/MUDANCA encontradas:', data?.length || 0);
      console.log('📋 Dados filtrados:', data);
      
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

      const { error } = await supabase
        .from('service_requests')
        .update({ 
          provider_id: profile.id,
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('status', 'OPEN'); // Garantir que ainda está disponível

      if (error) throw error;

      toast.success('Solicitação aceita com sucesso!');
      fetchTransportRequests();
      await fetchOngoingFreights();
      setActiveTab('ongoing');
    } catch (error) {
      console.error('Error accepting transport request:', error);
      toast.error('Erro ao aceitar solicitação');
    }
  };
  const fetchCounterOffers = useCallback(async () => {
    if (!profile?.id || myProposals.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('freight_messages')
        .select(`
          *,
          freight:freights(*),
          sender:profiles!freight_messages_sender_id_fkey(*)
        `)
        .eq('message_type', 'COUNTER_PROPOSAL')
        .in('freight_id', myProposals.map(p => p.freight_id))
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (isMountedRef.current) setCounterOffers(data || []);
    } catch (error) {
      // Silenciar erro para não poluir UI
    }
  }, [profile?.id, myProposals]);

  const handleAcceptCounterOffer = async (messageId: string, freightId: string) => {
    try {
      // Marcar a mensagem como lida/aceita
      const { error: messageError } = await supabase
        .from('freight_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (messageError) throw messageError;

      // Aceitar o frete com o novo valor
      const { error: freightError } = await supabase
        .from('freights')
        .update({ 
          status: 'ACCEPTED',
          driver_id: profile?.id 
        })
        .eq('id', freightId);

      if (freightError) throw freightError;

      toast.success('Contra-proposta aceita com sucesso!');
      fetchCounterOffers();
      fetchMyProposals();
    } catch (error) {
      console.error('Error accepting counter offer:', error);
      toast.error('Erro ao aceitar contra-proposta');
    }
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

  // Função para buscar pagamentos pendentes
  const fetchPendingPayments = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      console.log('🔍 Buscando pagamentos pendentes para driver:', profile.id);
      
      const { data, error } = await supabase
        .from('external_payments')
        .select('*')
        .eq('driver_id', profile.id)
        .eq('status', 'proposed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('💰 Pagamentos pendentes encontrados:', data?.length || 0);
      console.log('📋 Dados dos pagamentos:', data);
      
      if (isMountedRef.current) setPendingPayments(data || []);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      if (isMountedRef.current) setPendingPayments([]);
    }
  }, [profile?.id]);

  // Função para confirmar recebimento de pagamento
  const confirmPaymentReceived = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('external_payments')
        .update({ 
          status: 'confirmed',
          accepted_by_driver: true,
          accepted_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast.success('Recebimento confirmado com sucesso!');
      fetchPendingPayments();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Erro ao confirmar recebimento');
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

  // Carregar dados - otimizado
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id || !isMountedRef.current) return;
      if (isMountedRef.current) setLoading(true);
      try {
        await Promise.all([
          fetchAvailableFreights(),
          fetchMyProposals(),
          fetchMyAssignments(),
          fetchOngoingFreights(),
          fetchTransportRequests(),
          fetchDriverCheckins(),
          fetchPendingPayments()
        ]);
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
  }, [profile?.id]);

  // Atualizar em tempo real contadores e listas ao mudar fretes/propostas
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel('realtime-freights-driver')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, () => {
        fetchAvailableFreights();
        fetchOngoingFreights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_matches' }, () => {
        fetchAvailableFreights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_proposals' }, () => {
        fetchMyProposals();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freight_assignments',
        filter: `driver_id=eq.${profile.id}`
      }, () => {
        fetchMyAssignments();
      })
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'service_requests', 
        filter: `provider_id=eq.${profile.id}` 
      }, () => {
        fetchOngoingFreights(); // Atualizar quando service_requests mudarem
        fetchTransportRequests(); // Também atualizar a lista de disponíveis
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'external_payments', 
        filter: `driver_id=eq.${profile.id}` 
      }, (payload) => {
        console.log('Mudança detectada em external_payments:', payload);
        fetchPendingPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Carregar contra-ofertas - debounced para evitar chamadas excessivas
  useEffect(() => {
    if (!profile?.id) return;
    
    const timeoutId = setTimeout(() => {
      fetchCounterOffers();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [profile?.id]);

  // Calcular estatísticas - memoizado para performance
  const statistics = useMemo(() => {
    const acceptedProposals = myProposals.filter(p => p.status === 'ACCEPTED');
    const pendingProposalsCount = myProposals.filter(p => p.status === 'PENDING').length;

    // Contar fretes ativos baseado nos fretes em andamento (inclui todos os status de fretes/serviços em progresso)
    const activeStatuses = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'IN_PROGRESS'];
    const activeTripsCount = ongoingFreights.filter(freight => 
      activeStatuses.includes(freight.status)
    ).length;
    
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
  }, [myProposals, availableFreights, totalCheckins, ongoingFreights]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  const handleMenuClick = () => {
    // Menu lateral funcionalidade futura
    console.log('Menu clicked');
  };

  const handleFreightAction = async (freightId: string, action: 'propose' | 'accept' | 'complete' | 'cancel') => {
    if (!profile?.id) return;

    try {
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
                ? 'Você já enviou uma proposta para este frete. Aguarde a resposta.'
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

          toast.success('Proposta enviada com sucesso!');
        } else if (action === 'accept') {
          // Check if user is a transport company
          const { data: transportCompanyData } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', profile.id)
            .maybeSingle();

          const isTransportCompany = !!transportCompanyData || profile.active_mode === 'TRANSPORTADORA';

          // Only require location for non-transport companies
          if (!isTransportCompany && !profile.location_enabled) {
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

          // Aceitação direta: não bloquear por proposta existente
          // Aceitar via Edge Function (bypass RLS com service role)
          const { data: acceptData, error: acceptError } = await (supabase as any).functions.invoke('accept-freight-multiple', {
            body: { freight_id: freightId, num_trucks: 1 },
          });
          if (acceptError || !acceptData?.success) {
            throw acceptError || new Error('Falha ao aceitar o frete');
          }

          toast.success(
            freight.service_type === 'GUINCHO'
              ? 'Chamado aceito com sucesso!'
              : freight.service_type === 'MUDANCA'
              ? 'Orçamento enviado com sucesso!'
              : 'Frete aceito com sucesso!'
          );

          // Atualização otimista da UI: mover para "Em Andamento" imediatamente
          setOngoingFreights(prev => {
            const updated = { ...freight, status: 'ACCEPTED' as const, driver_id: profile.id } as Freight;
            const without = prev.filter(f => f.id !== freightId);
            return [updated, ...without];
          });
          setAvailableFreights(prev => prev.filter(f => f.id !== freightId));
          setActiveTab('ongoing');
        }

        // Atualizar as listas
        fetchMyProposals();
        // Removido fetchOngoingFreights aqui para evitar sobrescrever a atualização otimista

      }
    } catch (error: any) {
      console.error('Error handling freight action:', error);
      toast.error('Erro ao processar ação. Tente novamente.');
    }
  };

  const handleFreightWithdrawal = (freight: Freight) => {
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
      fetchOngoingFreights();
      fetchMyProposals();
    } catch (error: any) {
      console.error('Error processing freight withdrawal:', error);
      toast.error('Erro ao processar desistência. Tente novamente.');
    }
  };

  // Função para cancelar frete aceito (antes do primeiro checkin)
  const handleFreightCancel = async (freightId: string) => {
    if (!profile?.id) return;
    
    try {
      // Verificar se há checkins para este frete
      const hasCheckins = await checkFreightCheckins(freightId);
      
      if (hasCheckins) {
        toast.error('Não é possível cancelar o frete após o primeiro check-in.');
        return;
      }

      // Atualizar o status do frete para OPEN (disponível novamente)
      const { error: freightError } = await supabase
        .from('freights')
        .update({ 
          status: 'OPEN',
          driver_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', freightId)
        .eq('driver_id', profile.id);

      if (freightError) throw freightError;

      // Atualizar a proposta para cancelada
      const { error: proposalError } = await supabase
        .from('freight_proposals')
        .update({ 
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('freight_id', freightId)
        .eq('driver_id', profile.id);

      if (proposalError) throw proposalError;

      toast.success('Frete cancelado com sucesso! O frete está novamente disponível para outros motoristas.');
      
      // Atualizar as listas
      fetchOngoingFreights();
      fetchMyProposals();
      
    } catch (error: any) {
      console.error('Error canceling freight:', error);
      toast.error('Erro ao cancelar frete. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
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
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-xl md:text-2xl font-bold mb-2">
              Olá, {profile?.full_name?.split(' ')[0] || (profile?.active_mode === 'TRANSPORTADORA' ? 'Transportadora' : 'Motorista')}
            </h1>
            <p className="text-sm md:text-base mb-2 opacity-90">
              Sistema IA encontra fretes para você
            </p>
            {isCompanyDriver && companyName && (
              <Badge variant="secondary" className="mb-3 bg-background/20 text-primary-foreground border-primary-foreground/30">
                <Users className="h-3 w-3 mr-1" />
                Motorista - {companyName}
              </Badge>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('available')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Brain className="mr-1 h-4 w-4" />
                Ver Fretes IA
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('cities')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <MapPin className="mr-1 h-4 w-4" />
                Configurar Região
              </Button>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('services')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Settings className="mr-1 h-4 w-4" />
                Configurar Serviços
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

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Stats Cards Compactos - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard
            size="sm"
            icon={<MapPin className="h-5 w-5" />}
            iconColor="text-primary"
            label="Disponíveis"
            value={availableCountUI}
            onClick={() => setActiveTab('available')}
          />

          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Ativas"
            value={statistics.activeTrips}
            onClick={() => setActiveTab('ongoing')}
          />

          <StatsCard
            size="sm"
            icon={<CheckCircle className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Propostas"
            value={statistics.pendingProposals}
            onClick={() => setActiveTab('my-trips')}
          />

          {/* Saldo - apenas para motoristas independentes e não afiliados */}
          {!isCompanyDriver && (
            <StatsCard
              size="sm"
              icon={<TrendingUp className="h-5 w-5" />}
              iconColor="text-blue-500"
              label="Saldo"
              value={showEarnings ? 'R$ 0,00' : '****'}
              onClick={() => setActiveTab('advances')}
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
          )}
          
          {/* Mensagem para motoristas afiliados */}
          {isAffiliated && (
            <StatsCard 
              size="sm"
              icon={<DollarSign className="h-5 w-5" />}
              iconColor="text-muted-foreground"
              label="Valores"
              value="Gerenciados pela empresa"
            />
          )}
        </div>

        {/* FreightLimitTracker compacto */}
        <div className="mb-4">
          <FreightLimitTracker hideForAffiliatedDriver={true} />
        </div>

        {/* Tabs Compactas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger 
                value="available" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Brain className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Fretes IA</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ongoing" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Em Andamento</span>
                <span className="sm:hidden">Ativo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Agendados</span>
                <span className="sm:hidden">Agenda</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calendar" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Áreas IA</span>
                <span className="sm:hidden">Áreas</span>
              </TabsTrigger>
              <TabsTrigger 
                value="cities" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MapPin className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Cidades</span>
                <span className="sm:hidden">Cidades</span>
              </TabsTrigger>
              <TabsTrigger 
                value="my-trips" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden">Propos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Settings className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Serviços</span>
                <span className="sm:hidden">Serv</span>
              </TabsTrigger>
              <TabsTrigger 
                value="vehicles" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Truck className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Meus Veículos</span>
                <span className="sm:hidden">Veíc</span>
              </TabsTrigger>
              {/* Tabs de pagamentos e saldo - apenas para motoristas não afiliados */}
              {!isCompanyDriver && !isAffiliated && (
                <>
                  <TabsTrigger 
                    value="payments" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Pagamentos</span>
                    <span className="sm:hidden">Pag</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="advances" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Banknote className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Saldo</span>
                    <span className="sm:hidden">Saldo</span>
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger 
                value="historico" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Hist</span>
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

          {/* ✅ FASE 4 - Alerta de Localização Desativada (apenas para motoristas independentes) */}
          {!isTransportCompany && !profile?.location_enabled && (
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
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes Disponíveis com IA</h3>
              <AdvancedFreightSearch
                onSearch={(filters) => {
                  console.log('Advanced search filters:', filters);
                  // Apply advanced filters to freight search
                  fetchAvailableFreights();
                }}
                userRole="MOTORISTA"
              />
            </div>
            <SmartFreightMatcher 
              onFreightAction={handleFreightAction}
              onCountsChange={({ total }) => setAvailableCountUI(total)}
            />
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-3">
            <div className="flex flex-col space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">Em Andamento</h3>
                <Badge variant="secondary" className="text-xs">
                  {(myAssignments?.length || 0) + ongoingFreights.filter(f => ['ACCEPTED','IN_PROGRESS','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION'].includes(f.status)).length}
                </Badge>
              </div>
            </div>
            
            {/* Assignments (Fretes com valores individualizados) */}
            {myAssignments && myAssignments.length > 0 && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-green-600" />
                  <h4 className="text-sm font-semibold text-green-600">Seus Contratos Ativos</h4>
                  <Badge variant="outline" className="text-xs">{myAssignments.length}</Badge>
                </div>
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
              </div>
            )}
            
            {ongoingFreights.filter(f => ['ACCEPTED','IN_PROGRESS','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION'].includes(f.status)).length > 0 ? (
              <div className="space-y-4">
                {ongoingFreights.filter(f => ['ACCEPTED','IN_PROGRESS','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION'].includes(f.status)).map((freight) => (
                  <Card key={freight.id} className="shadow-sm border border-border/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      {/* Header com tipo de carga e status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-foreground text-sm">
                            {getCargoTypeLabel(freight.cargo_type)}
                          </h3>
                        </div>
                        <Badge variant="default" className="text-xs bg-primary text-primary-foreground px-2 py-1">
                          {freight.status === 'ACCEPTED' ? 'Aceito' : 'Ativo'}
                        </Badge>
                      </div>

                      {/* Origem e Destino simplificados - apenas cidades */}
                      <div className="space-y-2 text-sm mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">De:</span>
                          <span className="font-medium truncate max-w-[200px]">
                            {freight.origin_address.split(',').slice(-2).join(',').trim()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Para:</span>
                          <span className="font-medium truncate max-w-[200px]">
                            {freight.destination_address.split(',').slice(-2).join(',').trim()}
                          </span>
                        </div>
                      </div>

                      {/* Valor em destaque */}
                      <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-3 rounded-lg border border-border/20 mb-3">
                        <div className="text-center">
                          <span className="text-lg font-bold text-primary">
                            R$ {freight.price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      {/* Botões de ação simplificados */}
                      <div className="flex gap-2">
                        {!freight.is_service_request && (freight.status === 'ACCEPTED' || freight.status === 'LOADING' || freight.status === 'IN_TRANSIT') && (
                          <Button 
                            size="sm" 
                            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              setInitialCheckinType(null);
                              setSelectedFreightForCheckin(freight.id);
                              setShowCheckinModal(true);
                            }}
                          >
                            Check-in
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 h-8 text-xs border-primary/30 hover:bg-primary/5"
                          onClick={() => {
                            if (freight.is_service_request) {
                              setSelectedServiceRequest(freight);
                              setShowServiceRequestDialog(true);
                            } else {
                              setSelectedFreightId(freight.id);
                              setShowDetails(true);
                            }
                          }}
                        >
                          Ver Detalhes
                        </Button>
                      </div>

                      {/* Check-ins counter - apenas contador simples */}
                      {freightCheckins[freight.id] > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <div className="flex items-center justify-center text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {freightCheckins[freight.id]} check-in{freightCheckins[freight.id] !== 1 ? 's' : ''} realizado{freightCheckins[freight.id] !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              !myAssignments || myAssignments.length === 0 ? (
                <div className="text-center py-12">
                  <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Nenhum frete em andamento
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Quando você aceitar um frete ou ele for aceito pelo produtor, aparecerá aqui
                  </p>
                  <Button 
                    onClick={() => setActiveTab('available')}
                    className="mt-2"
                  >
                    Ver Fretes Disponíveis
                  </Button>
                </div>
              ) : null
            )}
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledFreightsManager />
          </TabsContent>


          <TabsContent value="calendar" className="space-y-4">
            <DriverAvailabilityAreasManager 
              driverId={profile?.id}
              onFreightAction={handleFreightAction}
            />
          </TabsContent>

          <TabsContent value="cities" className="space-y-4">
            <UserCityManager 
              userRole="MOTORISTA"
              onCitiesUpdate={() => {
                // Atualizar fretes disponíveis quando cidades forem atualizadas
                fetchAvailableFreights();
                toast.success('Configuração de cidades atualizada!');
              }}
            />
          </TabsContent>

          <TabsContent value="services">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Tipos de Serviços</h3>
                <ServiceTypeManager />
              </div>
              
              
              <div className="border-t pt-6">
                <MatchIntelligentDemo />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-trips" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Minhas Propostas Enviadas</h3>
              <Badge variant="secondary" className="text-sm font-medium">
                {myProposals.filter(p => p.status === 'PENDING').length} proposta{myProposals.filter(p => p.status === 'PENDING').length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {myProposals.some(p => p.status === 'PENDING') ? (
              <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                {myProposals.filter(p => p.status === 'PENDING').map((proposal) => (
                  proposal.freight && (
                    <div key={proposal.id} className="relative">
                       <FreightCard 
                         freight={{
                           ...proposal.freight,
                           status: proposal.freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED',
                           service_type: (proposal.freight.service_type === 'GUINCHO' || 
                                        proposal.freight.service_type === 'MUDANCA' || 
                                        proposal.freight.service_type === 'CARGA') 
                                       ? proposal.freight.service_type as 'GUINCHO' | 'MUDANCA' | 'CARGA'
                                       : undefined
                         }}
                        showActions={false}
                      />
                      
                      {/* Informações compactas da proposta */}
                      <div className="mt-3 p-3 bg-gradient-to-r from-card to-secondary/10 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Sua Proposta:</span>
                          <span className="text-lg font-bold text-primary">
                            R$ {proposal.proposed_price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <Badge 
                            variant={
                              proposal.status === 'ACCEPTED' ? 'default' :
                              proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {proposal.status === 'ACCEPTED' ? 'Aceita' :
                             proposal.status === 'PENDING' ? 'Aguardando' : 
                             proposal.status === 'REJECTED' ? 'Rejeitada' :
                             proposal.status === 'CANCELLED' ? 'Cancelada' : proposal.status}
                          </Badge>
                          
                          {/* Diferença de preço compacta */}
                          {proposal.freight?.price && (
                            <span className={`text-xs font-medium ${
                              proposal.proposed_price > proposal.freight.price ? 'text-red-600' : 
                              proposal.proposed_price < proposal.freight.price ? 'text-green-600' : 'text-muted-foreground'
                            }`}>
                              {proposal.proposed_price > proposal.freight.price ? '+' : 
                               proposal.proposed_price < proposal.freight.price ? '-' : ''}
                              R$ {Math.abs(proposal.proposed_price - proposal.freight.price).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações baseadas no status */}
                      {proposal.status === 'ACCEPTED' && (
                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-sm text-center text-green-700 dark:text-green-300 font-medium">
                            ✅ Proposta aceita! Verifique a aba "Em Andamento"
                          </p>
                        </div>
                      )}
                      
                      {proposal.status === 'PENDING' && (
                        <Button 
                          variant="outline" 
                          className="w-full mt-4 border-2 border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5" 
                          size="sm"
                          onClick={() => handleFreightAction(proposal.freight!.id, 'cancel')}
                        >
                          Cancelar Proposta
                        </Button>
                      )}

                      {proposal.status === 'REJECTED' && (
                        <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border/40">
                          <p className="text-xs text-center text-muted-foreground">
                            Proposta rejeitada. Você pode fazer uma nova proposta se desejar.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                ))}
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

                {/* Estatísticas motivacionais */}
                <div className="bg-muted/50 rounded-lg p-6 max-w-md mx-auto">
                  <h4 className="font-semibold mb-3">💡 Dica de Sucesso</h4>
                  <p className="text-sm text-muted-foreground">
                    Motoristas que enviam pelo menos 3 propostas por semana têm 
                    <span className="font-semibold text-primary"> 85% mais chances</span> de fechar negócios.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={() => setActiveTab('available')}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    Ver Fretes IA
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
            <h3 className="text-lg font-semibold">Contra-ofertas Recebidas</h3>
            {counterOffers.length > 0 ? (
              <div className="space-y-4">
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
                            Aceitar Contra-proposta
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                          >
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Você não tem contra-ofertas pendentes
              </p>
            )}
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4">
            <VehicleManager driverProfile={profile} />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
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
                {pendingPayments.map((payment) => (
                  <Card key={payment.id} className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/10">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-lg">
                              💰 Pagamento Disponível
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              Frete: {payment.freight?.cargo_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.freight?.origin_address} → {payment.freight?.destination_address}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                            Aguardando Confirmação
                          </Badge>
                        </div>

                        <div className="bg-white/60 dark:bg-gray-800/60 p-3 rounded-lg border">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium">Valor informado pelo produtor:</p>
                              <p className="text-2xl font-bold text-green-600">
                                R$ {payment.amount?.toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Produtor:</p>
                              <p className="text-sm font-medium">{payment.producer?.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payment.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {payment.notes && (
                          <div className="bg-muted/30 p-2 rounded text-sm">
                            <p className="font-medium">Observações:</p>
                            <p>{payment.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button 
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => confirmPaymentReceived(payment.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirmar Recebimento
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-red-200 hover:bg-red-50 text-red-600"
                            onClick={() => {
                              // TODO: Implementar função para contestar pagamento
                              toast.info('Funcionalidade em desenvolvimento - Entre em contato com o produtor');
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Contestar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="advances" className="space-y-4">
            <DriverPayouts driverId={profile?.id || ''} />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <PendingRatingsPanel 
              userRole="MOTORISTA"
              userProfileId={profile?.id || ''}
            />
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <UnifiedHistory userRole="MOTORISTA" />
          </TabsContent>

        </Tabs>
      </div>
      
      {/* Modal de Check-in */}
      {selectedFreightForCheckin && (
<FreightCheckinModal
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
    fetchDriverCheckins(); // Atualizar contadores de check-ins
    setShowCheckinModal(false);
    setSelectedFreightForCheckin(null);
    setInitialCheckinType(null);
    // Preservar o estado de visualização de detalhes - não limpar selectedFreightId nem showDetails
  }}
/>
      )}

      {/* Modal de Desistência */}
      <FreightWithdrawalModal
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
      {showLocationManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
      )}
      {/* Detalhes do Chamado de Serviço (GUINCHO/MUDANCA) */}
      <Dialog open={showServiceRequestDialog} onOpenChange={(open) => { if (!open) setShowServiceRequestDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedServiceRequest?.service_type === 'GUINCHO' ? 'Chamado de Guincho' : 'Serviço de Mudança'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {/* Informações do Solicitante */}
            {(selectedServiceRequest?.contact_name || selectedServiceRequest?.contact_phone) && (
              <div>
                <h4 className="font-semibold text-primary mb-2">Solicitante</h4>
                <div className="space-y-2">
                  {selectedServiceRequest?.contact_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="font-medium">{selectedServiceRequest.contact_name}</span>
                    </div>
                  )}
                  {selectedServiceRequest?.contact_phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Telefone:</span>
                      <a
                        href={getWhatsAppUrl(selectedServiceRequest.contact_phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {formatPhone(selectedServiceRequest.contact_phone)}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Local do Atendimento */}
            <div>
              <h4 className="font-semibold text-primary mb-2">Local do Atendimento</h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Endereço:</span>
                <span className="font-medium max-w-[200px] text-right">
                  {selectedServiceRequest?.origin_address}
                </span>
              </div>
            </div>

            {/* Descrição do Problema */}
            {selectedServiceRequest?.problem_description && (
              <div>
                <h4 className="font-semibold text-primary mb-2">Descrição do Problema</h4>
                <p className="text-muted-foreground bg-muted p-2 rounded text-xs">
                  {selectedServiceRequest.problem_description}
                </p>
              </div>
            )}

            {/* Informações Adicionais */}
            {selectedServiceRequest?.additional_info && (
              <div>
                <h4 className="font-semibold text-primary mb-2">Informações Adicionais</h4>
                <p className="text-muted-foreground bg-muted p-2 rounded text-xs">
                  {selectedServiceRequest.additional_info}
                </p>
              </div>
            )}

            {/* Status e Data */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="secondary">{selectedServiceRequest?.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em:</span>
                <span className="font-medium text-xs">
                  {selectedServiceRequest?.pickup_date && new Date(selectedServiceRequest.pickup_date).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowServiceRequestDialog(false)}>
              Fechar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedServiceRequest && handleCompleteServiceRequest(selectedServiceRequest.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              Encerrar Chamado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
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
    </div>
  );
};

export default DriverDashboard;