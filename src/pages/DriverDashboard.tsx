import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import { VehicleManager } from '@/components/VehicleManager';
import { FreightDetails } from '@/components/FreightDetails';
import { DriverAvailabilityCalendar } from '@/components/DriverAvailabilityCalendar';
import DriverServiceAreasManager from '@/components/DriverServiceAreasManager';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SmartFreightMatcher } from '@/components/SmartFreightMatcher';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
import { AdvancedFreightSearch } from '@/components/AdvancedFreightSearch';
import { ServiceProviderDashboard } from '@/components/ServiceProviderDashboard';
import { DriverPayouts } from '@/components/DriverPayouts';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import FreightCheckinModal from '@/components/FreightCheckinModal';
import FreightCheckinsViewer from '@/components/FreightCheckinsViewer';
import FreightWithdrawalModal from '@/components/FreightWithdrawalModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Brain, Settings, Play, DollarSign, Package, Calendar, Eye, EyeOff, X, Banknote } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ServiceRegionSelector } from '@/components/ServiceRegionSelector';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import heroLogistics from '@/assets/hero-logistics.jpg';
import UnifiedLocationManager from '@/components/UnifiedLocationManager';

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
  const navigate = useNavigate();

  // Redirect service providers to their correct dashboard
  React.useEffect(() => {
    if (profile?.role === 'PRESTADOR_SERVICOS') {
      navigate('/dashboard/service-provider', { replace: true });
      return;
    }
    if (profile?.role && profile.role !== 'MOTORISTA') {
      const correctRoute = profile.role === 'PRODUTOR' ? '/dashboard/producer' : 
                          profile.role === 'ADMIN' ? '/admin' : '/';
      navigate(correctRoute, { replace: true });
      return;
    }
  }, [profile?.role, navigate]);
  const [availableFreights, setAvailableFreights] = useState<Freight[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [counterOffers, setCounterOffers] = useState<any[]>([]);
  const [ongoingFreights, setOngoingFreights] = useState<Freight[]>([]);
  const [activeTab, setActiveTab] = useState('available');
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEarnings, setShowEarnings] = useState(true);
const [showCheckinModal, setShowCheckinModal] = useState(false);
const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
const [initialCheckinType, setInitialCheckinType] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<Freight | null>(null);
const [showRegionModal, setShowRegionModal] = useState(false);
  const [showLocationManager, setShowLocationManager] = useState(false);
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
  const [loading, setLoading] = useState(true);

  // Buscar fretes disponíveis - com match inteligente por região
  const fetchAvailableFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      // Refresh matches and get matched freights via Edge Function (same pattern as service provider)
      const { data, error } = await (supabase as any).functions.invoke('driver-spatial-matching', {
        body: { refresh: true }
      });

      if (error) throw error;

      const matches = (data?.matches as any[]) || [];
      const distanceByFreight: Record<string, number> = {};
      for (const m of matches) {
        if (m.freight_id && typeof m.distance_m === 'number') {
          distanceByFreight[m.freight_id] = m.distance_m;
        }
      }

      const freights = ((data?.freights as any[]) || []).map((f: any) => ({
        ...f,
        distance_km: distanceByFreight[f.id]
          ? Math.round(distanceByFreight[f.id] / 10) / 100
          : undefined,
      }));

      freights.sort((a: any, b: any) => {
        const da = distanceByFreight[a.id] ?? Number.POSITIVE_INFINITY;
        const db = distanceByFreight[b.id] ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

      setAvailableFreights(freights);
    } catch (error) {
      console.error('Error fetching available freights (smart match):', error);
      toast.error('Erro ao carregar fretes disponíveis');
    }
  }, [profile?.id, profile?.role]);

  // Buscar propostas do motorista - otimizado
  const fetchMyProposals = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      const { data, error } = await (supabase as any).functions.invoke('driver-proposals');
      if (error) throw error;

      const proposals = (data?.proposals as any[]) || [];
      const ongoing = (data?.ongoingFreights as any[]) || [];
      setMyProposals(proposals);
      setOngoingFreights(ongoing);

      if (ongoing.length > 0) {
        ongoing.forEach(async (freight: any) => {
          try {
            const { count } = await (supabase as any)
              .from('freight_checkins')
              .select('*', { count: 'exact', head: true })
              .eq('freight_id', freight.id)
              .eq('user_id', profile.id);
            setFreightCheckins(prev => ({ ...prev, [freight.id]: count || 0 }));
          } catch (err) {
            console.error('Error checking freight checkins for freight:', freight.id, err);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Erro ao carregar suas propostas');
    }
  }, [profile?.id, profile?.role]);

  // Buscar fretes em andamento - baseado em propostas aceitas
  const fetchOngoingFreights = useCallback(async () => {
    // Don't fetch if user is not a driver
    if (!profile?.id || profile.role !== 'MOTORISTA') return;

    try {
      // Buscar fretes vinculados ao motorista diretamente (evita políticas com recursão)
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('driver_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setOngoingFreights(data || []);

      // Verificar checkins para cada frete
      if (data && data.length > 0) {
        data.forEach(async (freight) => {
          try {
            const { count } = await (supabase as any)
              .from('freight_checkins')
              .select('*', { count: 'exact', head: true })
              .eq('freight_id', (freight as any).id)
              .eq('user_id', profile.id);
            setFreightCheckins(prev => ({ ...prev, [(freight as any).id]: count || 0 }));
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
      setCounterOffers(data || []);
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

  // Função para buscar total de check-ins do motorista
  const fetchDriverCheckins = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      const { count, error } = await supabase
        .from('freight_checkins' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);
      
      if (error) throw error;
      setTotalCheckins(count || 0);
    } catch (error) {
      console.error('Error fetching checkins count:', error);
      setTotalCheckins(0);
    }
  }, [profile?.id]);

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
      if (!profile?.id) return;
      
      setLoading(true);
      await Promise.all([
        fetchAvailableFreights(), 
        fetchMyProposals(), 
        fetchOngoingFreights(),
        fetchDriverCheckins()
      ]);
      setLoading(false);
    };

    loadData();
  }, [profile?.id, fetchAvailableFreights, fetchMyProposals, fetchOngoingFreights, fetchDriverCheckins]);

  // Carregar contra-ofertas - debounced para evitar chamadas excessivas
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCounterOffers();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fetchCounterOffers]);

  // Calcular estatísticas - memoizado para performance
  const statistics = useMemo(() => {
    const acceptedProposals = myProposals.filter(p => p.status === 'ACCEPTED');
    
    // Contar fretes ativos baseado nos fretes em andamento (que incluem ACCEPTED, LOADED, IN_TRANSIT)
    const activeStatuses = ['ACCEPTED', 'LOADED', 'IN_TRANSIT'];
    const activeTripsCount = ongoingFreights.filter(freight => 
      activeStatuses.includes(freight.status)
    ).length;
    
    return {
      activeTrips: activeTripsCount,
      completedTrips: acceptedProposals.filter(p => p.freight?.status === 'DELIVERED').length,
      availableCount: availableFreights.length,
      totalEarnings: acceptedProposals
        .filter(p => p.freight?.status === 'DELIVERED')
        .reduce((sum, proposal) => sum + (proposal.proposed_price || 0), 0),
      totalCheckins: totalCheckins
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
        // Verifica se já existe uma proposta processada para evitar voltar para PENDING
        const { data: existing, error: existingError } = await supabase
          .from('freight_proposals')
          .select('status')
          .eq('freight_id', freightId)
          .eq('driver_id', profile.id)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing && existing.status !== 'PENDING') {
          toast.info('Sua proposta já foi processada pelo produtor.');
          return;
        }

        // Impedir múltiplas propostas ativas para o mesmo frete
        const freight = availableFreights.find(f => f.id === freightId);
        if (!freight) return;

        const { data: existing2, error: existingErr2 } = await supabase
          .from('freight_proposals')
          .select('status')
          .eq('freight_id', freightId)
          .eq('driver_id', profile.id)
          .maybeSingle();
        if (existingErr2) throw existingErr2;
        if (existing2 && (existing2.status === 'PENDING' || existing2.status === 'ACCEPTED')) {
          toast.info(existing2.status === 'PENDING' ? 'Você já enviou uma proposta para este frete. Aguarde a resposta.' : 'Sua proposta já foi aceita.');
          return;
        }

        const { error } = await supabase
          .from('freight_proposals')
          .insert({
            freight_id: freightId,
            driver_id: profile.id,
            proposed_price: freight.price,
            status: 'PENDING',
            message: action === 'accept' ? 'Aceito o frete pelo valor anunciado.' : null,
          });

        if (error) throw error;
        
        toast.success(
          action === 'accept' ? 
            (freight.service_type === 'GUINCHO' ? 'Chamado aceito com sucesso!' :
             freight.service_type === 'MUDANCA' ? 'Orçamento enviado com sucesso!' :
             'Frete aceito com sucesso!') :
            'Proposta enviada com sucesso!'
        );
        fetchMyProposals(); // Atualizar lista
      }
    } catch (error: any) {
      console.error('Error handling freight action:', error);
      toast.error('Erro ao processar ação: ' + (error.message || 'Tente novamente'));
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

      // Atualizar o frete para voltar ao status OPEN
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

      // Registrar a taxa de desistência (futuramente pode ser integrada com sistema de pagamento)
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: profile.id,
          title: 'Taxa de Desistência',
          message: 'Foi aplicada uma taxa de R$ 20,00 pela desistência do frete. O valor será descontado do próximo pagamento.',
          type: 'warning',
          data: {
            freight_id: freightId,
            fee_amount: 20.00,
            fee_type: 'withdrawal'
          }
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
      }

      toast.success('Desistência processada. Taxa de R$ 20 será cobrada.');
      
      // Atualizar as listas
      fetchOngoingFreights();
      fetchMyProposals();
      
    } catch (error: any) {
      console.error('Error processing freight withdrawal:', error);
      toast.error('Erro ao processar desistência: ' + (error.message || 'Tente novamente'));
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
      toast.error('Erro ao cancelar frete: ' + (error.message || 'Tente novamente'));
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
        user={{ name: profile?.full_name || 'Motorista', role: 'MOTORISTA' }}
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
              Olá, {profile?.full_name?.split(' ')[0] || 'Motorista'}
            </h1>
            <p className="text-sm md:text-base mb-4 opacity-90">
              Sistema IA encontra fretes para você
            </p>
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
              
              <Dialog open={showRegionModal} onOpenChange={setShowRegionModal}>
                <DialogTrigger asChild>
                  <Button 
                    variant="default"
                    size="sm"
                    className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
                  >
                    <MapPin className="mr-1 h-4 w-4" />
                    Configurar Região
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Configurar Região de Atendimento</DialogTitle>
                  </DialogHeader>
                  <ServiceRegionSelector onClose={() => setShowRegionModal(false)} />
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="default"
                size="sm"
                onClick={() => setActiveTab('services')}
                className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Settings className="mr-1 h-4 w-4" />
                Configurar
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {/* Stats Cards Compactos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <MapPin className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Disponíveis
                  </p>
                  <p className="text-lg font-bold">{statistics.availableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-orange-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Ativas
                  </p>
                  <p className="text-lg font-bold">{statistics.activeTrips}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Check-ins
                  </p>
                  <p className="text-lg font-bold">{statistics.totalCheckins}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  <div className="ml-2 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      Saldo
                    </p>
                    <p className="text-sm font-bold">
                      {showEarnings 
                        ? new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL',
                            notation: 'compact',
                            maximumFractionDigits: 0
                          }).format(statistics.totalEarnings)
                        : '****'
                      }
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEarnings(!showEarnings)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                >
                  {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FreightLimitTracker compacto */}
        <div className="mb-4">
          <FreightLimitTracker />
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
              <TabsTrigger 
                value="advances" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Banknote className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Saldo</span>
                <span className="sm:hidden">Saldo</span>
              </TabsTrigger>
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
          <SubscriptionExpiryNotification />
          
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
            <SmartFreightMatcher onFreightAction={handleFreightAction} />
            
            {/* Fretes disponíveis tradicionais */}
            {availableFreights.length > 0 && (
              <div className="mt-8">
                <h4 className="text-md font-semibold mb-4">Outros Fretes Disponíveis</h4>
                <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                  {availableFreights.map((freight) => (
                    <FreightCard 
                      key={freight.id}
                      freight={{
                        ...freight,
                        status: freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'ACCEPTED' | 'IN_NEGOTIATION' | 'CANCELLED',
                        service_type: (freight.service_type === 'GUINCHO' || 
                                     freight.service_type === 'MUDANCA' || 
                                     freight.service_type === 'CARGA') 
                                    ? freight.service_type as 'GUINCHO' | 'MUDANCA' | 'CARGA'
                                    : undefined
                      }}
                      onAction={(action) => {
                        if (action !== 'edit') {
                          handleFreightAction(freight.id, action);
                        }
                      }}
                      showActions={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-3">
            <div className="flex flex-col space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-semibold">Em Andamento</h3>
                <Badge variant="secondary" className="text-xs">{ongoingFreights.length}</Badge>
              </div>
            </div>
            
            {ongoingFreights.length > 0 ? (
              <div className="space-y-4">
                {ongoingFreights.map((freight) => (
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
                        {(freight.status === 'ACCEPTED' || freight.status === 'LOADING' || freight.status === 'IN_TRANSIT') && (
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
            ) : (
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
            )}
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <div>
              <DriverServiceAreasManager onAreasUpdate={() => {
                fetchAvailableFreights();
                // Também executar matching espacial quando áreas de serviço forem atualizadas
                if (profile?.id) {
                  supabase.functions.invoke('driver-spatial-matching', { method: 'POST' })
                    .then(({ data }) => {
                      if (data?.created > 0) {
                        toast.success(`${data.created} novos matches encontrados com suas novas áreas de atendimento!`);
                      }
                    })
                    .catch(console.warn);
                }
              }} />
            </div>
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Disponibilidade</h3>
              <DriverAvailabilityCalendar />
            </div>
          </TabsContent>

          <TabsContent value="services">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Tipos de Serviços</h3>
                <ServiceTypeManager />
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Prestação de Serviços</h3>
                <p className="text-muted-foreground mb-4">
                  Gerencie suas solicitações como prestador de serviços
                </p>
                <ServiceProviderDashboard />
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
                {myProposals.length} proposta{myProposals.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {myProposals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                {myProposals.map((proposal) => (
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

          <TabsContent value="advances" className="space-y-4">
            <DriverPayouts driverId={profile?.id || ''} />
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Viagens Concluídas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Viagens Concluídas</CardTitle>
                </CardHeader>
                <CardContent>
                  {myProposals.filter(p => p.freight?.status === 'DELIVERED').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhuma viagem concluída ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myProposals.filter(p => p.freight?.status === 'DELIVERED').map((proposal) => (
                        <Card key={proposal.id} className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold">{proposal.freight?.cargo_type}</h4>
                              <Badge className="bg-green-100 text-green-800">Concluída</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {proposal.freight?.origin_address} → {proposal.freight?.destination_address}
                            </p>
                            <div className="flex justify-between text-sm">
                              <span>Valor: R$ {proposal.proposed_price?.toLocaleString()}</span>
                              <span>{proposal.freight?.distance_km} km</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Viagens Canceladas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Viagens Canceladas</CardTitle>
                </CardHeader>
                <CardContent>
                  {myProposals.filter(p => p.freight?.status === 'CANCELLED' || p.status === 'CANCELLED').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhuma viagem cancelada.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myProposals.filter(p => p.freight?.status === 'CANCELLED' || p.status === 'CANCELLED').map((proposal) => (
                        <Card key={proposal.id} className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold">{proposal.freight?.cargo_type}</h4>
                              <Badge variant="destructive">Cancelada</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {proposal.freight?.origin_address} → {proposal.freight?.destination_address}
                            </p>
                            <div className="flex justify-between text-sm">
                              <span>Valor: R$ {proposal.proposed_price?.toLocaleString()}</span>
                              <span>{proposal.freight?.distance_km} km</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
    setShowCheckinModal(false);
    setSelectedFreightForCheckin(null);
    setInitialCheckinType(null);
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
    </div>
  );
};

export default DriverDashboard;