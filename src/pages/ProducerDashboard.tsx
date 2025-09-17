import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import FreightCard from '@/components/FreightCard';
import CreateFreightModal from '@/components/CreateFreightModal';
import { ScheduledFreightsManager } from '@/components/ScheduledFreightsManager';
import { SubscriptionExpiryNotification } from '@/components/SubscriptionExpiryNotification';
import { ProposalCounterModal } from '@/components/ProposalCounterModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProducerDashboard = () => {
  const { profile, hasMultipleProfiles, signOut } = useAuth();
  const [freights, setFreights] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterProposalModalOpen, setCounterProposalModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      fetchFreights();
      fetchProposals();
    }
  }, [profile]);

  const fetchFreights = async () => {
    try {
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('producer_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFreights(data || []);
    } catch (error) {
      console.error('Error fetching freights:', error);
      toast.error('Erro ao carregar fretes');
    } finally {
      setLoading(false);
    }
  };

  const fetchProposals = async () => {
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      toast.error('Erro ao carregar propostas');
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
      fetchProposals();
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
      fetchProposals();
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      toast.error('Erro ao rejeitar proposta');
    }
  };

  const openCounterProposalModal = (proposal: any) => {
    setSelectedProposal({
      id: proposal.freight?.id,
      proposed_price: proposal.proposed_price,
      message: proposal.message,
      driver_name: proposal.driver?.full_name || 'Motorista'
    });
    setCounterProposalModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const openFreights = freights.filter(f => f.status === 'OPEN').length;
  const activeFreights = freights.filter(f => ['IN_NEGOTIATION', 'ACCEPTED', 'IN_TRANSIT'].includes(f.status)).length;
  const completedFreights = freights.filter(f => f.status === 'DELIVERED').length;
  const totalValue = freights.reduce((sum, f) => sum + f.price, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{ name: profile?.full_name || 'Usuário', role: (profile?.role as 'PRODUTOR' | 'MOTORISTA') || 'PRODUTOR' }}
        onLogout={signOut}
        onMenuClick={() => {}}
        userProfile={profile}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Notificação de assinatura */}
        <SubscriptionExpiryNotification />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard do Produtor</h1>
          <p className="text-muted-foreground">Gerencie seus fretes e acompanhe o desempenho</p>
        </div>

        <Tabs defaultValue="fretes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fretes">Fretes Imediatos</TabsTrigger>
            <TabsTrigger value="propostas">Propostas Recebidas</TabsTrigger>
            <TabsTrigger value="agendados">Fretes Agendados</TabsTrigger>
          </TabsList>

          <TabsContent value="fretes" className="space-y-6">
            <div className="mb-6">
              <div className="flex justify-end">
                <CreateFreightModal 
                  onFreightCreated={fetchFreights}
                  userProfile={profile}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Meus Fretes</CardTitle>
              </CardHeader>
              <CardContent>
                {freights.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhum frete cadastrado ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {freights.map((freight) => (
                      <FreightCard
                        key={freight.id}
                        freight={{
                          id: freight.id,
                          cargo_type: freight.cargo_type,
                          weight: freight.weight,
                          distance_km: freight.distance_km,
                          origin_address: freight.origin_address,
                          destination_address: freight.destination_address,
                          price: freight.price,
                          status: freight.status,
                          pickup_date: freight.pickup_date,
                          delivery_date: freight.delivery_date,
                          urgency: freight.urgency,
                          minimum_antt_price: freight.minimum_antt_price || 0
                        }}
                        onAction={() => {}}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="propostas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Propostas Recebidas</CardTitle>
              </CardHeader>
              <CardContent>
                {proposals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhuma proposta recebida ainda.</p>
                  </div>
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
                              {proposal.status === 'ACCEPTED' ? 'Aceita' :
                               proposal.status === 'PENDING' ? 'Pendente' : 'Rejeitada'}
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
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agendados">
            <ScheduledFreightsManager />
          </TabsContent>
        </Tabs>
      </div>

      <ProposalCounterModal
        isOpen={counterProposalModalOpen}
        onClose={() => setCounterProposalModalOpen(false)}
        originalProposal={selectedProposal}
        freightPrice={selectedProposal?.freight?.price || 0}
        onSuccess={() => {
          fetchProposals();
          setCounterProposalModalOpen(false);
        }}
      />
    </div>
  );
};

export default ProducerDashboard;