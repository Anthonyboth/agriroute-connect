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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { getProposalStatusLabel, getFreightStatusLabel } from '@/lib/freight-status';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';
import { toast } from 'sonner';
import { MapPin, TrendingUp, Truck, Clock, CheckCircle, Plus, Settings, Play, DollarSign, Package, Calendar, Eye, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import heroLogistics from '@/assets/hero-logistics.jpg';

const ProducerDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
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

  // Buscar fretes - otimizado
  const fetchFreights = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setFreights(data || []);
    } catch (error) {
      console.error('Error fetching freights:', error);
      toast.error('Erro ao carregar fretes');
    }
  }, [profile?.id]);

  // Buscar propostas - otimizado
  const fetchProposals = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(*),
          driver:profiles!freight_proposals_driver_id_fkey(*)
        `)
        .eq('freight.producer_id', profile.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Erro ao carregar propostas');
    }
  }, [profile?.id]);

  // Carregar dados - otimizado
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id) return;

      setLoading(true);
      await Promise.all([
        fetchFreights(), 
        fetchProposals()
      ]);
      setLoading(false);
    };

    loadData();
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

      // Atualiza o status do frete para não aparecer mais para motoristas
      if (proposal?.freight?.id) {
        const { error: freightError } = await supabase
          .from('freights')
          .update({ status: 'IN_NEGOTIATION' })
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
      activeFreights: freights.filter(f => ['IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT'].includes(f.status)).length,
      completedFreights: freights.filter(f => f.status === 'DELIVERED').length,
      totalValue: freights.reduce((sum, f) => sum + f.price, 0),
      pendingProposals: proposals.length
    };
  }, [freights, proposals]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Erro ao fazer logout');
    } else {
      navigate('/auth');
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
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
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

      <div className="container max-w-7xl mx-auto py-4 px-4">
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

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                <div className="ml-2 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    Completos
                  </p>
                  <p className="text-lg font-bold">{statistics.completedFreights}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                value="proposals" 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Propostas</span>
                <span className="sm:hidden">Props</span>
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
            
            {freights.filter(f => ['IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT'].includes(f.status)).length === 0 ? (
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
              <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">{freights.filter(f => ['IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT'].includes(f.status)).map((freight) => (
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
                    </CardContent>
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
    </div>
  );
};

export default ProducerDashboard;