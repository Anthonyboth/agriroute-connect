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
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { PageDOMErrorBoundary } from '@/components/PageDOMErrorBoundary';

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
import { Wrench, Send } from 'lucide-react';
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
import { SystemAnnouncementModal } from '@/components/SystemAnnouncementModal';
import { DriverAutoLocationTracking } from '@/components/DriverAutoLocationTracking';
import { useAutoRating } from '@/hooks/useAutoRating';
import { AutoRatingModal } from '@/components/AutoRatingModal';
import { useDriverPermissions } from '@/hooks/useDriverPermissions';

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
  const { mustUseChat } = useDriverPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Definir permissão unificada: autônomo vê fretes, empresa só se canAcceptFreights
  const canSeeFreights = !isCompanyDriver || canAcceptFreights;

  // Redirect to correct dashboard based on role and mode
  React.useEffect(() => {
    if (!profile?.id) return;

    // Check if user is in transport company mode
    const checkTransportMode = async () => {
      // ✅ NÃO redirecionar motoristas afiliados mesmo se tiverem active_mode TRANSPORTADORA
      if (profile.active_mode === 'TRANSPORTADORA' && profile.role !== 'MOTORISTA_AFILIADO') {
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
    if (profile.role && profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO') {
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
  // ✅ REMOVIDO: Dialog de service_request (motoristas não veem serviços)
  // Estados para controle de consentimento de tracking
  const [freightAwaitingConsent, setFreightAwaitingConsent] = useState<string | null>(null);
  const [showTrackingConsentModal, setShowTrackingConsentModal] = useState(false);
  
  // Estado para controlar avaliações automáticas
  const [activeFreightForRating, setActiveFreightForRating] = useState<Freight | null>(null);

  
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
  
  // ✅ REMOVIDO: handleCompleteServiceRequest (motoristas não gerenciam service_requests)


  const [loading, setLoading] = useState(true);
  const [availableCountUI, setAvailableCountUI] = useState(0);

  // Eliminar duplicações entre myAssignments e ongoingFreights
  const assignmentFreightIds = useMemo(() => 
    new Set((myAssignments || []).map(a => a.freight_id)), 
    [myAssignments]
  );

  // Excluir DELIVERED_PENDING_CONFIRMATION e DELIVERED dos ativos
  const activeStatuses = ['ACCEPTED','IN_PROGRESS','LOADING','LOADED','IN_TRANSIT'];
  
  const visibleOngoing = useMemo(
    () => (ongoingFreights || []).filter(f => 
      activeStatuses.includes(f.status) && !assignmentFreightIds.has(f.id)
    ),
    [ongoingFreights, assignmentFreightIds]
  );

  // Buscar fretes disponíveis - com match inteligente por região
  const fetchAvailableFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    console.log('[fetchAvailableFreights] isCompanyDriver:', isCompanyDriver, 'canAcceptFreights:', canAcceptFreights, 'companyId:', companyId);

    try {
      let companyFreights: Freight[] = [];
      let platformFreights: Freight[] = [];

      // Se é motorista de empresa SEM permissão de aceitar fretes: buscar APENAS fretes da transportadora
      if (isCompanyDriver && companyId && !canAcceptFreights) {
        console.log('[fetchAvailableFreights] Motorista de empresa SEM canAcceptFreights → apenas fretes da transportadora');
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
          service_type: f.service_type
        }));

        console.log('[fetchAvailableFreights] Fretes da transportadora:', companyFreights.length);
        if (isMountedRef.current) setAvailableFreights(companyFreights);
        return;
      }

      // CASO CONTRÁRIO: buscar fretes da plataforma (matching espacial + RPC + fallback)

      console.log('[fetchAvailableFreights] Buscando fretes da plataforma (matching espacial + RPC)');
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
        console.log('[fetchAvailableFreights] ✅ Matching espacial retornou:', spatialData);
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
            service_type: f.service_type,
            accepted_trucks: f.accepted_trucks || 0,
            required_trucks: f.required_trucks || 1
          }));
        console.log('[fetchAvailableFreights] 📦 Fretes do matching espacial:', platformFreights.length);
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
        console.log('[fetchAvailableFreights] ✅ RPC retornou:', freights.length, 'fretes');
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
            service_type: f.service_type,
            accepted_trucks: f.accepted_trucks || 0,
            required_trucks: f.required_trucks || 1
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
        console.log('[fetchAvailableFreights] 🔀 Após combinar spatial + RPC:', platformFreights.length);
      }

      // 3️⃣ FALLBACK: Se ainda vazio, buscar por user_cities
      if (platformFreights.length === 0) {
        console.log('[fetchAvailableFreights] 🔄 Usando fallback por cidades');
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
            console.log('[fetchAvailableFreights] ℹ️ Sem cidades configuradas');
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
            console.log('[fetchAvailableFreights] 🔄 Fallback: busca por nome/estado');
            
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
            service_type: f.service_type,
            accepted_trucks: f.accepted_trucks || 0,
            required_trucks: f.required_trucks || 1
          }));

          console.log('[fetchAvailableFreights] 📦 Fretes da plataforma (fallback):', platformFreights.length);
        } catch (fbErr) {
          console.error('[fetchAvailableFreights] ❌ Fallback por cidades falhou:', fbErr);
          if (isMountedRef.current) toast.error('Erro ao carregar fretes. Tente novamente.');
        }
      }

      // Se também é motorista de empresa COM permissão: buscar fretes da transportadora e combinar
      if (isCompanyDriver && companyId && canAcceptFreights) {
        console.log('[fetchAvailableFreights] Motorista de empresa COM canAcceptFreights → combinando fretes');
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
            service_type: f.service_type
          }));
          console.log('[fetchAvailableFreights] Fretes da transportadora:', companyFreights.length);
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
      console.log('[fetchAvailableFreights] Total após deduplicação:', finalFreights.length);

      if (isMountedRef.current) setAvailableFreights(finalFreights);
    } catch (error) {
      console.error('Error fetching available freights:', error);
      if (isMountedRef.current) toast.error('Erro ao carregar fretes disponíveis');
    }
  }, [profile?.id, profile?.role, isCompanyDriver, companyId]);

  // Buscar propostas do motorista - otimizado
  const fetchMyProposals = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    try {
      const { data, error } = await (supabase as any).functions.invoke('driver-proposals');
      if (error) {
        throw error;
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
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-driver-assignments');
      
      if (error) {
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

  // ✅ Buscar APENAS fretes em andamento (nunca service_requests)
  const fetchOngoingFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

    console.log('🔍 Buscando APENAS fretes ativos do motorista:', profile.id);
    try {
      // ✅ Buscar fretes vinculados ao motorista diretamente
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('*, producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone, role)')
        .eq('driver_id', profile.id)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
        .order('updated_at', { ascending: false })
        .limit(100);

      if (freightError) {
        console.error('❌ Erro buscando fretes diretos:', freightError);
        throw freightError;
      }

      // ✅ Buscar fretes via freight_assignments
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('freight_assignments')
        .select(`
          freight:freights(*, producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone, role)),
          status,
          agreed_price,
          accepted_at
        `)
        .eq('driver_id', profile.id)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
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
      
      // ✅ REMOVIDO: Não buscar service_requests aqui (motoristas não veem serviços)
      
      // ✅ Combinar APENAS fretes diretos e assignments (sem service_requests)
      const allOngoing = [...(freightData || []), ...(assignmentFreights || [])];
      
      // Deduplicate by id
      const seen = new Set();
      const dedupedOngoing = allOngoing.filter((item: any) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      
      // Filtrar fretes que já foram concluídos ou cancelados
      const filteredOngoing = dedupedOngoing.filter((item: any) => {
        // Sempre excluir DELIVERED e CANCELLED
        if (['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(item.status)) {
          console.log(`🔍 [DriverDashboard] Excluindo frete ${item.id} - Status: ${item.status}`);
          return false;
        }
        
        // Para service_requests, manter a lógica atual
        if (item.is_service_request) {
          return true;
        }
        
        // Para fretes tradicionais, verificar metadata de conclusão
        // Verificar se há confirmação do produtor no metadata (vários formatos possíveis)
        const metadata = item.metadata || {};
        const isConfirmedByProducer = 
          metadata.delivery_confirmed_at || 
          metadata.confirmed_by_producer === true ||
          metadata.confirmed_by_producer_at ||
          metadata.delivery_confirmed_by_producer === true;
        
        if (isConfirmedByProducer) {
          console.warn('🚨 [DriverDashboard] Frete confirmado com status inconsistente:', {
            id: item.id,
            status: item.status,
            metadata_keys: Object.keys(metadata)
          });
          
          // ✅ Tentar atualizar status automaticamente
          supabase
            .from('freights')
            .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
            .eq('id', item.id)
            .then(({ error }) => {
              if (error) {
                console.error('❌ Erro ao corrigir status do frete:', error);
              } else {
                console.log('✅ Status do frete corrigido automaticamente');
              }
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
      
      console.log('📦 Fretes diretos encontrados:', freightData?.length || 0);
      console.log('🚚 Fretes via assignments encontrados:', assignmentFreights?.length || 0);
      console.log('📊 Total de itens ativos (deduplicado):', dedupedOngoing.length);
      console.log('✅ Total de itens após filtro de conclusão:', filteredOngoing.length);
      if (isMountedRef.current) setOngoingFreights(filteredOngoing);

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
    if (!profile?.id || (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO')) return;

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

  const handleRejectCounterOffer = async (messageId: string) => {
    try {
      // Marcar a mensagem como lida/rejeitada
      const { error } = await supabase
        .from('freight_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;

      toast.success('Contra-proposta rejeitada');
      fetchCounterOffers();
    } catch (error) {
      console.error('Error rejecting counter offer:', error);
      toast.error('Erro ao rejeitar contra-proposta');
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
  }, [profile?.id, canSeeFreights, mustUseChat]);

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

        // Se mudou para DELIVERED_PENDING_CONFIRMATION, motorista avalia produtor
        if (newStatus === 'DELIVERED_PENDING_CONFIRMATION' && oldStatus !== 'DELIVERED_PENDING_CONFIRMATION') {
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
              .from('ratings')
              .select('id')
              .eq('freight_id', freightData.id)
              .eq('rater_user_id', profile.id)
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

        if (newStatus === 'DELIVERED_PENDING_CONFIRMATION' && oldStatus !== 'DELIVERED_PENDING_CONFIRMATION') {
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
              .from('ratings')
              .select('id')
              .eq('freight_id', freightData.id)
              .eq('rater_user_id', profile.id)
              .maybeSingle();

            if (!existingRating) {
              setActiveFreightForRating(freightData as Freight);
            }
          }
        }
      })
      .subscribe();

    // Canal normal de updates - condicional baseado em permissões
    const channelBuilder = supabase.channel('realtime-freights-driver');
    
    // Sempre escutar mudanças nos fretes do motorista e assignments
    channelBuilder.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'freights',
      filter: `driver_id=eq.${profile.id}`
    }, () => {
      fetchOngoingFreights();
    });
    
    channelBuilder.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'freight_assignments',
      filter: `driver_id=eq.${profile.id}`
    }, () => {
      fetchMyAssignments();
    });
    
    channelBuilder.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'external_payments', 
      filter: `driver_id=eq.${profile.id}` 
    }, (payload) => {
      console.log('Mudança detectada em external_payments:', payload);
      fetchPendingPayments();
    });
    
    // ✅ Usar canSeeFreights para subscriptions
    if (canSeeFreights) {
      channelBuilder.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freights' 
      }, () => {
        fetchAvailableFreights();
      });
      
      channelBuilder.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freight_matches' 
      }, () => {
        fetchAvailableFreights();
      });
      
      channelBuilder.on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'freight_proposals' 
      }, () => {
        fetchMyProposals();
      });
      
      channelBuilder.on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'service_requests', 
        filter: `provider_id=eq.${profile.id}` 
      }, () => {
        fetchOngoingFreights();
        fetchTransportRequests();
      });
    }
    
    const channel = channelBuilder.subscribe();

    return () => {
      supabase.removeChannel(ratingChannel);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, canSeeFreights]);

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

    // Contar fretes ativos - EXCLUIR DELIVERED_PENDING_CONFIRMATION (já entregue, aguardando confirmação)
    const activeStatuses = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'IN_PROGRESS'];
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
    
    // ✅ Bloquear ações de aceitar/propor para afiliados sem permissão
    if ((action === 'propose' || action === 'accept') && (!canAcceptFreights || mustUseChat)) {
      toast.error('Negociação via transportadora', {
        description: 'Entre em contato com sua transportadora pelo chat para negociar fretes.'
      });
      return;
    }

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

          // Aceitação direta: não bloquear por proposta existente
          // Aceitar via Edge Function (bypass RLS com service role)
          const { data: acceptData, error: acceptError } = await (supabase as any).functions.invoke('accept-freight-multiple', {
            body: { freight_id: freightId, num_trucks: 1 },
          });
          if (acceptError) {
            // Extract user-friendly message from edge function response
            const errorMsg = (acceptError as any)?.context?.response?.error 
              || (acceptError as any)?.message 
              || 'Falha ao aceitar o frete';
            throw new Error(errorMsg);
          }
          if (!acceptData?.success) {
            throw new Error('Falha ao aceitar o frete');
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
    <PageDOMErrorBoundary>
      <div className="min-h-screen bg-background">
        <SystemAnnouncementModal />
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
              {/* ✅ Mostrar botão "Ver Fretes IA" se canSeeFreights */}
              {canSeeFreights && (
                <Button 
                  variant="default"
                  size="sm"
                  onClick={() => setActiveTab('available')}
                  className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
                >
                  <Brain className="mr-1 h-4 w-4" />
                  Ver Fretes IA
                </Button>
              )}
              
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
          {/* ✅ Mostrar stats de fretes disponíveis se canSeeFreights */}
          {canSeeFreights && (
            <StatsCard
              size="sm"
              icon={<MapPin className="h-5 w-5" />}
              iconColor="text-primary"
              label="Disponíveis"
              value={availableCountUI}
              onClick={() => setActiveTab('available')}
            />
          )}

          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Ativas"
            value={statistics.activeTrips}
            onClick={() => setActiveTab('ongoing')}
          />

          {/* ✅ Mostrar stats de propostas se canSeeFreights */}
          {canSeeFreights && (
            <StatsCard
              size="sm"
              icon={<CheckCircle className="h-5 w-5" />}
              iconColor="text-green-500"
              label="Propostas"
              value={statistics.pendingProposals}
              onClick={() => setActiveTab('my-trips')}
            />
          )}

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
              {/* ✅ Mostrar tab "available" se canSeeFreights */}
              {canSeeFreights && (
                <TabsTrigger 
                  value="available" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <Brain className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Fretes IA</span>
                  <span className="sm:hidden">IA</span>
                </TabsTrigger>
              )}
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
              {/* ✅ Mostrar tab "my-trips" (propostas) se canSeeFreights */}
              {canSeeFreights && (
                <TabsTrigger 
                  value="my-trips" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Propostas</span>
                  <span className="sm:hidden">Propos</span>
                </TabsTrigger>
              )}
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

          {/* Auto-tracking para motoristas */}
          <DriverAutoLocationTracking />
          
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
          
          <TabsContent value="available" className="space-y-4" forceMount>
            <SafeListWrapper>
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
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-3" forceMount>
            <SafeListWrapper>
              <div className="flex flex-col space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">Em Andamento</h3>
                <Badge variant="secondary" className="text-xs">
                  {(myAssignments?.length || 0) + visibleOngoing.length}
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
                <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground">Atualizando lista...</div>}>
                  {myAssignments && myAssignments.length > 0 && myAssignments.map((assignment) => (
                    assignment?.id ? (
                      <MyAssignmentCard
                        key={`assignment-${assignment.id}-${assignment.freight_id}`}
                        assignment={assignment}
                        onAction={() => {
                          setSelectedFreightId(assignment.freight_id);
                          setShowDetails(true);
                        }}
                      />
                    ) : null
                  ))}
                </SafeListWrapper>
              </div>
            )}
            
            {visibleOngoing.length > 0 ? (
              <SafeListWrapper>
                <div className="space-y-4">
                  {visibleOngoing.map((freight) => (
                    <Card key={`ongoing-${freight.id}`} className="shadow-sm border border-border/50 hover:shadow-md transition-shadow">
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
                              setSelectedFreightId(freight.id);
                              setShowDetails(true);
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
              </SafeListWrapper>
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
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="scheduled" forceMount>
            <ScheduledFreightsManager />
          </TabsContent>


          <TabsContent value="calendar" className="space-y-4" forceMount>
            <SafeListWrapper>
              <DriverAvailabilityAreasManager
              driverId={profile?.id}
              onFreightAction={handleFreightAction}
              canAcceptFreights={canAcceptFreights}
              isAffiliated={isAffiliated}
              companyId={companyId}
              />
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="cities" className="space-y-4" forceMount>
            <UserCityManager 
              userRole="MOTORISTA"
              onCitiesUpdate={() => {
                // Atualizar fretes disponíveis quando cidades forem atualizadas
                fetchAvailableFreights();
                toast.success('Configuração de cidades atualizada!');
              }}
            />
          </TabsContent>

          <TabsContent value="services" forceMount>
            <SafeListWrapper>
              <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Tipos de Serviços</h3>
                <ServiceTypeManager />
              </div>
              
              
              <div className="border-t pt-6">
              <MatchIntelligentDemo />
                </div>
              </div>
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="my-trips" className="space-y-6" forceMount>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Minhas Propostas Enviadas</h3>
              <Badge variant="secondary" className="text-sm font-medium">
                {myProposals.filter(p => p.status === 'PENDING').length} proposta{myProposals.filter(p => p.status === 'PENDING').length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {myProposals.some(p => p.status === 'PENDING') ? (
              <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando propostas...</div>}>
                  {myProposals.filter(p => p.status === 'PENDING').map((proposal) => 
                    proposal.freight && proposal.id ? (
                      <div key={`proposal-${proposal.id}`} className="relative">
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
                              title={
                                proposal.status === 'ACCEPTED' ? 'Aceita pelo produtor' :
                                proposal.status === 'PENDING' ? 'Aguardando análise' : 'Rejeitada'
                              }
                            >
                              {proposal.status === 'ACCEPTED' ? '✅ Aceita' :
                               proposal.status === 'PENDING' ? '⏳ Pendente' : '❌ Rejeitada'}
                            </Badge>
                            
                            <span className="text-xs text-muted-foreground">
                              Enviada {new Date(proposal.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          
                          {proposal.message && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Mensagem:</p>
                              <p className="text-sm">{proposal.message}</p>
                            </div>
                          )}
                        </div>
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

          <TabsContent value="counter-offers" className="space-y-4" forceMount>
            <SafeListWrapper>
              <h3 className="text-lg font-semibold">Contra-ofertas Recebidas</h3>
            {counterOffers.length > 0 ? (
              <div className="space-y-4">
                <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando ofertas...</div>}>
                  {counterOffers.map((offer) => (
                    <Card key={`offer-${offer.id}`} className="p-4">
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

          <TabsContent value="vehicles" className="space-y-4" forceMount>
            <VehicleManager driverProfile={profile} />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4" forceMount>
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
                  {pendingPayments && pendingPayments.length > 0 && pendingPayments.map((payment) => (
                    <Card key={`payment-${payment.id}`} className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/10">
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
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              className="gradient-primary flex-1"
                              onClick={() => handleConfirmPayment(payment.id)}
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

                          {payment.payment_method && (
                            <p className="text-xs text-muted-foreground">
                              Método: {payment.payment_method === 'PIX' ? '💳 PIX' : 
                                      payment.payment_method === 'TED' ? '🏦 TED' : 
                                      payment.payment_method === 'MONEY' ? '💵 Dinheiro' : payment.payment_method}
                              {payment.created_at && ` • ${new Date(payment.created_at).toLocaleDateString('pt-BR')}`}
                            </p>
                          )}

                          {payment.payment_notes && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded text-xs">
                              <p className="font-medium mb-1">Observações:</p>
                              <p className="text-muted-foreground">{payment.payment_notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </SafeListWrapper>
              </div>
            )}
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="advances" className="space-y-4" forceMount>
            <DriverPayouts driverId={profile?.id || ''} />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6" forceMount>
            <SafeListWrapper>
              <PendingRatingsPanel
              userRole="MOTORISTA"
              userProfileId={profile?.id || ''}
              />
            </SafeListWrapper>
          </TabsContent>

          <TabsContent value="historico" className="mt-6" forceMount>
            <SafeListWrapper>
              <UnifiedHistory userRole="MOTORISTA" />
            </SafeListWrapper>
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
      </div>
    </PageDOMErrorBoundary>
  );
};

export default DriverDashboard;