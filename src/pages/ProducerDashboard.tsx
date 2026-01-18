import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import { CreateFreightWizardModal } from '@/components/freight-wizard';
import { EditFreightModal } from '@/components/EditFreightModal';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import { ProposalCounterModal } from '@/components/ProposalCounterModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FreightStatusTracker } from '@/components/FreightStatusTracker';
import FreightCheckinsViewer from '@/components/FreightCheckinsViewer';
import { FreightTrackingPanel } from '@/components/FreightTrackingPanel';
import { FreightDetails } from '@/components/FreightDetails';
import { DeliveryConfirmationModal } from '@/components/DeliveryConfirmationModal';

import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { getProposalStatusLabel, getFreightStatusLabel } from '@/lib/freight-status';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';
import { LABELS } from '@/lib/labels';
import { formatKm, formatBRL, formatDate } from '@/lib/formatters';
import { isInProgressFreight, isScheduledFreight, formatPickupDate } from '@/utils/freightDateHelpers';
import { FreightInProgressCard } from '@/components/FreightInProgressCard';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Plus, Settings, Play, DollarSign, Package, Calendar, Eye, Users, Phone, CreditCard, X, AlertTriangle, Star, MessageCircle, BarChart, Loader2, Bike } from 'lucide-react';
import { Wrench } from 'lucide-react';
import { AdvancedFreightFilters, FreightFilters } from '@/components/AdvancedFreightFilters';
import { FreightReportExporter } from '@/components/FreightReportExporter';
import { useFreightReportData } from '@/hooks/useFreightReportData';
import { ProducerReportsTab } from '@/pages/producer/ProducerReportsTab';
import { ProducerPaymentsTab } from '@/pages/producer/ProducerPaymentsTab';
import { Separator } from '@/components/ui/separator';
import { PendingRatingsPanel } from '@/components/PendingRatingsPanel';
import { ServicesModal } from '@/components/ServicesModal';
import { UnifiedHistory } from '@/components/UnifiedHistory';
import { showErrorToast } from '@/lib/error-handler';
import { SystemAnnouncementsBoard } from '@/components/SystemAnnouncementsBoard';
import { useAutoRating } from '@/hooks/useAutoRating';
import { AutoRatingModal } from '@/components/AutoRatingModal';
import { FreightProposalsManager } from '@/components/FreightProposalsManager';
import { UnifiedChatHub } from '@/components/UnifiedChatHub';
import { useUnreadChatsCount } from '@/hooks/useUnifiedChats';
import { FiscalTab } from '@/components/fiscal/tabs/FiscalTab';
import { FileText } from 'lucide-react';

// ✅ PHASE 2: Lazy load chart-heavy components to reduce initial bundle
const FreightAnalyticsDashboard = lazy(() => import('@/components/FreightAnalyticsDashboard').then(m => ({ default: m.FreightAnalyticsDashboard })));
const DriverPerformanceDashboard = lazy(() => import('@/components/dashboards/DriverPerformanceDashboard').then(m => ({ default: m.DriverPerformanceDashboard })));
const PeriodComparisonDashboard = lazy(() => import('@/components/PeriodComparisonDashboard').then(m => ({ default: m.PeriodComparisonDashboard })));
const RouteRentabilityReport = lazy(() => import('@/components/RouteRentabilityReport').then(m => ({ default: m.RouteRentabilityReport })));

// Loading fallback for chart components
const ChartLoader = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-muted-foreground">Carregando gráficos...</span>
  </div>
);

const ProducerDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Abrir aba específica quando vindo de notificação
  useEffect(() => {
    if (location.state?.openTab) {
      setActiveTab(location.state.openTab);
      
      // 🔥 Se vier com dados do frete, forçar atualização
      if (location.state.freightData) {
        setFreights(prev => {
          const existingIndex = prev.findIndex(f => f.id === location.state.freightData.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = location.state.freightData;
            return updated;
          }
          return [location.state.freightData, ...prev];
        });
      }
      
      // Limpar state após uso
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Redirect non-producers to their correct dashboard
  React.useEffect(() => {
    if (profile?.role === 'MOTORISTA') {
      navigate('/dashboard/driver', { replace: true });
      return;
    }
    if (profile?.role === 'PRESTADOR_SERVICOS') {
      navigate('/dashboard/service-provider', { replace: true });
      return;
    }
    if (profile?.role && profile.role !== 'PRODUTOR') {
      const correctRoute = profile.role === 'ADMIN' ? '/admin' : '/';
      navigate(correctRoute, { replace: true });
      return;
    }
  }, [profile?.role, navigate]);
  const [freights, setFreights] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('open');
  const [loading, setLoading] = useState(true);
  const [counterProposalModalOpen, setCounterProposalModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [editFreightModalOpen, setEditFreightModalOpen] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [freightToCancel, setFreightToCancel] = useState<any>(null);
  const [selectedTrackingFreight, setSelectedTrackingFreight] = useState<any>(null);
  const [selectedFreightDetails, setSelectedFreightDetails] = useState<any>(null);
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
  const [deliveryConfirmationModal, setDeliveryConfirmationModal] = useState(false);
  const [freightToConfirm, setFreightToConfirm] = useState<any>(null);
  const [externalPayments, setExternalPayments] = useState<any[]>([]);
  const [freightPayments, setFreightPayments] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [ongoingServiceRequests, setOngoingServiceRequests] = useState<any[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'critical' | 'urgent'>('all');
  
  // Estado para controlar avaliações automáticas
  const [activeFreightForRating, setActiveFreightForRating] = useState<any>(null);
  
  // Estados para aba de relatórios
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [filters, setFilters] = useState<FreightFilters>({
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Contador de mensagens não lidas
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(
    profile?.id || '', 
    'PRODUTOR'
  );
  
  // Lógica de filtragem para aba de relatórios
  const filteredFreights = useMemo(() => {
    let result = [...freights];
    
    // Aplicar filtros de status
    if (filters.status?.length) {
      result = result.filter(f => filters.status!.includes(f.status));
    }
    
    // Aplicar filtro de data
    if (filters.dateRange) {
      result = result.filter(f => {
        const date = new Date(f.pickup_date);
        return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
      });
    }
    
    // Aplicar filtro de preço
    if (filters.priceRange) {
      result = result.filter(f => 
        f.price >= filters.priceRange!.min && 
        f.price <= filters.priceRange!.max
      );
    }
    
    // Aplicar filtro de distância
    if (filters.distanceRange) {
      result = result.filter(f => 
        f.distance_km >= filters.distanceRange!.min && 
        f.distance_km <= filters.distanceRange!.max
      );
    }
    
    // Aplicar filtro de tipo de carga
    if (filters.cargoType?.length) {
      result = result.filter(f => filters.cargoType!.includes(f.cargo_type));
    }
    
    // Aplicar filtro de urgência
    if (filters.urgency?.length) {
      result = result.filter(f => filters.urgency!.includes(f.urgency));
    }
    
    // Aplicar ordenação
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime();
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'distance':
          comparison = a.distance_km - b.distance_km;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [freights, filters]);
  
  // Preparar dados para relatório
  const reportData = useFreightReportData(filteredFreights);

  // Buscar fretes - otimizado e resiliente
  const fetchFreights = useCallback(async () => {
    // Don't fetch if user is not a producer
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      return;
    }

    try {
      // ✅ Query com JOIN para carregar dados do motorista
      // Busca TODOS os fretes - a separação entre "Em Andamento" e "Agendados" acontece no client-side
      const { data, error } = await (supabase as any)
        .from('freights')
        .select(`
          *,
          profiles!driver_id(
            id,
            full_name,
            contact_phone,
            email,
            role
          )
        `)
        .eq('producer_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(500);
      
      if (error) {
        toast.error('Erro ao carregar fretes');
        showErrorToast(toast, 'Erro ao carregar fretes', error);
        return;
      }

      // Se vazio, não precisa fazer fallback
      if (!data || data.length === 0) {
        setFreights([]);
        return;
      }
      
      const freightData = data || [];
      let finalData = freightData;

      // 🔥 Enriquecer fretes com informação de deadline
      finalData = finalData.map(freight => {
        if (freight.status === 'DELIVERED_PENDING_CONFIRMATION') {
          const deliveredDate = freight.updated_at || freight.created_at;
          const deadline = new Date(new Date(deliveredDate).getTime() + (72 * 60 * 60 * 1000));
          const now = new Date();
          const hoursRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));
          
          const isUrgent = hoursRemaining < 24;
          const isCritical = hoursRemaining < 6;
          
          let displayText = '';
          if (hoursRemaining === 0) {
            displayText = 'PRAZO EXPIRADO';
          } else if (hoursRemaining < 24) {
            displayText = `${hoursRemaining}h restantes`;
          } else {
            const days = Math.floor(hoursRemaining / 24);
            const hours = hoursRemaining % 24;
            displayText = `${days}d ${hours}h restantes`;
          }
          
          return {
            ...freight,
            deliveryDeadline: { hoursRemaining, isUrgent, isCritical, displayText }
          };
        }
        return freight;
      });

      // Fallback: garantir que fretes aguardando confirmação apareçam
      if (finalData.every(f => f.status !== 'DELIVERED_PENDING_CONFIRMATION')) {
        const { data: dpcData, error: dpcError } = await (supabase as any)
          .from('freights')
          .select(`
            *,
            profiles!driver_id(
              id,
              full_name,
              contact_phone,
              email,
              role
            )
          `)
          .eq('producer_id', profile.id)
          .eq('status', 'DELIVERED_PENDING_CONFIRMATION')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!dpcError && dpcData && dpcData.length > 0) {
          const existingIds = new Set(finalData.map((f: any) => f.id));
          finalData = [...finalData, ...dpcData.filter((f: any) => !existingIds.has(f.id))];
        }
      }
      
      setFreights(finalData);
    } catch (error) {
      toast.error('Erro ao carregar fretes');
      showErrorToast(toast, 'Erro ao carregar fretes', error);
    }
  }, [profile?.id, profile?.role]);

  // Buscar propostas - otimizado
  const fetchProposals = useCallback(async () => {
    // Don't fetch if user is not a producer
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      return;
    }

    try {
      // First get freight IDs for this producer
      const { data: producerFreights, error: freightError } = await supabase
        .from('freights')
        .select('id')
        .eq('producer_id', profile.id);

      if (freightError) throw freightError;

      if (!producerFreights || producerFreights.length === 0) {
        setProposals([]);
        return;
      }

      const freightIds = producerFreights.map(f => f.id);

      // Then get proposals for those freights
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(*),
          driver:profiles!freight_proposals_driver_id_fkey(*)
        `)
        .in('freight_id', freightIds)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      toast.error('Erro ao carregar propostas');
    }
  }, [profile?.id, profile?.role]);

  // Buscar pagamentos externos com dados do frete e motorista
  const fetchExternalPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('external_payments')
        .select(`
          *,
          freight:freights(
            id,
            cargo_type,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            pickup_date,
            status,
            price,
            distance_km
          ),
          driver:profiles!external_payments_driver_id_fkey(
            id,
            full_name,
            contact_phone,
            profile_photo_url
          )
        `)
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Silently handle - table may not have data or RLS issue
        console.warn('Pagamentos externos não disponíveis:', error.message);
        setExternalPayments([]);
        return;
      }
      setExternalPayments(data || []);
    } catch (error) {
      console.warn('Erro ao buscar pagamentos externos:', error);
      setExternalPayments([]);
    }
  }, [profile?.id, profile?.role]);

  // Buscar pagamentos de fretes
  const fetchFreightPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('freight_payments')
        .select('*')
        .eq('payer_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Silently ignore if table doesn't exist or RLS error
        console.warn('Pagamentos de fretes não disponíveis:', error.message);
        setFreightPayments([]);
        return;
      }
      setFreightPayments(data || []);
    } catch (error) {
      // Silent fail - tabela pode não existir
      console.warn('Erro ao buscar pagamentos:', error);
      setFreightPayments([]);
    }
  }, [profile?.id, profile?.role]);

  // Buscar solicitações de serviço ABERTAS
  const fetchServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', profile.id)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setServiceRequests(data || []);
    } catch (error) {
      toast.error('Erro ao carregar serviços');
    }
  }, [profile?.id, profile?.role]);

  // ✅ NOVO: Buscar solicitações de serviço EM ANDAMENTO (aceitas pelo prestador)
  const fetchOngoingServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*, provider:provider_id(id, full_name, phone, rating)')
        .eq('client_id', profile.id)
        .in('status', ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'])
        .order('accepted_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setOngoingServiceRequests(data || []);
    } catch (error) {
      console.error('Erro ao carregar serviços em andamento:', error);
    }
  }, [profile?.id, profile?.role]);

  // Listener para redirecionar para histórico quando frete for movido
  useEffect(() => {
    const handleMovedToHistory = () => {
      setActiveTab('history');
      setSelectedFreightDetails(null);
      // Recarregar dados
      fetchFreights();
    };
    
    window.addEventListener('freight:movedToHistory', handleMovedToHistory);
    return () => window.removeEventListener('freight:movedToHistory', handleMovedToHistory);
  }, [fetchFreights]);

  // Carregar dados - otimizado
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id || profile.role !== 'PRODUTOR') {
        return;
      }

      setLoading(true);
      
      try {
        // Executar as funções em paralelo
        await Promise.all([
          fetchFreights(),
          fetchProposals(),
          fetchExternalPayments(),
          fetchFreightPayments(),
          fetchServiceRequests(),
          fetchOngoingServiceRequests()
        ]);
      } finally {
        setLoading(false);
      }
    };

    // Executar imediatamente se profile estiver disponível
    if (profile?.id && profile?.role === 'PRODUTOR') {
      loadData();
    }
  }, [profile?.id, profile?.role]);

  // Abrir frete automaticamente quando vem de notificação
  useEffect(() => {
    const state = location.state as any;
    if (!state || !profile?.id || !freights.length) return;
    
    // Aceitar tanto openFreightId quanto openChatFreightId
    const freightId = state.openFreightId || state.openChatFreightId;
    if (freightId) {
      const freight = freights.find(f => f.id === freightId);
      if (freight) {
        setSelectedFreightDetails(freight);
      }
      // Limpar state
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, profile?.id, freights, navigate, location.pathname]);


  // ✅ PHASE 2: Debounced fetch functions para evitar chamadas em cascata
  const debouncedFetchFreights = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fetchFreights(), 300);
      };
    },
    [fetchFreights]
  );

  const debouncedFetchProposals = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fetchProposals(), 300);
      };
    },
    [fetchProposals]
  );

  const debouncedFetchExternalPayments = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fetchExternalPayments(), 300);
      };
    },
    [fetchExternalPayments]
  );

  const debouncedFetchFreightPayments = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fetchFreightPayments(), 300);
      };
    },
    [fetchFreightPayments]
  );

  const debouncedFetchServiceRequests = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fetchServiceRequests(), 300);
      };
    },
    [fetchServiceRequests]
  );

  // Atualização em tempo real - COM DEBOUNCE
  useEffect(() => {
    if (!profile?.id) return;
    
    if (import.meta.env.DEV) {
      console.log('Configurando realtime para produtor:', profile.id);
    }
    
    // Canal para monitorar mudanças de status e disparar avaliação
    const ratingChannel = supabase
      .channel('producer-rating-trigger')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'freights',
        filter: `producer_id=eq.${profile.id}`
      }, async (payload) => {
        const newStatus = payload.new.status;
        const oldStatus = payload.old?.status;

        // Se mudou para DELIVERED, produtor avalia motorista
        if (newStatus === 'DELIVERED' && oldStatus !== 'DELIVERED') {
          const { data: freightData } = await supabase
            .from('freights')
            .select(`
              *,
              driver:profiles!freights_driver_id_fkey(id, full_name, role)
            `)
            .eq('id', payload.new.id)
            .single();

          if (freightData?.driver) {
            const { data: existingRating } = await supabase
              .from('ratings')
              .select('id')
              .eq('freight_id', freightData.id)
              .eq('rater_user_id', profile.id)
              .maybeSingle();

            if (!existingRating) {
              setActiveFreightForRating(freightData);
            }
          }
        }
      })
      .subscribe();
    
    const channel = supabase
      .channel('realtime-freights-producer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, () => {
        // ✅ PHASE 2: Usar versão debounced
        debouncedFetchFreights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_proposals' }, () => {
        debouncedFetchProposals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_payments' }, () => {
        debouncedFetchExternalPayments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_payments' }, () => {
        debouncedFetchFreightPayments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => {
        debouncedFetchServiceRequests();
      })
      .subscribe();

    return () => {
      if (import.meta.env.DEV) {
        console.log('Removendo canal realtime');
      }
      supabase.removeChannel(ratingChannel);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, debouncedFetchFreights, debouncedFetchProposals, debouncedFetchExternalPayments, debouncedFetchFreightPayments, debouncedFetchServiceRequests]);

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      if (!profile?.id) {
        toast.error('Erro: perfil não encontrado');
        return;
      }

      // Buscar a proposta para validar antes de aceitar
      const proposalToAccept = proposals.find(p => p.id === proposalId);
      if (!proposalToAccept) {
        toast.error('Proposta não encontrada');
        return;
      }

      // Validar se o valor da proposta é válido
      if (!proposalToAccept.proposed_price || proposalToAccept.proposed_price <= 0) {
        toast.error('Proposta com valor inválido (R$ 0). Faça uma contra-proposta ou rejeite.');
        return;
      }

      // Usar nova edge function para aceitar proposta e criar assignment
      const { data, error } = await supabase.functions.invoke('accept-freight-proposal', {
        body: {
          proposal_id: proposalId,
          producer_id: profile.id
        }
      });

      if (error) {
        console.error('Error accepting proposal:', error);
        // Tentar exibir a mensagem de erro específica da edge function
        const errorMessage = data?.error || error.message || 'Erro ao aceitar proposta';
        toast.error(errorMessage);
        return;
      }

      // Avisar se valor abaixo do ANTT
      if (data?.below_antt_minimum) {
        toast.warning(
          `⚠️ Valor aceito abaixo do mínimo ANTT por carreta`,
          { 
            description: `Aceito: R$ ${Number(data?.assignment?.agreed_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Mínimo ANTT: R$ ${Number(data.minimum_antt_price_per_truck || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            duration: 6000
          }
        );
      }

      // Mostrar informações sobre vagas restantes
      if (data?.remaining_trucks > 0) {
        toast.success(
          `Proposta aceita! Ainda ${data.remaining_trucks === 1 ? 'falta' : 'faltam'} ${data.remaining_trucks} ${data.remaining_trucks === 1 ? 'carreta' : 'carretas'}.`
        );
      } else {
        toast.success('Proposta aceita! Todas as carretas foram contratadas.');
      }

      // Remove a proposta aceita imediatamente do estado local e atualiza lista de fretes
      setProposals(prev => prev.filter(proposal => proposal.id !== proposalId));
      fetchFreights();
      
    } catch (error) {
      console.error('Error accepting proposal:', error);
      showErrorToast(toast, 'Falha ao aceitar proposta', error);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      // Remove a proposta rejeitada imediatamente do estado local
      setProposals(prev => prev.filter(proposal => proposal.id !== proposalId));
      
      toast.success('Proposta rejeitada');
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      toast.error('Erro ao rejeitar proposta');
    }
  };

  const handleCancelProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'CANCELLED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta cancelada');
      fetchProposals();
    } catch (error) {
      console.error('Error cancelling proposal:', error);
      toast.error('Erro ao cancelar proposta');
    }
  };

  const openCounterProposalModal = (proposal: any) => {
    setSelectedProposal({
      id: proposal.id,
      freight_id: proposal.freight?.id,
      proposed_price: proposal.proposed_price,
      message: proposal.message,
      driver_name: proposal.driver?.full_name || 'Motorista',
      freight_price: proposal.freight?.price
    });
    setCounterProposalModalOpen(true);
  };

  const handleFreightAction = async (action: 'edit' | 'cancel' | 'request-cancel', freight: any) => {
    if (action === 'edit') {
      setSelectedFreight(freight);
      setEditFreightModalOpen(true);
    } else if (action === 'cancel') {
      setFreightToCancel(freight);
      setConfirmDialogOpen(true);
    } else if (action === 'request-cancel') {
      // Abrir detalhes do frete para contato via chat
      setSelectedFreightDetails(freight);
      toast.info('Entre em contato com o motorista via chat para solicitar o cancelamento', {
        duration: 5000,
      });
    }
  };

  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;
    
    // Validar se pode cancelar diretamente
    const canCancelDirectly = ['OPEN', 'ACCEPTED', 'LOADING'].includes(freightToCancel.status);
    
    if (!canCancelDirectly) {
      toast.error('Este frete está em andamento. Solicite o cancelamento via chat com o motorista.');
      setConfirmDialogOpen(false);
      return;
    }
    
    try {
      // Use safe edge function to handle pickup_date validation
      const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
        body: {
          freight_id: freightToCancel.id,
          reason: 'Cancelado pelo produtor'
        }
      });

      if (error) {
        console.error('Error cancelling freight:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao cancelar frete');
      }

      // Notificar motorista se houver um assignado
      if (freightToCancel.driver_id) {
        await supabase.functions.invoke('send-notification', {
          body: {
            user_id: freightToCancel.profiles?.user_id,
            title: 'Frete Cancelado',
            message: `O frete de ${freightToCancel.cargo_type} foi cancelado pelo produtor.`,
            type: 'freight_cancelled',
            data: { freight_id: freightToCancel.id }
          }
        }).catch(err => console.warn('Notification failed:', err));
      }

      toast.success('Frete cancelado com sucesso!');
      setConfirmDialogOpen(false);
      setFreightToCancel(null);
      fetchFreights();
    } catch (error: any) {
      console.error('Error cancelling freight:', error);
      toast.error(error.message || 'Erro ao cancelar frete');
    }
  };

  // Estatísticas calculadas - memoizadas
  const statistics = useMemo(() => {
    const pendingExternalPayments = externalPayments.filter(p => p.status === 'proposed').length;
    const pendingFreightPayments = freightPayments.filter(p => p.status === 'PENDING').length;
    const totalPendingPayments = pendingExternalPayments + pendingFreightPayments;
    
    const totalPendingAmount = externalPayments
      .filter(p => p.status === 'proposed')
      .reduce((sum, p) => sum + (p.amount || 0), 0) +
      freightPayments
        .filter(p => p.status === 'PENDING')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const openServices = serviceRequests.filter(s => s.status === 'OPEN').length;
    
    // 🔍 Filtrar fretes em andamento usando isInProgressFreight (pickup_date hoje ou passado)
    const ongoingFreights = freights.filter(f => isInProgressFreight(f.pickup_date, f.status));
    
    if (import.meta.env.DEV) {
      console.log('[ProducerDashboard] 📊 Stats - Fretes em andamento:', {
        count: ongoingFreights.length,
        freights: ongoingFreights.map(f => ({ 
          id: f.id.slice(0, 8), 
          status: f.status, 
          pickup: f.pickup_date,
          origin: f.origin_city
        }))
      });
    }
    
    return {
      openFreights: freights.filter(f => f.status === 'OPEN').length + openServices, // Incluir service_requests no total
      activeFreights: ongoingFreights.length, // ✅ Corrigido: agora usa isInProgressFreight
      pendingConfirmation: freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length,
      totalValue: freights.reduce((sum, f) => sum + f.price, 0),
      pendingProposals: proposals.length,
      pendingPayments: totalPendingPayments,
      totalPendingAmount,
      openServices
    };
  }, [freights, proposals, externalPayments, freightPayments, serviceRequests]);

  const openDeliveryConfirmationModal = (freight: any) => {
    setFreightToConfirm(freight);
    setDeliveryConfirmationModal(true);
  };

  const closeDeliveryConfirmationModal = () => {
    setFreightToConfirm(null);
    setDeliveryConfirmationModal(false);
  };

  const handleDeliveryConfirmed = () => {
    console.log('handleDeliveryConfirmed chamado - atualizando lista de fretes');
    
    // Após confirmar entrega, solicitar pagamento automático se ainda não foi feito
    if (freightToConfirm && freightToConfirm.profiles) {
      const existingPayment = externalPayments.find(p => 
        p.freight_id === freightToConfirm.id && p.amount === freightToConfirm.price
      );
      
      if (!existingPayment) {
        setTimeout(() => {
          requestFullPayment(
            freightToConfirm.id, 
            freightToConfirm.profiles.id, 
            freightToConfirm.price
          );
        }, 1000);
      }

      // Abrir modal de avaliação do motorista após confirmação
      if (freightToConfirm.profiles?.id) {
        setTimeout(() => {
          // Disparar evento para abrir modal de avaliação
          window.dispatchEvent(new CustomEvent('show-freight-rating', {
            detail: {
              freightId: freightToConfirm.id,
              ratedUserId: freightToConfirm.profiles.id,
              ratedUserName: freightToConfirm.profiles.full_name
            }
          }));
        }, 500);
      }
    }
    
    fetchFreights(); // Recarregar dados após confirmação
    fetchExternalPayments(); // Recarregar pagamentos
  };

  const handlePaymentNotification = async (freightId: string, driverId: string, amount: number) => {
    try {
      console.log('Processando notificação de pagamento:', { freightId, driverId, amount });
      
      // Criar registro de pagamento externo
      const { data: paymentData, error: paymentError } = await supabase
        .from('external_payments')
        .insert([
          {
            freight_id: freightId,
            producer_id: profile?.id,
            driver_id: driverId,
            amount: amount * 0.5, // 50% do valor
            status: 'proposed',
            notes: 'Solicitação de adiantamento do motorista'
          }
        ])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Enviar notificação para o motorista
      const { error: notificationError } = await supabase.functions.invoke('send-notification', {
        body: {
          user_id: driverId,
          title: 'Pagamento Disponível',
          message: `Produtor informou pagamento de R$ ${(amount * 0.5).toLocaleString('pt-BR')} para o frete. Confirme o recebimento.`,
          type: 'payment_notification',
          data: {
            freight_id: freightId,
            payment_id: paymentData.id,
            amount: amount * 0.5
          }
        }
      });

      if (notificationError) {
        console.error('Erro ao enviar notificação:', notificationError);
        // Não falhar se a notificação der erro
      }

      toast.success('Pagamento informado! O motorista foi notificado para confirmar o recebimento.');
      fetchFreights();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error('Erro ao processar pagamento');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  // Criar pagamento via sistema (Stripe)
  const handleCreateFreightPayment = async (freightId: string, amount: number, paymentType: string) => {
    try {
      setPaymentLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-freight-payment', {
        body: {
          freight_id: freightId,
          amount: Math.round(amount * 100), // Converter para centavos
          payment_type: paymentType
        }
      });

      if (error) throw error;

      toast.success('Redirecionando para o pagamento...');
      if (data?.checkout_url) {
        window.open(data.checkout_url, '_blank');
      }
      
      fetchFreightPayments();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Confirmar pagamento externo (feito fora do sistema)
  const handleConfirmExternalPayment = async (freightId: string, amount: number) => {
    try {
      setPaymentLoading(true);
      
      // Buscar dados do frete para pegar o driver_id
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('driver_id')
        .eq('id', freightId)
        .single();

      if (freightError) {
        console.error('Erro ao buscar frete:', freightError);
        toast.error('Erro ao buscar dados do frete. Tente novamente.');
        return;
      }

      // Verificar se o frete tem um motorista atribuído
      if (!freightData?.driver_id) {
        toast.error('Este frete ainda não foi aceito por um motorista');
        return;
      }

      // Buscar dados do driver com tratamento melhorado
      const { data: driverData, error: driverError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('id', freightData.driver_id)
        .maybeSingle();

      if (driverError) {
        console.error('Erro ao buscar dados do motorista:', driverError);
        toast.error('Erro ao buscar dados do motorista. O pagamento será registrado sem notificação.');
      }

      // Verificar se já existe um pagamento pendente para este frete
      const { data: existingPayment } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('freight_id', freightId)
        .eq('producer_id', profile?.id)
        .in('status', ['proposed', 'pending'])
        .maybeSingle();

      if (existingPayment) {
        toast.info('Já existe uma confirmação de pagamento pendente para este frete.');
        return;
      }

      // Criar registro de pagamento externo
      const { data: paymentData, error: paymentError } = await supabase
        .from('external_payments')
        .insert([
          {
            freight_id: freightId,
            producer_id: profile?.id,
            driver_id: freightData.driver_id,
            amount: amount,
            status: 'proposed',
            notes: 'Pagamento completo do frete após entrega confirmada'
          }
        ])
        .select()
        .single();

      if (paymentError) {
        // Tratar erro de constraint única
        if (paymentError.code === '23505') {
          toast.info('Já existe uma confirmação de pagamento para este frete.');
          return;
        }
        throw paymentError;
      }

      // Enviar notificação para o motorista (apenas se tiver user_id)
      if (driverData?.user_id) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              user_id: driverData.user_id,
              title: 'Confirmação de Pagamento',
              message: `Produtor confirmou o pagamento de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Confirme o recebimento.`,
              type: 'payment_confirmation',
              data: {
                freight_id: freightId,
                payment_id: paymentData.id,
                amount: amount
              }
            }
          });
        } catch (notifError) {
          console.warn('Notificação não enviada, mas pagamento registrado:', notifError);
        }
      }

      toast.success('Pagamento confirmado! Aguardando confirmação do motorista.');
      fetchExternalPayments();
    } catch (error: any) {
      console.error('Erro ao confirmar pagamento:', error);
      toast.error(error.message || 'Erro ao confirmar pagamento. Tente novamente.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Solicitar pagamento completo após entrega confirmada
  const requestFullPayment = async (freightId: string, driverId: string, amount: number) => {
    try {
      setPaymentLoading(true);
      console.log('Solicitando pagamento completo:', { freightId, driverId, amount });
      
      // Criar registro de pagamento externo
      const { data: paymentData, error: paymentError } = await supabase
        .from('external_payments')
        .insert([
          {
            freight_id: freightId,
            producer_id: profile?.id,
            driver_id: driverId,
            amount: amount,
            status: 'proposed',
            notes: 'Pagamento completo do frete após entrega confirmada'
          }
        ])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Enviar notificação para o motorista
      const { error: notificationError } = await supabase.functions.invoke('send-notification', {
        body: {
          user_id: driverId,
          title: 'Pagamento Disponível',
          message: `Produtor deve pagar o valor total de R$ ${amount.toLocaleString('pt-BR')} do frete. Confirme quando receber.`,
          type: 'payment_notification',
          data: {
            freight_id: freightId,
            payment_id: paymentData.id,
            amount: amount
          }
        }
      });

      if (notificationError) {
        console.error('Erro ao enviar notificação:', notificationError);
      }

      toast.success('Solicitação de pagamento enviada ao motorista!');
      fetchExternalPayments();
    } catch (error) {
      console.error('Erro ao solicitar pagamento:', error);
      toast.error('Erro ao solicitar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Confirmar que pagamento foi realizado
  const confirmPaymentMade = async (paymentId: string) => {
    try {
      setPaymentLoading(true);
      
      const { error } = await supabase
        .from('external_payments')
        .update({ 
          status: 'paid_by_producer',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;

      // ✅ Atualizar estado local imediatamente para remover da lista
      setExternalPayments(prev => 
        prev.map(p => p.id === paymentId 
          ? { ...p, status: 'paid_by_producer', confirmed_at: new Date().toISOString() }
          : p
        )
      );

      toast.success('Pagamento confirmado! Aguardando confirmação do motorista.');
      
      // Buscar dados atualizados em background
      fetchExternalPayments();
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      toast.error('Erro ao confirmar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/5 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-background via-secondary/5 to-background overflow-x-hidden overflow-y-auto">
      <Header
        user={{ name: profile?.full_name || 'Usuário', role: (profile?.role as 'PRODUTOR' | 'MOTORISTA') || 'PRODUTOR' }}
        onLogout={handleLogout}
        onMenuClick={() => {}}
        userProfile={profile}
        notifications={unreadCount}
      />
      
      {/* Hero Section Compacta */}
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(/hero-truck-night-moon.webp)` }}
        />
        <div className="absolute inset-0 bg-primary/75" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Painel de Gerenciamento
            </h1>
            <p className="text-base opacity-90 max-w-xl mx-auto mb-4">
              Gerencie seus fretes, acompanhe propostas e monitore o desempenho
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <CreateFreightWizardModal 
                onFreightCreated={fetchFreights}
                userProfile={profile}
              />
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('proposals')}
                className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
              >
                <Users className="mr-1 h-4 w-4" />
                Ver Propostas
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Solicitar Serviços
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('ratings')}
                className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
              >
                <Star className="mr-1 h-4 w-4" />
                Avaliações
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4 pb-8">
        {/* Stats Cards Compactos - Navegáveis */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <StatsCard
            size="sm"
            icon={<Package className="h-5 w-5" />}
            iconColor="text-blue-500"
            label="Abertos"
            value={statistics.openFreights}
            onClick={() => setActiveTab('open')}
          />

          <StatsCard
            size="sm"
            icon={<Play className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Andamento"
            value={statistics.activeFreights}
            onClick={() => setActiveTab('ongoing')}
          />

          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-amber-500"
            label="P/ Confirmar"
            value={statistics.pendingConfirmation}
            onClick={() => setActiveTab('confirm-delivery')}
          />

          <StatsCard
            size="sm"
            icon={<Users className="h-5 w-5" />}
            iconColor="text-purple-500"
            label="Propostas"
            value={statistics.pendingProposals}
            onClick={() => setActiveTab('proposals')}
          />

          <StatsCard
            size="sm"
            icon={<CreditCard className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Pagamentos"
            value={statistics.pendingPayments}
            onClick={() => setActiveTab('payments')}
          />

          <StatsCard
            size="sm"
            icon={<Wrench className="h-5 w-5" />}
            iconColor="text-teal-500"
            label="Serviços"
            value={statistics.openServices || 0}
            onClick={() => setActiveTab('history')}
          />
        </div>

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
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger 
                value="open" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Package className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline" translate="no">Abertos</span>
                <span className="sm:hidden" translate="no">Abertos</span>
                {statistics.openFreights > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {statistics.openFreights}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="fiscal" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline" translate="no">Fiscal</span>
                <span className="sm:hidden" translate="no">Fiscal</span>
              </TabsTrigger>
              <TabsTrigger
                value="ongoing" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline" translate="no">Em Andamento</span>
                <span className="sm:hidden" translate="no">Em Andamento</span>
              </TabsTrigger>
              <TabsTrigger 
                value="confirm-delivery" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Confirmar Entrega</span>
                <span className="sm:hidden" translate="no">Confirmar Entrega</span>
                {statistics.pendingConfirmation > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                    {statistics.pendingConfirmation}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="proposals" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden" translate="no">Propostas</span>
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Calendar className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Agendados</span>
                <span className="sm:hidden" translate="no">Agendados</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden" translate="no">Histórico</span>
              </TabsTrigger>
              <TabsTrigger 
                value="payments" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Pagamentos</span>
                <span className="sm:hidden" translate="no">Pagamentos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ratings" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Star className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Avaliações</span>
                <span className="sm:hidden" translate="no">Avaliações</span>
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline" translate="no">Chat</span>
                <span className="sm:hidden" translate="no">Chat</span>
                {chatUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                    {chatUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <BarChart className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Relatórios</span>
                <span className="sm:hidden" translate="no">Rel</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Notificação de assinatura */}
          <SubscriptionExpiryNotification />

          <TabsContent value="open" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes e Serviços Abertos</h3>
            </div>
            
            {freights.filter(f => f.status === 'OPEN').length === 0 && serviceRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete ou serviço aberto</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes ou serviços abertos no momento. Crie um novo frete para começar.
                  </p>
                  <CreateFreightWizardModal 
                    onFreightCreated={fetchFreights}
                    userProfile={profile}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Fretes da tabela freights */}
                {freights.filter(f => f.status === 'OPEN').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Fretes ({freights.filter(f => f.status === 'OPEN').length})
                    </h4>
                    <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                      {freights.filter(f => f.status === 'OPEN').map((freight) => (
                        <FreightCard
                          key={freight.id}
                          freight={{
                            id: freight.id,
                            cargo_type: freight.cargo_type,
                            weight: (freight.weight / 1000),
                            distance_km: freight.distance_km,
                            origin_address: freight.origin_address,
                            destination_address: freight.destination_address,
                            price: freight.price,
                            status: freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'ACCEPTED' | 'IN_NEGOTIATION' | 'CANCELLED',
                            pickup_date: freight.pickup_date,
                            delivery_date: freight.delivery_date,
                            urgency: freight.urgency,
                            minimum_antt_price: freight.minimum_antt_price || 0,
                            required_trucks: freight.required_trucks || 1,
                            accepted_trucks: freight.accepted_trucks || 0,
                            service_type: freight.service_type
                          }}
                          showProducerActions={true}
                          onAction={(action) => handleFreightAction(action as 'edit' | 'cancel', freight)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Solicitações de serviço (service_requests) incluindo FRETE_MOTO */}
                {serviceRequests.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Solicitações de Serviço ({serviceRequests.length})
                    </h4>
                    <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                      {serviceRequests.map((sr: any) => (
                        <Card key={sr.id} className="hover:shadow-lg transition-all duration-300 border-2 border-border/60 overflow-hidden">
                          <div className={`p-4 ${
                            sr.service_type === 'GUINCHO' ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5' :
                            sr.service_type === 'FRETE_MOTO' ? 'bg-gradient-to-r from-purple-500/10 to-purple-600/5' :
                            'bg-gradient-to-r from-blue-500/10 to-blue-600/5'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  sr.service_type === 'GUINCHO' ? 'bg-orange-100 dark:bg-orange-900/30' :
                                  sr.service_type === 'FRETE_MOTO' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                  'bg-blue-100 dark:bg-blue-900/30'
                                }`}>
                                  {sr.service_type === 'GUINCHO' ? (
                                    <Wrench className="h-5 w-5 text-orange-600" />
                                  ) : sr.service_type === 'FRETE_MOTO' ? (
                                    <Truck className="h-5 w-5 text-purple-600" />
                                  ) : (
                                    <Package className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-bold text-foreground">
                                    {sr.service_type === 'GUINCHO' ? 'Guincho' : 
                                     sr.service_type === 'FRETE_MOTO' ? 'Frete por Moto' :
                                     sr.service_type === 'MUDANCA' ? 'Mudança' : sr.service_type}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">Solicitação #{sr.id?.slice(0, 8)}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300">
                                Aguardando
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="font-medium">
                                {sr.city_name || sr.location_address || 'Local não informado'}
                                {sr.state && ` - ${sr.state}`}
                              </span>
                            </div>
                            {sr.problem_description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{sr.problem_description}</p>
                            )}
                            {sr.estimated_price && (
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-bold text-green-600">
                                  R$ {sr.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Criado em: {formatDate(sr.created_at)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Em Andamento</h3>
            </div>
            
            {(() => {
              // 🔍 Filtrar fretes em andamento ÚNICO vez - reutilizar para card E lista
              const ongoingFreights = freights.filter(f => isInProgressFreight(f.pickup_date, f.status));
              
              if (import.meta.env.DEV) {
                console.log('[ProducerDashboard] 📋 Lista "Em Andamento":', {
                  freightsCount: ongoingFreights.length,
                  servicesCount: ongoingServiceRequests.length
                });
              }
              
              const hasOngoingItems = ongoingFreights.length > 0 || ongoingServiceRequests.length > 0;
              
              return !hasOngoingItems ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Play className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Nenhum frete ou serviço em andamento</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                      Você não possui fretes ou serviços em andamento no momento.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
                  {/* ✅ NOVO: Serviços em andamento (Guincho/Moto/Mudança) */}
                  {ongoingServiceRequests.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Serviços em Andamento ({ongoingServiceRequests.length})
                      </h4>
                      <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                        {ongoingServiceRequests.map((sr: any) => (
                          <Card key={sr.id} className="border-l-4 border-l-primary">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {sr.service_type === 'GUINCHO' && <Truck className="h-5 w-5 text-orange-500" />}
                                  {sr.service_type === 'FRETE_MOTO' && <Bike className="h-5 w-5 text-blue-500" />}
                                  {sr.service_type === 'MUDANCA' && <Package className="h-5 w-5 text-purple-500" />}
                                  <span className="font-semibold">
                                    {sr.service_type === 'GUINCHO' ? 'Guincho' : 
                                     sr.service_type === 'FRETE_MOTO' ? 'Frete por Moto' : 
                                     sr.service_type === 'MUDANCA' ? 'Mudança' : sr.service_type}
                                  </span>
                                </div>
                                <Badge variant={
                                  sr.status === 'ACCEPTED' ? 'default' :
                                  sr.status === 'ON_THE_WAY' ? 'secondary' : 'outline'
                                }>
                                  {sr.status === 'ACCEPTED' ? 'Aceito' :
                                   sr.status === 'ON_THE_WAY' ? 'A caminho' :
                                   sr.status === 'IN_PROGRESS' ? 'Em progresso' : sr.status}
                                </Badge>
                              </div>
                              
                              <div className="text-sm text-muted-foreground space-y-1 mb-3">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{sr.location_address || sr.city_name}</span>
                                </div>
                                {sr.accepted_at && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>Aceito em {formatDate(sr.accepted_at)}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Dados do prestador */}
                              {sr.provider && (
                                <div className="bg-secondary/50 rounded-lg p-2 flex items-center gap-2">
                                  <Users className="h-4 w-4 text-primary" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{sr.provider.full_name}</p>
                                    {sr.provider.phone && (
                                      <a href={`tel:${sr.provider.phone}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {sr.provider.phone}
                                      </a>
                                    )}
                                  </div>
                                  {sr.provider.rating && (
                                    <div className="flex items-center gap-1">
                                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                      <span className="text-sm font-medium">{sr.provider.rating.toFixed(1)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Fretes em andamento */}
                  {ongoingFreights.length > 0 && (
                    <div className="space-y-3">
                      {ongoingServiceRequests.length > 0 && (
                        <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Fretes em Andamento ({ongoingFreights.length})
                        </h4>
                      )}
                      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                        {ongoingFreights.map((freight) => (
                          <FreightInProgressCard
                            key={freight.id}
                            freight={freight}
                            onViewDetails={() => setSelectedFreightDetails(freight)}
                            onRequestCancel={() => {
                              setFreightToCancel(freight);
                              setConfirmDialogOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="confirm-delivery" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={urgencyFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUrgencyFilter('all')}
                >
                  Todos ({freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length})
                </Button>
                <Button
                  variant={urgencyFilter === 'critical' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setUrgencyFilter('critical')}
                >
                  🚨 Críticos ({freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION' && (f.deliveryDeadline?.hoursRemaining ?? 72) < 6).length})
                </Button>
                <Button
                  variant={urgencyFilter === 'urgent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUrgencyFilter('urgent')}
                  className={urgencyFilter === 'urgent' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                >
                  ⚠️ Urgentes ({freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION' && (f.deliveryDeadline?.hoursRemaining ?? 72) < 24 && (f.deliveryDeadline?.hoursRemaining ?? 72) >= 6).length})
                </Button>
              </div>
            </div>
            
            {freights.filter(f => {
              if (f.status !== 'DELIVERED_PENDING_CONFIRMATION') return false;
              if (urgencyFilter === 'all') return true;
              const hours = f.deliveryDeadline?.hoursRemaining ?? 72;
              if (urgencyFilter === 'critical') return hours < 6;
              if (urgencyFilter === 'urgent') return hours < 24 && hours >= 6;
              return true;
            }).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhuma entrega aguardando confirmação</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    {urgencyFilter === 'all' 
                      ? 'Não há entregas reportadas pelos motoristas aguardando sua confirmação.'
                      : urgencyFilter === 'critical'
                      ? 'Não há entregas críticas (< 6h) aguardando confirmação.'
                      : 'Não há entregas urgentes (< 24h) aguardando confirmação.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                  {freights
                    .filter(f => {
                      if (f.status !== 'DELIVERED_PENDING_CONFIRMATION') return false;
                      if (urgencyFilter === 'all') return true;
                      const hours = f.deliveryDeadline?.hoursRemaining ?? 72;
                      if (urgencyFilter === 'critical') return hours < 6;
                      if (urgencyFilter === 'urgent') return hours < 24 && hours >= 6;
                      return true;
                    })
                    .sort((a, b) => {
                      const deadlineA = a.deliveryDeadline?.hoursRemaining ?? 72;
                      const deadlineB = b.deliveryDeadline?.hoursRemaining ?? 72;
                      return deadlineA - deadlineB; // Mais urgente primeiro
                    })
                    .map((freight) => (
                    <Card key={freight.id} className={`h-full flex flex-col border-amber-200 ${
                      location.state?.highlightFreightId === freight.id 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 shadow-xl animate-pulse border-l-yellow-500' 
                        : 'bg-amber-50/50'
                    } border-l-4 border-l-amber-500`}>
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-2 flex-1 min-w-0">
                            <h4 className="font-semibold text-lg line-clamp-1">
                              {freight.cargo_type}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {freight.origin_address} → {freight.destination_address}
                            </p>
                            
                            {/* 🔥 Indicador de deadline */}
                            {freight.deliveryDeadline && (
                              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                freight.deliveryDeadline.isCritical 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                                  : freight.deliveryDeadline.isUrgent 
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' 
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}>
                                <Clock className="h-3 w-3" />
                                {freight.deliveryDeadline.displayText}
                              </div>
                            )}
                            
                            <p className="text-xs font-medium text-amber-700 mt-2">
                              ⏰ Entrega reportada - Aguardando confirmação
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 space-y-2">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 whitespace-nowrap">
                              Aguardando Confirmação
                            </Badge>
                            <p className="text-lg font-bold text-green-600 whitespace-nowrap">
                              R$ {formatBRL(freight.price)}
                            </p>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="flex flex-col gap-4 h-full pt-0">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-muted-foreground">Motorista:</p>
                            <p className="text-foreground truncate">
                              {freight.profiles?.full_name || 'Aguardando motorista'}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-muted-foreground">Telefone:</p>
                            <p className="text-foreground truncate">
                              {freight.profiles?.contact_phone || '-'}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-muted-foreground">Reportado em:</p>
                            <p className="text-foreground text-xs">
                              {new Date(freight.updated_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-muted-foreground">Prazo confirmação:</p>
                            <p className="text-foreground text-xs">
                              {freight.metadata?.confirmation_deadline 
                                ? new Date(freight.metadata.confirmation_deadline).toLocaleString('pt-BR')
                                : '72h após reportado'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto grid grid-cols-2 gap-3">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setSelectedFreightDetails(freight);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Ver Detalhes
                          </Button>
                          <Button 
                            size="sm" 
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => openDeliveryConfirmationModal(freight)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Confirmar Entrega
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="proposals" className="space-y-4">
            <FreightProposalsManager 
              producerId={profile?.id || ''}
              onProposalAccepted={() => {
                fetchFreights();
                fetchProposals();
              }}
            />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <UnifiedHistory userRole="PRODUTOR" />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <PendingRatingsPanel
              userRole="PRODUTOR"
              userProfileId={profile?.id || ''}
            />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <UnifiedChatHub 
              userProfileId={profile.id}
              userRole="PRODUTOR"
            />
          </TabsContent>


          <TabsContent value="reports" className="space-y-6">
            <ProducerReportsTab />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <ProducerPaymentsTab
              externalPayments={externalPayments}
              freightPayments={freightPayments}
              paymentLoading={paymentLoading}
              onConfirmExternalPayment={handleConfirmExternalPayment}
              onConfirmPaymentMade={confirmPaymentMade}
              onProcessStripePayment={(freightId, amount) => {
                toast.info('Pagamento via Stripe em desenvolvimento');
              }}
              currentUserProfile={profile}
            />
          </TabsContent>

          <TabsContent value="fiscal" className="space-y-4">
            <FiscalTab userRole="PRODUTOR" />
          </TabsContent>

        </Tabs>
      </div>

      <EditFreightModal
        isOpen={editFreightModalOpen}
        onClose={() => setEditFreightModalOpen(false)}
        freight={selectedFreight}
        onSuccess={() => {
          fetchFreights();
          setEditFreightModalOpen(false);
        }}
      />

      <ProposalCounterModal
        isOpen={counterProposalModalOpen}
        onClose={() => setCounterProposalModalOpen(false)}
        originalProposal={selectedProposal}
        freightPrice={selectedProposal?.freight_price || 0}
        freightDistance={selectedProposal?.freight_distance || 0}
        onSuccess={() => {
          fetchProposals();
          setCounterProposalModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmCancelFreight}
        title="Cancelar Frete"
        description="Tem certeza que deseja cancelar este frete? Esta ação não pode ser desfeita."
        confirmText="Sim, cancelar"
        cancelText="Não, manter"
        variant="destructive"
      />

      <Dialog open={!!selectedFreightDetails} onOpenChange={(open) => !open && setSelectedFreightDetails(null)}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto" hideCloseButton>
          <DialogDescription className="sr-only">
            Detalhes completos do frete
          </DialogDescription>
          {selectedFreightDetails && (
            <FreightDetails
              freightId={selectedFreightDetails.id}
              currentUserProfile={profile}
              initialTab={
                (location.state as any)?.openChatFreightId || 
                (location.state as any)?.notificationType === 'chat_message' || 
                (location.state as any)?.notificationType === 'advance_request' 
                  ? 'chat' 
                  : 'status'
              }
              onClose={() => {
                setSelectedFreightDetails(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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
            driver: freightToConfirm.profiles ? {
              full_name: freightToConfirm.profiles.full_name,
              contact_phone: freightToConfirm.profiles.contact_phone || freightToConfirm.profiles.phone
            } : undefined
          }}
          isOpen={deliveryConfirmationModal}
          onClose={closeDeliveryConfirmationModal}
          onConfirm={handleDeliveryConfirmed}
        />
      )}
      
      <ServicesModal 
        isOpen={servicesModalOpen}
        onClose={() => setServicesModalOpen(false)}
      />

      {/* Modal de Avaliação Automática */}
      {activeFreightForRating && (
        <AutoRatingModal
          isOpen={true}
          onClose={() => setActiveFreightForRating(null)}
          freightId={activeFreightForRating.id}
          userToRate={
            activeFreightForRating.driver
              ? {
                  id: activeFreightForRating.driver.id,
                  full_name: activeFreightForRating.driver.full_name,
                  role: 'MOTORISTA' as const
                }
              : null
          }
          currentUserProfile={profile}
        />
      )}
    </div>
  );
};

export default ProducerDashboard;