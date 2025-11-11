import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, DollarSign, Truck, User, MapPin, AlertTriangle, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showErrorToast } from '@/lib/error-handler';

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  message?: string;
  delivery_estimate?: string;
  status: string;
  created_at: string;
  driver?: {
    id: string;
    full_name: string;
    rating?: number;
    total_ratings?: number;
    profile_photo_url?: string;
  };
  freight?: {
    id: string;
    origin_city: string;
    origin_state: string;
    destination_city: string;
    destination_state: string;
    cargo_type: string;
    required_trucks: number;
    accepted_trucks: number;
    minimum_antt_price?: number;
    price: number;
    status: string;
  };
}

interface FreightProposalsManagerProps {
  producerId: string;
  onProposalAccepted?: () => void;
}

export const FreightProposalsManager: React.FC<FreightProposalsManagerProps> = ({
  producerId,
  onProposalAccepted
}) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; proposal: Proposal | null }>({
    open: false,
    proposal: null
  });
  const [accepting, setAccepting] = useState(false);

  const fetchProposals = async () => {
    try {
      // First get freight IDs for this producer
      const { data: producerFreights, error: freightError } = await supabase
        .from('freights')
        .select('id')
        .eq('producer_id', producerId);

      if (freightError) throw freightError;

      if (!producerFreights || producerFreights.length === 0) {
        setProposals([]);
        setLoading(false);
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      showErrorToast(toast, 'Erro ao carregar propostas', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (producerId) {
      fetchProposals();
    }
  }, [producerId]);

  // Real-time updates
  useEffect(() => {
    if (!producerId) return;

    const channel = supabase
      .channel('proposals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freight_proposals' }, () => {
        fetchProposals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [producerId]);

  const handleAcceptProposal = async (proposal: Proposal) => {
    setAccepting(true);
    try {
      console.log('[PROPOSALS-MANAGER] Accepting proposal:', proposal.id);

      const { data, error } = await supabase.functions.invoke('accept-freight-proposal', {
        body: {
          proposal_id: proposal.id,
          producer_id: producerId
        }
      });

      if (error) {
        console.error('[PROPOSALS-MANAGER] Error from edge function:', error);
        const errorMessage = data?.error || error.message || 'Erro ao aceitar proposta';
        toast.error(errorMessage);
        return;
      }

      console.log('[PROPOSALS-MANAGER] Proposal accepted successfully:', data);

      // Show success message from edge function
      toast.success(data.message || 'Proposta aceita com sucesso!', {
        description: `Motorista: ${proposal.driver?.full_name || 'N/A'} • Valor: R$ ${proposal.proposed_price.toLocaleString('pt-BR')}`
      });

      // Refresh proposals
      await fetchProposals();
      onProposalAccepted?.();
      
      setConfirmDialog({ open: false, proposal: null });
    } catch (error) {
      console.error('[PROPOSALS-MANAGER] Error accepting proposal:', error);
      showErrorToast(toast, 'Erro ao aceitar proposta', error);
    } finally {
      setAccepting(false);
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
      showErrorToast(toast, 'Erro ao rejeitar proposta', error);
    }
  };

  const filterProposals = (status: string) => {
    if (status === 'pending') return proposals.filter(p => p.status === 'PENDING');
    if (status === 'accepted') return proposals.filter(p => p.status === 'ACCEPTED');
    if (status === 'rejected') return proposals.filter(p => p.status === 'REJECTED');
    return proposals;
  };

  const renderProposalCard = (proposal: Proposal) => {
    const freight = proposal.freight;
    if (!freight) return null;

    const availableSlots = freight.required_trucks - freight.accepted_trucks;
    const belowAntt = proposal.proposed_price < (freight.minimum_antt_price || 0);
    const timeAgo = formatDistanceToNow(new Date(proposal.created_at), { 
      addSuffix: true, 
      locale: ptBR 
    });

    return (
      <Card key={proposal.id} className="mb-4">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={proposal.driver?.profile_photo_url} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{proposal.driver?.full_name || 'Motorista'}</h3>
                {proposal.driver?.rating && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>{proposal.driver.rating.toFixed(1)}★</span>
                    {proposal.driver.total_ratings && (
                      <span>({proposal.driver.total_ratings} avaliações)</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {timeAgo}
                </p>
              </div>
            </div>
            <Badge variant={proposal.status === 'PENDING' ? 'default' : proposal.status === 'ACCEPTED' ? 'default' : 'destructive'}>
              {proposal.status === 'PENDING' ? 'Pendente' : proposal.status === 'ACCEPTED' ? 'Aceita' : 'Rejeitada'}
            </Badge>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-sm mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Rota:</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                {freight.origin_city}/{freight.origin_state} → {freight.destination_city}/{freight.destination_state}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm mb-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Vagas:</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                {availableSlots} de {freight.required_trucks} disponíveis
              </p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Valor proposto:</span>
              <span className="text-2xl font-bold text-primary">
                R$ {proposal.proposed_price.toLocaleString('pt-BR')}
              </span>
            </div>
            {freight.minimum_antt_price && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor mínimo ANTT:</span>
                <span className={belowAntt ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                  R$ {freight.minimum_antt_price.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {belowAntt && (
              <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>Valor abaixo do mínimo ANTT</span>
              </div>
            )}
          </div>

          {proposal.message && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Mensagem do motorista:</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6 italic">"{proposal.message}"</p>
            </div>
          )}

          {proposal.status === 'PENDING' && freight.status !== 'CANCELLED' && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRejectProposal(proposal.id)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirmDialog({ open: true, proposal })}
                disabled={availableSlots <= 0}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {availableSlots <= 0 ? 'Sem vagas' : 'Aceitar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const pendingCount = proposals.filter(p => p.status === 'PENDING').length;
  const acceptedCount = proposals.filter(p => p.status === 'ACCEPTED').length;
  const rejectedCount = proposals.filter(p => p.status === 'REJECTED').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Propostas de Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando propostas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Propostas de Motoristas</CardTitle>
            {pendingCount > 0 && (
              <Badge variant="default" className="h-6 px-3">
                {pendingCount} {pendingCount === 1 ? 'nova' : 'novas'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="pending">
                Pendentes {pendingCount > 0 && `(${pendingCount})`}
              </TabsTrigger>
              <TabsTrigger value="accepted">
                Aceitas {acceptedCount > 0 && `(${acceptedCount})`}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejeitadas {rejectedCount > 0 && `(${rejectedCount})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {filterProposals('pending').length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('pending').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="accepted">
              {filterProposals('accepted').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta aceita</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('accepted').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {filterProposals('rejected').length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta rejeitada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('rejected').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, proposal: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aceitação da Proposta</DialogTitle>
            <DialogDescription>
              Você está prestes a aceitar esta proposta. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.proposal && (
            <div className="space-y-4 my-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Motorista:</span>
                <span className="font-semibold">{confirmDialog.proposal.driver?.full_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Valor:</span>
                <span className="text-lg font-bold text-primary">
                  R$ {confirmDialog.proposal.proposed_price.toLocaleString('pt-BR')}
                </span>
              </div>
              {confirmDialog.proposal.freight?.minimum_antt_price && 
               confirmDialog.proposal.proposed_price < confirmDialog.proposal.freight.minimum_antt_price && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive font-medium">
                    Atenção: Valor abaixo do mínimo ANTT
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, proposal: null })}
              disabled={accepting}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => confirmDialog.proposal && handleAcceptProposal(confirmDialog.proposal)}
              disabled={accepting}
            >
              {accepting ? 'Aceitando...' : 'Confirmar Aceitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
