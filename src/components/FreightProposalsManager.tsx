import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, DollarSign, Truck, User, MapPin, AlertTriangle, CheckCircle, XCircle, MessageSquare, Loader2, ArrowUpDown, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showErrorToast } from '@/lib/error-handler';
import { ProposalCounterModal } from '@/components/ProposalCounterModal';
import { formatBRL } from '@/lib/formatters';

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
    distance_km: number;
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
  const [loadingAction, setLoadingAction] = useState<{
    proposalId: string | null;
    action: 'accept' | 'reject' | null;
  }>({ proposalId: null, action: null });
  const [counterProposalOpen, setCounterProposalOpen] = useState<{
    open: boolean;
    proposal: Proposal | null;
  }>({ open: false, proposal: null });
  const [proposalFilters, setProposalFilters] = useState<{
    priceRange?: { min: number; max: number };
    driverId?: string;
    route?: string;
    sortBy: 'price' | 'date' | 'driver';
    sortOrder: 'asc' | 'desc';
  }>({
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const fetchProposals = async () => {
    try {
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
    setLoadingAction({ proposalId: proposal.id, action: 'accept' });
    try {
      const { data, error } = await supabase.functions.invoke('accept-freight-proposal', {
        body: {
          proposal_id: proposal.id,
          producer_id: producerId
        }
      });

      if (error) {
        const errorMessage = data?.error || error.message || 'Erro ao aceitar proposta';
        toast.error(errorMessage);
        return;
      }

      toast.success(data.message || 'Proposta aceita com sucesso!', {
        description: `Motorista: ${proposal.driver?.full_name || 'N/A'} • Valor: ${formatBRL(proposal.proposed_price)}`
      });

      await fetchProposals();
      onProposalAccepted?.();
      
      setConfirmDialog({ open: false, proposal: null });
    } catch (error) {
      showErrorToast(toast, 'Erro ao aceitar proposta', error);
    } finally {
      setAccepting(false);
      setLoadingAction({ proposalId: null, action: null });
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setLoadingAction({ proposalId, action: 'reject' });
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta rejeitada');
      fetchProposals();
    } catch (error) {
      showErrorToast(toast, 'Erro ao rejeitar proposta', error);
    } finally {
      setLoadingAction({ proposalId: null, action: null });
    }
  };

  // Filtrar e ordenar propostas
  const filteredProposals = useMemo(() => {
    let result = [...proposals];
    
    // Filtrar por preço
    if (proposalFilters.priceRange) {
      result = result.filter(p => 
        p.proposed_price >= proposalFilters.priceRange!.min &&
        p.proposed_price <= proposalFilters.priceRange!.max
      );
    }
    
    // Filtrar por motorista
    if (proposalFilters.driverId) {
      result = result.filter(p => 
        p.driver?.full_name.toLowerCase().includes(proposalFilters.driverId!.toLowerCase())
      );
    }
    
    // Filtrar por rota
    if (proposalFilters.route) {
      const search = proposalFilters.route.toLowerCase();
      result = result.filter(p => 
        p.freight?.origin_city?.toLowerCase().includes(search) ||
        p.freight?.destination_city?.toLowerCase().includes(search)
      );
    }
    
    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (proposalFilters.sortBy) {
        case 'price':
          comparison = a.proposed_price - b.proposed_price;
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'driver':
          comparison = (a.driver?.full_name || '').localeCompare(b.driver?.full_name || '');
          break;
      }
      
      return proposalFilters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [proposals, proposalFilters]);

  const filterProposalsByStatus = (status: string) => {
    const filtered = filteredProposals;
    if (status === 'pending') return filtered.filter(p => p.status === 'PENDING');
    if (status === 'accepted') return filtered.filter(p => p.status === 'ACCEPTED');
    if (status === 'rejected') return filtered.filter(p => p.status === 'REJECTED');
    return filtered;
  };

  const renderProposalCard = (proposal: Proposal) => {
    const freight = proposal.freight;
    if (!freight) return null;

    const availableSlots = freight.required_trucks - freight.accepted_trucks;
    const belowAntt = freight.minimum_antt_price && proposal.proposed_price < freight.minimum_antt_price;
    const timeAgo = formatDistanceToNow(new Date(proposal.created_at), { 
      addSuffix: true, 
      locale: ptBR 
    });
    const canAccept = availableSlots > 0 && freight.status !== 'CANCELLED';

    return (
      <Card key={proposal.id} className="mb-4" data-testid="proposal-card">
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={belowAntt ? 'destructive' : 'default'} className="text-lg px-3">
                      {formatBRL(proposal.proposed_price)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {belowAntt 
                      ? 'Valor abaixo do mínimo ANTT' 
                      : 'Valor dentro da conformidade'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {freight.minimum_antt_price && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Valor mínimo ANTT:</span>
                <span className={belowAntt ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                  {formatBRL(freight.minimum_antt_price)}
                </span>
              </div>
            )}
          </div>

          {/* Aviso ANTT Expandido */}
          {belowAntt && freight.minimum_antt_price && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-semibold text-destructive">
                    ⚠️ Valor Abaixo do Mínimo ANTT
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta proposta está <span className="font-bold">{formatBRL(freight.minimum_antt_price - proposal.proposed_price)}</span> abaixo do valor mínimo estabelecido pela ANTT para este tipo de transporte.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mínimo ANTT: <span className="font-semibold">{formatBRL(freight.minimum_antt_price)}</span>
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-destructive hover:underline"
                    asChild
                  >
                    <a 
                      href="https://www.gov.br/antt/pt-br/assuntos/cargas/resolucoes-e-normas" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Saiba mais sobre os valores mínimos <ExternalLink className="inline h-3 w-3 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {proposal.message && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Mensagem do motorista:</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6 italic">"{proposal.message}"</p>
            </div>
          )}

          {/* Botões de Ação */}
          {proposal.status === 'PENDING' && freight.status !== 'CANCELLED' && (
            <div className="mt-4 flex gap-2 justify-end flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRejectProposal(proposal.id)}
                disabled={loadingAction.proposalId === proposal.id}
                data-testid="reject-proposal-button"
              >
                {loadingAction.proposalId === proposal.id && loadingAction.action === 'reject' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejeitando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeitar
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCounterProposalOpen({ open: true, proposal })}
                className="border-primary text-primary hover:bg-primary/10"
                data-testid="counter-proposal-button"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Fazer Contraproposta
              </Button>
              
              <Button
                size="sm"
                onClick={() => setConfirmDialog({ open: true, proposal })}
                disabled={!canAccept || loadingAction.proposalId === proposal.id}
                data-testid="accept-proposal-button"
              >
                {loadingAction.proposalId === proposal.id && loadingAction.action === 'accept' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {!canAccept ? 'Sem vagas' : 'Aceitar'}
                  </>
                )}
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

            {/* Filtros Avançados */}
            {activeTab === 'pending' && proposals.filter(p => p.status === 'PENDING').length > 0 && (
              <Card className="mb-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Filtro de Preço */}
                    <div className="space-y-2">
                      <Label className="text-sm">Faixa de Preço</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Mín"
                          value={proposalFilters.priceRange?.min || ''}
                          onChange={(e) => setProposalFilters({
                            ...proposalFilters,
                            priceRange: {
                              min: parseFloat(e.target.value) || 0,
                              max: proposalFilters.priceRange?.max || 999999
                            }
                          })}
                          className="h-9"
                        />
                        <Input
                          type="number"
                          placeholder="Máx"
                          value={proposalFilters.priceRange?.max || ''}
                          onChange={(e) => setProposalFilters({
                            ...proposalFilters,
                            priceRange: {
                              min: proposalFilters.priceRange?.min || 0,
                              max: parseFloat(e.target.value) || 999999
                            }
                          })}
                          className="h-9"
                        />
                      </div>
                    </div>

                    {/* Filtro de Motorista */}
                    <div className="space-y-2">
                      <Label className="text-sm">Motorista</Label>
                      <Input
                        placeholder="Nome do motorista"
                        value={proposalFilters.driverId || ''}
                        onChange={(e) => setProposalFilters({
                          ...proposalFilters,
                          driverId: e.target.value
                        })}
                        className="h-9"
                      />
                    </div>

                    {/* Filtro de Rota */}
                    <div className="space-y-2">
                      <Label className="text-sm">Rota</Label>
                      <Input
                        placeholder="Cidade origem ou destino"
                        value={proposalFilters.route || ''}
                        onChange={(e) => setProposalFilters({
                          ...proposalFilters,
                          route: e.target.value
                        })}
                        className="h-9"
                      />
                    </div>

                    {/* Ordenação */}
                    <div className="space-y-2">
                      <Label className="text-sm">Ordenar por</Label>
                      <div className="flex gap-2">
                        <Select
                          value={proposalFilters.sortBy}
                          onValueChange={(value) => setProposalFilters({
                            ...proposalFilters,
                            sortBy: value as any
                          })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date">Data</SelectItem>
                            <SelectItem value="price">Preço</SelectItem>
                            <SelectItem value="driver">Motorista</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => setProposalFilters({
                            ...proposalFilters,
                            sortOrder: proposalFilters.sortOrder === 'asc' ? 'desc' : 'asc'
                          })}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProposalFilters({
                        sortBy: 'date',
                        sortOrder: 'desc'
                      })}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <TabsContent value="pending">
              {filterProposalsByStatus('pending').length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposalsByStatus('pending').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="accepted">
              {filterProposalsByStatus('accepted').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta aceita</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposalsByStatus('accepted').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {filterProposalsByStatus('rejected').length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma proposta rejeitada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposalsByStatus('rejected').map(renderProposalCard)}
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
                  {formatBRL(confirmDialog.proposal.proposed_price)}
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

      {/* Counter Proposal Modal */}
      <ProposalCounterModal
        isOpen={counterProposalOpen.open}
        onClose={() => setCounterProposalOpen({ open: false, proposal: null })}
        originalProposal={counterProposalOpen.proposal ? {
          id: counterProposalOpen.proposal.id,
          freight_id: counterProposalOpen.proposal.freight_id,
          proposed_price: counterProposalOpen.proposal.proposed_price,
          message: counterProposalOpen.proposal.message || '',
          driver_name: counterProposalOpen.proposal.driver?.full_name || 'Motorista'
        } : null}
        freightPrice={counterProposalOpen.proposal?.freight?.price || 0}
        freightDistance={counterProposalOpen.proposal?.freight?.distance_km || 0}
        onSuccess={() => {
          fetchProposals();
          toast.success('Contraproposta enviada com sucesso!');
        }}
      />
    </>
  );
};
