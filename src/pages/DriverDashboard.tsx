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
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SmartFreightMatcher } from '@/components/SmartFreightMatcher';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
import { AdvancedFreightSearch } from '@/components/AdvancedFreightSearch';
import { ServiceProviderDashboard } from '@/components/ServiceProviderDashboard';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import FreightCheckinModal from '@/components/FreightCheckinModal';
import FreightCheckinsViewer from '@/components/FreightCheckinsViewer';
import FreightWithdrawalModal from '@/components/FreightWithdrawalModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Brain, Settings, Play, DollarSign, Package, Calendar } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import heroLogistics from '@/assets/hero-logistics.jpg';

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
  const navigate = useNavigate();
  const [availableFreights, setAvailableFreights] = useState<Freight[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [counterOffers, setCounterOffers] = useState<any[]>([]);
  const [ongoingFreights, setOngoingFreights] = useState<Freight[]>([]);
  const [activeTab, setActiveTab] = useState('available');
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedFreightForCheckin, setSelectedFreightForCheckin] = useState<string | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedFreightForWithdrawal, setSelectedFreightForWithdrawal] = useState<Freight | null>(null);
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

  // Buscar fretes disponíveis - otimizado
  const fetchAvailableFreights = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(50); // Limitar para melhor performance

      if (error) throw error;
      setAvailableFreights(data || []);
    } catch (error) {
      toast.error('Erro ao carregar fretes disponíveis');
    }
  }, []);

  // Buscar propostas do motorista - otimizado
  const fetchMyProposals = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(
            *,
            producer:profiles!producer_id(
              id,
              full_name,
              contact_phone,
              role
            )
          )
        `)
        .eq('driver_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100); // Limitar consulta

      if (error) throw error;
      setMyProposals(data || []);
    } catch (error) {
      toast.error('Erro ao carregar suas propostas');
    }
  }, [profile?.id]);

  // Buscar fretes em andamento - baseado em propostas aceitas
  const fetchOngoingFreights = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Buscar propostas aceitas do motorista
      const { data: acceptedProposals, error: proposalsError } = await supabase
        .from('freight_proposals')
        .select('freight_id')
        .eq('driver_id', profile.id)
        .eq('status', 'ACCEPTED');

      if (proposalsError) throw proposalsError;

      if (!acceptedProposals || acceptedProposals.length === 0) {
        setOngoingFreights([]);
        return;
      }

      const freightIds = acceptedProposals.map(p => p.freight_id);

      // Buscar os fretes correspondentes
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .in('id', freightIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setOngoingFreights(data || []);
    } catch (error) {
      console.error('Error fetching ongoing freights:', error);
      toast.error('Erro ao carregar fretes em andamento');
    }
  }, [profile?.id]);
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

  // Carregar dados - otimizado
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;
      
      setLoading(true);
      await Promise.all([
        fetchAvailableFreights(), 
        fetchMyProposals(), 
        fetchOngoingFreights()
      ]);
      setLoading(false);
    };

    loadData();
  }, [profile?.id, fetchAvailableFreights, fetchMyProposals, fetchOngoingFreights]);

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
    return {
      activeTrips: acceptedProposals.filter(p => p.freight?.status === 'IN_TRANSIT').length,
      completedTrips: acceptedProposals.filter(p => p.freight?.status === 'DELIVERED').length,
      availableCount: availableFreights.length,
      totalEarnings: acceptedProposals
        .filter(p => p.freight?.status === 'DELIVERED')
        .reduce((sum, proposal) => sum + (proposal.proposed_price || 0), 0)
    };
  }, [myProposals, availableFreights]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Erro ao fazer logout');
    } else {
      toast.success('Logout realizado com sucesso');
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

        // Usar upsert para evitar erro de constraint única
        const freight = availableFreights.find(f => f.id === freightId);
        if (!freight) return;

        const { error } = await supabase
          .from('freight_proposals')
          .upsert({
            freight_id: freightId,
            driver_id: profile.id,
            proposed_price: freight.price,
            status: 'PENDING',
            message: action === 'accept' ? 'Aceito o frete pelo valor anunciado.' : null,
          }, {
            onConflict: 'freight_id,driver_id'
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
                    Completas
                  </p>
                  <p className="text-lg font-bold">{statistics.completedTrips}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <TrendingUp className="h-6 w-6 text-blue-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Ganhos
                  </p>
                  <p className="text-sm font-bold">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL',
                      notation: 'compact',
                      maximumFractionDigits: 0
                    }).format(statistics.totalEarnings)}
                  </p>
                </div>
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
                <span className="hidden sm:inline">Disponibilidade</span>
                <span className="sm:hidden">Local</span>
              </TabsTrigger>
              <TabsTrigger 
                value="my-trips" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden">Props</span>
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
                  <Card key={freight.id} className="shadow-sm border border-border/50">
                    <CardHeader className="pb-3 px-4 pt-4">
                      <div className="flex items-center justify-between">
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
                    </CardHeader>

                    <CardContent className="space-y-3 px-4 pb-4">
                      {/* Informações Compactas */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center space-x-1 text-muted-foreground bg-muted/30 p-2 rounded">
                          <Package className="h-3 w-3" />
                          <span>{((freight.weight || 0) / 1000).toFixed(1)}t</span>
                        </div>
                        <div className="flex items-center space-x-1 text-muted-foreground bg-muted/30 p-2 rounded">
                          <MapPin className="h-3 w-3" />
                          <span>{freight.distance_km} km</span>
                        </div>
                      </div>

                      {/* Origem e Destino Compactos */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">De:</p>
                            <p className="text-muted-foreground truncate">{freight.origin_address}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-3 w-3 text-accent mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">Para:</p>
                            <p className="text-muted-foreground truncate">{freight.destination_address}</p>
                          </div>
                        </div>
                      </div>

                      {/* Datas Compactas */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded border border-border/30">
                          <div className="flex items-center space-x-1 text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>Coleta</span>
                          </div>
                          <p className="font-medium text-foreground">
                            {new Date(freight.pickup_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                        <div className="p-2 bg-gradient-to-br from-accent/15 to-accent/5 rounded border border-border/30">
                          <div className="flex items-center space-x-1 text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>Entrega</span>
                          </div>
                          <p className="font-medium text-foreground">
                            {new Date(freight.delivery_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Valor e Status */}
                      <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-3 rounded-lg border border-border/40">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-muted-foreground">Valor:</span>
                          <span className="text-sm font-bold text-primary">
                            R$ {freight.price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Min. ANTT: R$ {freight.minimum_antt_price?.toLocaleString('pt-BR')}
                        </div>
                      </div>

                      {/* Botões Compactos */}
                      <div className="flex gap-2">
                        {(freight.status === 'ACCEPTED' || freight.status === 'LOADING') && (
                          <Button 
                            size="sm" 
                            className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90"
                            onClick={() => {
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
                          Detalhes
                        </Button>
                      </div>

                      {/* Check-ins Compactos */}
                      <div className="border-t border-border/30 pt-2">
                        <FreightCheckinsViewer 
                          freightId={freight.id}
                          currentUserProfile={profile}
                          onRefresh={fetchOngoingFreights}
                        />
                      </div>
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

          <TabsContent value="calendar">
            <DriverAvailabilityCalendar />
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
              <div className="grid gap-8 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
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
                      
                      {/* Informações da proposta */}
                      <div className="mt-4 p-4 bg-gradient-to-r from-card to-secondary/10 border rounded-lg shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold">Sua Proposta:</span>
                          <span className="text-lg font-bold text-primary">
                            R$ {proposal.proposed_price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge 
                            variant={
                              proposal.status === 'ACCEPTED' ? 'default' :
                              proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                            }
                            className="font-medium"
                          >
                            {proposal.status === 'ACCEPTED' ? 'Aceita pelo Produtor' :
                             proposal.status === 'PENDING' ? 'Aguardando Resposta' : 
                             proposal.status === 'REJECTED' ? 'Rejeitada pelo Produtor' :
                             proposal.status === 'CANCELLED' ? 'Cancelada por Você' : proposal.status}
                          </Badge>
                        </div>

                        {/* Preço do frete vs proposta */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Valor Original:</span>
                          <span className="text-sm font-semibold">
                            R$ {proposal.freight?.price?.toLocaleString('pt-BR')}
                          </span>
                        </div>

                        {/* Diferença de preço */}
                        {proposal.freight?.price && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Diferença:</span>
                            <span className={`text-sm font-semibold ${
                              proposal.proposed_price > proposal.freight.price ? 'text-red-600' : 
                              proposal.proposed_price < proposal.freight.price ? 'text-green-600' : 'text-muted-foreground'
                            }`}>
                              {proposal.proposed_price > proposal.freight.price ? '+' : 
                               proposal.proposed_price < proposal.freight.price ? '-' : ''}
                              R$ {Math.abs(proposal.proposed_price - proposal.freight.price).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}

                        {/* Mensagem da proposta */}
                        {proposal.message && (
                          <div className="pt-2 border-t border-border/40">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Sua mensagem:</p>
                            <p className="text-sm bg-muted/30 p-2 rounded italic">&quot;{proposal.message}&quot;</p>
                          </div>
                        )}

                        {/* Informações do produtor */}
                        {proposal.freight?.producer && (
                          <div className="pt-3 border-t border-border/40">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Produtor:</p>
                            <p className="text-sm font-semibold">{proposal.freight.producer.full_name}</p>
                            {proposal.freight.producer.contact_phone && (
                              <p className="text-xs text-muted-foreground mt-1">{proposal.freight.producer.contact_phone}</p>
                            )}
                          </div>
                        )}

                        {/* Data da proposta */}
                        <div className="pt-2 border-t border-border/40">
                          <p className="text-xs text-muted-foreground">
                            Enviada em: {new Date(proposal.created_at).toLocaleDateString('pt-BR')} às {new Date(proposal.created_at).toLocaleTimeString('pt-BR')}
                          </p>
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
          }}
          freightId={selectedFreightForCheckin}
          currentUserProfile={profile}
          onCheckinCreated={() => {
            fetchOngoingFreights();
            setShowCheckinModal(false);
            setSelectedFreightForCheckin(null);
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
    </div>
  );
};

export default DriverDashboard;