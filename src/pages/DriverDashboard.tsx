import React, { useState, useEffect } from 'react';
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

  // Buscar fretes disponíveis
  const fetchAvailableFreights = async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableFreights(data || []);
    } catch (error) {
      console.error('Error fetching freights:', error);
      toast.error('Erro ao carregar fretes disponíveis');
    }
  };

  // Buscar propostas do motorista
  const fetchMyProposals = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(*)
        `)
        .eq('driver_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Proposals loaded for driver:', data);
      setMyProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Erro ao carregar suas propostas');
    }
  };

  // Buscar fretes em andamento (aceitos pelo motorista)
  const fetchOngoingFreights = async () => {
    if (!profile?.id) return;

    try {
      // 1) Fretes já vinculados ao motorista (fonte principal)
      const { data: directFreights, error: freightsError } = await supabase
        .from('freights')
        .select('*')
        .eq('driver_id', profile.id)
        .in('status', ['ACCEPTED', 'IN_TRANSIT'])
        .order('updated_at', { ascending: false });

      if (freightsError) throw freightsError;

      let merged: Freight[] = directFreights || [];

      // 2) Fallback: propostas ACEITAS do motorista (cobre casos antigos sem sincronização)
      const { data: acceptedProposals, error: acceptedErr } = await supabase
        .from('freight_proposals')
        .select('freight_id')
        .eq('driver_id', profile.id)
        .eq('status', 'ACCEPTED');

      if (acceptedErr) throw acceptedErr;

      const acceptedIds = (acceptedProposals || []).map(p => p.freight_id);
      const missingIds = acceptedIds.filter(
        (id) => !merged.some((f) => f.id === id)
      );

      if (missingIds.length > 0) {
        const { data: missingFreights, error: missingErr } = await supabase
          .from('freights')
          .select('*')
          .in('id', missingIds);
        if (missingErr) throw missingErr;

        // filtra apenas status relevantes
        const relevant = (missingFreights || []).filter((f) =>
          ['ACCEPTED', 'IN_TRANSIT'].includes(String(f.status))
        );
        merged = [...merged, ...relevant];
      }

      setOngoingFreights(merged);
    } catch (error) {
      console.error('Error fetching ongoing freights:', error);
      toast.error('Erro ao carregar fretes em andamento');
    }
  };
  const fetchCounterOffers = async () => {
    if (!profile?.id) return;

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCounterOffers(data || []);
    } catch (error) {
      console.error('Error fetching counter offers:', error);
    }
  };

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

  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAvailableFreights(), 
        fetchMyProposals(), 
        fetchOngoingFreights()
      ]);
      setLoading(false);
    };

    if (profile) {
      loadData();
    }
  }, [profile]);

  // Carregar contra-ofertas quando as propostas mudarem
  useEffect(() => {
    if (myProposals.length > 0) {
      fetchCounterOffers();
    }
  }, [myProposals]);

  // Calcular estatísticas
  const acceptedProposals = myProposals.filter(p => p.status === 'ACCEPTED');
  const activeTrips = acceptedProposals.filter(p => p.freight?.status === 'IN_TRANSIT').length;
  const completedTrips = acceptedProposals.filter(p => p.freight?.status === 'DELIVERED').length;
  const availableCount = availableFreights.length;
  const totalEarnings = acceptedProposals
    .filter(p => p.freight?.status === 'DELIVERED')
    .reduce((sum, proposal) => sum + (proposal.proposed_price || 0), 0);

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

      {/* Hero Section */}
      <section className="relative min-h-[320px] md:min-h-[360px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroLogistics})` }}
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4">
              Olá, {profile?.full_name || 'Motorista'}
            </h1>
            <p className="text-base md:text-xl mb-5 md:mb-6 opacity-90">
              Sistema IA encontra fretes compatíveis com seus serviços automaticamente
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
              <Button 
                variant="default"
                size="lg"
                onClick={() => setActiveTab('available')}
                className="bg-background text-primary hover:bg-background/90 font-semibold rounded-full px-6 md:px-8 py-5 md:py-6 shadow-elegant"
              >
                <Brain className="mr-2 h-5 w-5" />
                Ver Fretes IA
              </Button>
              <Button 
                variant="default"
                size="lg"
                onClick={() => setActiveTab('services')}
                className="bg-background text-primary hover:bg-background/90 font-semibold rounded-full px-6 md:px-8 py-5 md:py-6 shadow-elegant"
              >
                <Settings className="mr-2 h-5 w-5" />
                Configurar Serviços
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <MapPin className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Fretes Disponíveis
                  </p>
                  <p className="text-2xl font-bold">{availableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Viagens Ativas
                  </p>
                  <p className="text-2xl font-bold">{activeTrips}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Concluídas
                  </p>
                  <p className="text-2xl font-bold">{completedTrips}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Ganhos Totais
                  </p>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL',
                      notation: 'compact',
                      maximumFractionDigits: 0
                    }).format(totalEarnings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FreightLimitTracker for drivers */}
        <div className="mb-8">
          <FreightLimitTracker />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto">
            <TabsList className="inline-flex h-12 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger 
                value="available" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Brain className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Fretes IA</span>
                <span className="sm:hidden">IA</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ongoing" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Em Andamento</span>
                <span className="sm:hidden">Ativo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Agendados</span>
                <span className="sm:hidden">Agenda</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calendar" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MapPin className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Disponibilidade</span>
                <span className="sm:hidden">Local</span>
              </TabsTrigger>
              <TabsTrigger 
                value="my-trips" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden">Props</span>
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Settings className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Serviços</span>
                <span className="sm:hidden">Serv</span>
              </TabsTrigger>
              <TabsTrigger 
                value="vehicles" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Truck className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Meus Veículos</span>
                <span className="sm:hidden">Veíc</span>
              </TabsTrigger>
              <TabsTrigger 
                value="historico" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-4 w-4 mr-1 md:mr-2" />
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
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes em Andamento</h3>
              <Badge variant="secondary">{ongoingFreights.length} ativo(s)</Badge>
            </div>
            
            {ongoingFreights.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {ongoingFreights.map((freight) => (
                  <Card key={freight.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Package className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-foreground">
                            {getCargoTypeLabel(freight.cargo_type)}
                          </h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={freight.status === 'ACCEPTED' ? 'secondary' : 'default'}>
                            {freight.status === 'ACCEPTED' ? 'Aceito' : 'Normal'}
                          </Badge>
                          <Badge variant={freight.status === 'ACCEPTED' ? 'secondary' : 'default'}>
                            {freight.status === 'ACCEPTED' ? 'Aguardando Carregamento' : 'Em Trânsito'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Peso e Distância */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          <span>{((freight.weight || 0) / 1000).toFixed(1)}t</span>
                        </div>
                        <div className="flex items-center space-x-1 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{freight.distance_km} km</span>
                        </div>
                      </div>

                      {/* Origem e Destino */}
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">Origem</p>
                          <p className="text-sm text-muted-foreground truncate">{freight.origin_address}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-foreground">Destino</p>
                          <p className="text-sm text-muted-foreground truncate">{freight.destination_address}</p>
                        </div>
                      </div>

                      {/* Datas */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Coleta</span>
                          </div>
                          <p className="font-medium text-foreground">
                            {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Entrega</span>
                          </div>
                          <p className="font-medium text-foreground">
                            {new Date(freight.delivery_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Status e Valor */}
                      <div className="bg-secondary/20 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge variant={freight.status === 'ACCEPTED' ? 'secondary' : 'default'}>
                            {freight.status === 'ACCEPTED' ? 'Aguardando Carregamento' : 'Em Trânsito'}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Valor Acordado:</span>
                          <span className="text-lg font-bold text-primary">
                            R$ {freight.price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                          Min. ANTT: R$ {freight.minimum_antt_price?.toLocaleString('pt-BR')}
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      {freight.status === 'ACCEPTED' && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              setSelectedFreightForCheckin(freight.id);
                              setShowCheckinModal(true);
                            }}
                          >
                            Check-in
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedFreightId(freight.id);
                              setShowDetails(true);
                            }}
                          >
                            Detalhes
                          </Button>
                        </div>
                      )}

                      {/* Check-ins do Frete */}
                      <FreightCheckinsViewer 
                        freightId={freight.id}
                        currentUserProfile={profile}
                        onRefresh={fetchOngoingFreights}
                      />
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

          <TabsContent value="my-trips" className="space-y-4">
            <h3 className="text-lg font-semibold">Minhas Propostas Enviadas</h3>
            {myProposals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      <div className="mt-2 p-3 bg-card border rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Sua Proposta:</span>
                          <span className="text-sm font-semibold">
                            R$ {proposal.proposed_price?.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Status:</span>
                          <Badge 
                            variant={
                              proposal.status === 'ACCEPTED' ? 'default' :
                              proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                            }
                          >
                            {proposal.status === 'ACCEPTED' ? 'Aceita pelo Produtor' :
                             proposal.status === 'PENDING' ? 'Aguardando Resposta' : 
                             proposal.status === 'REJECTED' ? 'Rejeitada pelo Produtor' :
                             proposal.status === 'CANCELLED' ? 'Cancelada por Você' : proposal.status}
                          </Badge>
                        </div>

                        {/* Informações do produtor */}
                        {proposal.producer && (
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground">Produtor:</p>
                            <p className="text-sm font-medium">{proposal.producer.full_name}</p>
                            {proposal.producer.phone && (
                              <p className="text-xs text-muted-foreground">{proposal.producer.phone}</p>
                            )}
                          </div>
                        )}

                        {/* Data da proposta */}
                        <div className="pt-1">
                          <p className="text-xs text-muted-foreground">
                            Enviada em: {new Date(proposal.created_at).toLocaleDateString('pt-BR')} às {new Date(proposal.created_at).toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {/* Ações baseadas no status */}
                      {proposal.status === 'ACCEPTED' && (
                        <Button 
                          className="w-full mt-2" 
                          size="sm"
                          onClick={() => {
                            setSelectedFreightId(proposal.freight!.id);
                            setShowDetails(true);
                          }}
                        >
                          Gerenciar Frete
                        </Button>
                      )}
                      
                      {proposal.status === 'PENDING' && (
                        <Button 
                          variant="outline" 
                          className="w-full mt-2" 
                          size="sm"
                          onClick={() => handleFreightAction(proposal.freight!.id, 'cancel')}
                        >
                          Cancelar Proposta
                        </Button>
                      )}

                      {proposal.status === 'REJECTED' && (
                        <div className="mt-2">
                          <p className="text-xs text-center text-muted-foreground">
                            Proposta rejeitada. Você pode fazer uma nova proposta.
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
    </div>
  );
};

export default DriverDashboard;