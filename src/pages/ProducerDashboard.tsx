import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightCard } from '@/components/FreightCard';
import CreateFreightModal from '@/components/CreateFreightModal';
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
import { PaymentDeadlineAlert } from '@/components/PaymentDeadlineAlert';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { getProposalStatusLabel, getFreightStatusLabel } from '@/lib/freight-status';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Plus, Settings, Play, DollarSign, Package, Calendar, Eye, Users, Phone, CreditCard, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import heroLogistics from '@/assets/hero-logistics.jpg';

const ProducerDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

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
  const [deliveryConfirmationModal, setDeliveryConfirmationModal] = useState(false);
  const [freightToConfirm, setFreightToConfirm] = useState<any>(null);

  // Buscar fretes - otimizado
  const fetchFreights = useCallback(async () => {
    // Don't fetch if user is not a producer
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchFreights: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchFreights: Iniciando busca para produtor ID:', profile.id);

    try {
      const { data, error } = await supabase
        .from('freights')
        .select(`
          *,
          driver_profiles:profiles!freights_driver_id_fkey(*)
        `)
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      console.log('fetchFreights: Resposta da query:', { data, error, count: data?.length });
      
      if (error) {
        console.error('fetchFreights: Erro na query:', error);
        throw error;
      }
      
      const freightData = data || [];
      console.log('fetchFreights: Fretes encontrados por status:', {
        OPEN: freightData.filter(f => f.status === 'OPEN').length,
        ACCEPTED: freightData.filter(f => f.status === 'ACCEPTED').length,
        IN_TRANSIT: freightData.filter(f => f.status === 'IN_TRANSIT').length,
        DELIVERED_PENDING_CONFIRMATION: freightData.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length,
        DELIVERED: freightData.filter(f => f.status === 'DELIVERED').length,
        total: freightData.length,
        allStatuses: freightData.map(f => f.status)
      });
      
      setFreights(freightData);
    } catch (error) {
      console.error('fetchFreights: Error:', error);
      toast.error('Erro ao carregar fretes');
    }
  }, [profile?.id, profile?.role]);

  // Buscar propostas - otimizado
  const fetchProposals = useCallback(async () => {
    // Don't fetch if user is not a producer
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('fetchProposals: Não executando - Profile não é produtor:', profile);
      return;
    }

    console.log('fetchProposals: Iniciando busca para produtor ID:', profile.id);

    try {
      // First get freight IDs for this producer
      const { data: producerFreights, error: freightError } = await supabase
        .from('freights')
        .select('id')
        .eq('producer_id', profile.id);

      console.log('fetchProposals: Fretes do produtor:', { producerFreights, freightError });

      if (freightError) throw freightError;

      if (!producerFreights || producerFreights.length === 0) {
        console.log('fetchProposals: Nenhum frete encontrado para o produtor');
        setProposals([]);
        return;
      }

      const freightIds = producerFreights.map(f => f.id);
      console.log('fetchProposals: IDs dos fretes:', freightIds);

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

      console.log('fetchProposals: Resposta da query de propostas:', { data, error, count: data?.length });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('fetchProposals: Error:', error);
      toast.error('Erro ao carregar propostas');
    }
  }, [profile?.id, profile?.role]);

  // Carregar dados - otimizado
  useEffect(() => {
    console.log('useEffect loadData executado. Profile:', profile);
    
    const loadData = async () => {
      // Forçar execução mesmo sem profile para debug
      console.log('loadData: Forçando execução. Profile disponível:', !!profile?.id, 'Role:', profile?.role);
      
      if (!profile?.id) {
        console.log('loadData: Profile não está disponível ainda, aguardando...');
        return;
      }

      if (profile.role !== 'PRODUTOR') {
        console.log('loadData: Usuário não é produtor, role:', profile.role);
        return;
      }

      console.log('loadData: Executando fetchFreights e fetchProposals para:', profile.id);
      setLoading(true);
      
      try {
        // Executar as funções
        await fetchFreights();
        await fetchProposals();
      } catch (error) {
        console.error('loadData: Erro no carregamento:', error);
      } finally {
        setLoading(false);
      }
    };

    // Executar imediatamente se profile estiver disponível
    if (profile?.id && profile?.role === 'PRODUTOR') {
      console.log('loadData: Profile disponível, executando imediatamente');
      loadData();
    }
  }, [profile?.id, profile?.role, fetchFreights, fetchProposals]);

  // Atualização em tempo real
  useEffect(() => {
    if (!profile?.id) return;
    
    console.log('Configurando realtime para produtor:', profile.id);
    
    const channel = supabase
      .channel('realtime-freights-producer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, (payload) => {
        console.log('Mudança em freights detectada:', payload);
        fetchFreights();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_proposals' }, (payload) => {
        console.log('Mudança em propostas detectada:', payload);
        fetchProposals();
      })
      .subscribe();

    return () => {
      console.log('Removendo canal realtime');
      supabase.removeChannel(channel);
    };
  }, [profile?.id, fetchFreights, fetchProposals]);

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      // Busca a proposta no estado atual para obter o freight_id sem precisar de select().single()
      const proposal = proposals.find(p => p.id === proposalId);

      // Atualiza o status da proposta
      const { error: proposalError } = await supabase
        .from('freight_proposals')
        .update({ status: 'ACCEPTED' })
        .eq('id', proposalId);
      if (proposalError) throw proposalError;

      // Atualiza o status do frete para ACCEPTED e associa o motorista
      if (proposal?.freight?.id) {
        const { error: freightError } = await supabase
          .from('freights')
          .update({ 
            status: 'ACCEPTED',
            driver_id: proposal.driver_id 
          })
          .eq('id', proposal.freight.id)
          .eq('producer_id', profile?.id || '');
        
        if (freightError) throw freightError;
      }

      // Remove a proposta aceita imediatamente do estado local e atualiza lista de fretes
      setProposals(prev => prev.filter(proposal => proposal.id !== proposalId));
      fetchFreights();
      
      toast.success('Proposta aceita com sucesso!');
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

  const handleFreightAction = async (action: 'edit' | 'cancel', freight: any) => {
    if (action === 'edit') {
      setSelectedFreight(freight);
      setEditFreightModalOpen(true);
    } else if (action === 'cancel') {
      setFreightToCancel(freight);
      setConfirmDialogOpen(true);
    }
  };

  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;
    
    try {
      const { error } = await supabase
        .from('freights')
        .update({ status: 'CANCELLED' })
        .eq('id', freightToCancel.id);

      if (error) throw error;

      toast.success('Frete cancelado com sucesso!');
      fetchFreights();
    } catch (error) {
      console.error('Error cancelling freight:', error);
      toast.error('Erro ao cancelar frete');
    }
  };

  // Estatísticas calculadas - memoizadas
  const statistics = useMemo(() => {
    return {
      openFreights: freights.filter(f => f.status === 'OPEN').length,
      activeFreights: freights.filter(f => ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'].includes(f.status)).length,
      pendingConfirmation: freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length,
      totalValue: freights.reduce((sum, f) => sum + f.price, 0),
      pendingProposals: proposals.length
    };
  }, [freights, proposals]);

  const openDeliveryConfirmationModal = (freight: any) => {
    setFreightToConfirm(freight);
    setDeliveryConfirmationModal(true);
  };

  const closeDeliveryConfirmationModal = () => {
    setFreightToConfirm(null);
    setDeliveryConfirmationModal(false);
  };

  const handleDeliveryConfirmed = () => {
    fetchFreights(); // Recarregar dados após confirmação
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
            notes: 'Pagamento obrigatório de 50% do frete'
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/5 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background overflow-x-hidden">
      <Header 
        user={{ name: profile?.full_name || 'Usuário', role: (profile?.role as 'PRODUTOR' | 'MOTORISTA') || 'PRODUTOR' }}
        onLogout={handleLogout}
        onMenuClick={() => {}}
        userProfile={profile}
        notifications={unreadCount}
      />
      
      {/* Hero Section Compacta */}
      <section 
        className="relative py-8 bg-gradient-to-r from-primary/90 via-primary to-primary/90 text-white overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 197, 94, 0.9), rgba(34, 197, 94, 0.95)), url(${heroLogistics})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/60 backdrop-blur-sm"></div>
        <div className="relative container mx-auto px-4 max-w-7xl">
          <div className="text-center space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold">
              Dashboard do Produtor
            </h1>
            <p className="text-primary-foreground/90 max-w-xl mx-auto text-sm md:text-base">
              Gerencie seus fretes, acompanhe propostas e monitore o desempenho
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <CreateFreightModal 
                onFreightCreated={fetchFreights}
                userProfile={profile}
              />
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('proposals')}
                className="bg-background/10 text-white border-white/30 hover:bg-white/20 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
              >
                <Users className="mr-1 h-4 w-4" />
                Ver Propostas
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4 pb-8">
        {/* Stats Cards Compactos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Package className="h-6 w-6 text-blue-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Abertos
                  </p>
                  <p className="text-lg font-bold">{statistics.openFreights}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Play className="h-6 w-6 text-orange-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Andamento
                  </p>
                  <p className="text-lg font-bold">{statistics.activeFreights}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Clock className="h-6 w-6 text-amber-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    P/ Confirmar
                  </p>
                  <p className="text-lg font-bold">{statistics.pendingConfirmation}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <Users className="h-6 w-6 text-purple-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Propostas
                  </p>
                  <p className="text-lg font-bold">{statistics.pendingProposals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Payment Deadline Alerts */}
        {profile && <PaymentDeadlineAlert userId={profile.user_id || ''} />}

        {/* Tabs Compactas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger 
                value="open" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Package className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Fretes Abertos</span>
                <span className="sm:hidden">Abertos</span>
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
                value="confirm-delivery" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Confirmar Entrega</span>
                <span className="sm:hidden">Confirm</span>
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
                <span className="sm:hidden">Propos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="scheduled" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Calendar className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Agendados</span>
                <span className="sm:hidden">Agenda</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
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

          <TabsContent value="open" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes Abertos</h3>
            </div>
            
            {freights.filter(f => f.status === 'OPEN').length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete aberto</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes abertos no momento. Crie um novo frete para começar.
                  </p>
                  <CreateFreightModal 
                    onFreightCreated={fetchFreights}
                    userProfile={profile}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
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
                      accepted_trucks: freight.accepted_trucks || 0
                    }}
                    showProducerActions={true}
                    onAction={(action) => handleFreightAction(action as 'edit' | 'cancel', freight)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes em Andamento</h3>
            </div>
            
            {freights.filter(f => ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'].includes(f.status)).length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Play className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete em andamento</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes em andamento no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">{freights.filter(f => ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'].includes(f.status)).map((freight) => (
                  <Card key={freight.id} className="border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg">{freight.cargo_type}</h3>
                          <p className="text-sm text-muted-foreground">
                            {freight.origin_address} → {freight.destination_address}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                              <Truck className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{(freight.weight / 1000).toFixed(1)}t</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                              <MapPin className="h-4 w-4 text-accent" />
                              <span className="text-sm font-medium">{freight.distance_km}km</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded">
                              <Clock className="h-4 w-4 text-warning" />
                              <span className="text-sm font-medium">
                                {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge variant={freight.status === 'IN_TRANSIT' ? 'default' : 'secondary'} className="font-medium">
                            {getFreightStatusLabel(freight.status)}
                          </Badge>
                          <p className="font-bold text-xl text-primary">R$ {freight.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-6">
                      {/* Informações básicas */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Motorista:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.full_name || 'Aguardando aceite'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Telefone:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.contact_phone || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Data de Coleta:</p>
                          <p className="text-muted-foreground">
                            {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Data de Entrega:</p>
                          <p className="text-muted-foreground">
                            {new Date(freight.delivery_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex gap-3 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => {
                            setSelectedFreightDetails(freight);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        {freight.status === 'IN_NEGOTIATION' && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="flex-1 hover:shadow-lg transition-all duration-300"
                            onClick={() => handleFreightAction('cancel', freight)}
                          >
                            Cancelar Frete
                          </Button>
                        )}
                      </div>

                      {/* Seção de Pagamento */}
                      {(freight.status === 'ACCEPTED' || freight.status === 'IN_TRANSIT' || freight.status === 'LOADING' || freight.status === 'LOADED') && freight.driver_profiles && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-1">
                                ⚠️ Pagamento obrigatório - {freight.cargo_type}
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                Você deve pagar pelo menos 50% do frete até o carregamento (4 dias)
                              </p>
                              <p className="text-xs text-blue-600 dark:text-blue-300">
                                Valor mínimo: R$ {(freight.price * 0.5).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap flex-shrink-0"
                              onClick={() => handlePaymentNotification(freight.id, freight.driver_profiles.id, freight.price)}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              Pagar Agora
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="confirm-delivery" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
            </div>
            
            {freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhuma entrega aguardando confirmação</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Não há entregas reportadas pelos motoristas aguardando sua confirmação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {freights.filter(f => f.status === 'DELIVERED_PENDING_CONFIRMATION').map((freight) => (
                  <Card key={freight.id} className="p-4 border-amber-200 bg-amber-50/50">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg">
                            {freight.cargo_type}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {freight.origin_address} → {freight.destination_address}
                          </p>
                          <p className="text-sm font-medium text-amber-700 mt-2">
                            ⏰ Entrega reportada pelo motorista - Aguardando sua confirmação
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                            Aguardando Confirmação
                          </Badge>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            R$ {freight.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Motorista:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.full_name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Telefone:</p>
                          <p className="text-muted-foreground">
                            {freight.driver_profiles?.contact_phone || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Reportado em:</p>
                          <p className="text-muted-foreground">
                            {new Date(freight.updated_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">Prazo para confirmação:</p>
                          <p className="text-muted-foreground">
                            {freight.metadata?.confirmation_deadline 
                              ? new Date(freight.metadata.confirmation_deadline).toLocaleString('pt-BR')
                              : '72h após reportado'
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setSelectedFreightDetails(freight);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => openDeliveryConfirmationModal(freight)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Entrega
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="proposals" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Propostas Recebidas</h3>
            </div>
            
            {proposals.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhuma proposta recebida</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Ainda não há propostas para seus fretes. Aguarde os motoristas interessados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {proposals.map((proposal) => (
                  <Card key={proposal.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">
                            Proposta de {proposal.driver?.full_name || 'Motorista'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Frete: {proposal.freight?.cargo_type} - {proposal.freight?.origin_address} → {proposal.freight?.destination_address}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            proposal.status === 'ACCEPTED' ? 'default' :
                            proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                          }
                        >
                          {getProposalStatusLabel(proposal.status)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Valor original:</p>
                          <p>R$ {proposal.freight?.price?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="font-medium">Valor proposto:</p>
                          <p>R$ {proposal.proposed_price?.toLocaleString()}</p>
                        </div>
                      </div>

                      {proposal.message && (
                        <div className="border-t pt-3">
                          <p className="font-medium text-sm">Mensagem:</p>
                          <p className="text-sm text-muted-foreground">{proposal.message}</p>
                        </div>
                      )}

                      {proposal.status === 'PENDING' && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleAcceptProposal(proposal.id)}
                            className="gradient-primary"
                          >
                            Aceitar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => openCounterProposalModal(proposal)}
                          >
                            Contra Proposta
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRejectProposal(proposal.id)}
                          >
                            Rejeitar
                          </Button>
                        </div>
                      )}
                      {proposal.status === 'ACCEPTED' && (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleCancelProposal(proposal.id)}
                          >
                            Cancelar Aceite
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fretes Concluídos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Fretes Concluídos</CardTitle>
                </CardHeader>
                <CardContent>
                  {freights.filter(f => f.status === 'DELIVERED').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhum frete concluído ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {freights.filter(f => f.status === 'DELIVERED').map((freight) => (
                        <FreightCard
                          key={freight.id}
                          freight={{
                            id: freight.id,
                            cargo_type: freight.cargo_type,
                            weight: (freight.weight / 1000), // Convert kg to tonnes
                            distance_km: freight.distance_km,
                            origin_address: freight.origin_address,
                            destination_address: freight.destination_address,
                            price: freight.price,
                            status: freight.status,
                            pickup_date: freight.pickup_date,
                            delivery_date: freight.delivery_date,
                            urgency: freight.urgency,
                            minimum_antt_price: freight.minimum_antt_price || 0,
                            required_trucks: freight.required_trucks || 1,
                            accepted_trucks: freight.accepted_trucks || 0
                          }}
                          showProducerActions={false}
                          onAction={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fretes Cancelados */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Fretes Cancelados</CardTitle>
                </CardHeader>
                <CardContent>
                  {freights.filter(f => f.status === 'CANCELLED').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Nenhum frete cancelado.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {freights.filter(f => f.status === 'CANCELLED').map((freight) => (
                        <FreightCard
                          key={freight.id}
                          freight={{
                            id: freight.id,
                            cargo_type: freight.cargo_type,
                            weight: (freight.weight / 1000), // Convert kg to tonnes
                            distance_km: freight.distance_km,
                            origin_address: freight.origin_address,
                            destination_address: freight.destination_address,
                            price: freight.price,
                            status: freight.status,
                            pickup_date: freight.pickup_date,
                            delivery_date: freight.delivery_date,
                            urgency: freight.urgency,
                            minimum_antt_price: freight.minimum_antt_price || 0,
                            required_trucks: freight.required_trucks || 1,
                            accepted_trucks: freight.accepted_trucks || 0
                          }}
                          showProducerActions={false}
                          onAction={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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

      <Dialog open={!!selectedFreightDetails} onOpenChange={() => {}}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto" hideCloseButton>
          {selectedFreightDetails && (
            <FreightDetails
              freightId={selectedFreightDetails.id}
              currentUserProfile={profile}
              onClose={() => {
                setSelectedFreightDetails(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {freightToConfirm && (
        <DeliveryConfirmationModal
          freight={freightToConfirm}
          isOpen={deliveryConfirmationModal}
          onClose={closeDeliveryConfirmationModal}
          onConfirm={handleDeliveryConfirmed}
        />
      )}
    </div>
  );
};

export default ProducerDashboard;