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
import SubscriptionPlans from '@/components/SubscriptionPlans';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Brain, Settings, CreditCard } from 'lucide-react';
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
  freight?: Freight;
  driver?: {
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
  const [activeTab, setActiveTab] = useState('available');
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
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

  // Buscar propostas do motorista ou propostas para fretes do produtor
  const fetchMyProposals = async () => {
    if (!profile?.id) return;

    try {
      let data;
      
      if (profile.role === 'MOTORISTA') {
        // Para motoristas: buscar propostas que ele fez
        const { data: proposalData, error } = await supabase
          .from('freight_proposals')
          .select(`
            *,
            freight:freights(*)
          `)
          .eq('driver_id', profile.id)
          .neq('status', 'REJECTED')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        data = proposalData;
      } else if (profile.role === 'PRODUTOR') {
        // Para produtores: buscar propostas feitas para seus fretes
        const { data: proposalData, error } = await supabase
          .from('freight_proposals')
          .select(`
            *,
            freight:freights(*),
            driver:profiles!freight_proposals_driver_id_fkey(full_name, phone, id)
          `)
          .eq('freight.producer_id', profile.id)
          .neq('status', 'REJECTED')
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        data = proposalData;
      } else {
        return;
      }
      
      console.log('Proposals loaded:', data);
      setMyProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Erro ao carregar propostas');
    }
  };

  // Buscar contra-ofertas dos produtores
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
      await Promise.all([fetchAvailableFreights(), fetchMyProposals()]);
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
    // Implementar menu lateral se necessário
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
              <TabsTrigger 
                value="planos" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CreditCard className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Planos</span>
                <span className="sm:hidden">Plan</span>
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
            <h3 className="text-lg font-semibold">
              {profile?.role === 'MOTORISTA' ? 'Minhas Propostas Ativas' : 'Propostas Recebidas'}
            </h3>
            {myProposals.filter(p => p.freight && !['DELIVERED', 'CANCELLED'].includes(p.freight.status) && p.status !== 'CANCELLED').length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myProposals
                  .filter(p => p.freight && !['DELIVERED', 'CANCELLED'].includes(p.freight.status) && p.status !== 'CANCELLED')
                  .map((proposal) => (
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
                      <div className="mt-2 flex justify-between items-center">
                        <Badge 
                          variant={
                            proposal.status === 'ACCEPTED' ? 'default' :
                            proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                          }
                        >
                          {proposal.status === 'ACCEPTED' ? 'Aceita' :
                           proposal.status === 'PENDING' ? 'Pendente' : 'Rejeitada'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Proposta: R$ {proposal.proposed_price?.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      {/* Mostrar informações do motorista para produtores */}
                      {profile?.role === 'PRODUTOR' && proposal.driver && (
                        <div className="mt-2 p-2 bg-muted rounded">
                          <p className="text-sm font-medium">{proposal.driver.full_name}</p>
                          <p className="text-xs text-muted-foreground">{proposal.driver.phone}</p>
                        </div>
                      )}

                      {proposal.status === 'ACCEPTED' && profile?.role === 'MOTORISTA' && (
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
                        <div className="flex gap-2 mt-2">
                          {profile?.role === 'PRODUTOR' ? (
                            <>
                              <Button 
                                className="flex-1" 
                                size="sm"
                                onClick={() => handleAcceptProposal(proposal.id)}
                              >
                                Aceitar
                              </Button>
                              <Button 
                                variant="outline" 
                                className="flex-1" 
                                size="sm"
                                onClick={() => handleRejectProposal(proposal.id)}
                              >
                                Rejeitar
                              </Button>
                            </>
                          ) : (
                            <Button 
                              variant="destructive" 
                              className="w-full" 
                              size="sm"
                              onClick={() => handleFreightAction(proposal.freight!.id, 'cancel')}
                            >
                              Cancelar Proposta
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {profile?.role === 'MOTORISTA' ? 
                  'Você ainda não fez propostas para fretes' :
                  'Nenhuma proposta recebida ainda'
                }
              </p>
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

          <TabsContent value="planos" className="space-y-4">
            <SubscriptionPlans />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DriverDashboard;