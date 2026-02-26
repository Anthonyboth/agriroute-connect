import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
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
import { CenteredSpinner, InlineSpinner } from '@/components/ui/AppSpinner';
import { toast } from 'sonner';
import { Clock, DollarSign, Truck, User, MapPin, AlertTriangle, CheckCircle, XCircle, MessageSquare, Loader2, ArrowUpDown, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { showErrorToast } from '@/lib/error-handler';
import { ProposalCounterModal } from '@/components/ProposalCounterModal';
import { formatBRL } from '@/lib/formatters';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { ProposalCard } from '@/components/proposal/ProposalCard';

// Lazy load ProposalChatPanel with retry for chunk loading resilience
const ProposalChatPanel = lazyWithRetry(() => 
  import('@/components/proposal/ProposalChatPanel').then(m => ({ default: m.ProposalChatPanel }))
);

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  proposal_pricing_type?: string | null;
  proposal_unit_price?: number | null;
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
    origin_city: string | null;
    origin_state: string | null;
    origin_address?: string | null;
    destination_city: string | null;
    destination_state: string | null;
    destination_address?: string | null;
    cargo_type: string;
    required_trucks: number;
    accepted_trucks: number;
    minimum_antt_price?: number;
    price: number;
    distance_km: number;
    status: string;
    pricing_type?: string;
    price_per_km?: number;
    weight?: number;
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
  const [detailsDialog, setDetailsDialog] = useState<{
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

  // Prevent duplicated requests (double clicks / realtime bursts)
  const acceptInFlightRef = useRef<Set<string>>(new Set());
  const fetchInFlightRef = useRef(false);
  const fetchQueuedRef = useRef(false);

  const fetchProposals = useCallback(async () => {
    if (fetchInFlightRef.current) {
      fetchQueuedRef.current = true;
      return;
    }
    fetchInFlightRef.current = true;

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
          freight:freights(*, weight),
          driver:profiles_secure!freight_proposals_driver_id_fkey(
            id,
            full_name,
            rating,
            total_ratings,
            profile_photo_url,
            contact_phone
          )
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
      fetchInFlightRef.current = false;
      if (fetchQueuedRef.current) {
        fetchQueuedRef.current = false;
        // re-fetch once if something arrived while we were fetching
        void fetchProposals();
      }
    }
  }, [producerId]);

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
    if (acceptInFlightRef.current.has(proposal.id)) return;
    acceptInFlightRef.current.add(proposal.id);

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
      acceptInFlightRef.current.delete(proposal.id);
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

  const canAcceptProposal = (proposal: Proposal) => {
    const freight = proposal.freight;
    if (!freight) return false;
    const available = freight.required_trucks - freight.accepted_trucks;
    return available > 0 && freight.status !== 'CANCELLED';
  };

  // ✅ Propostas para fretes lotados (accepted_trucks >= required_trucks) são filtradas
  // das abas ativas (PENDING/COUNTER_PROPOSED) pois não podem mais ser aceitas
  const isFreightFull = (proposal: Proposal) => {
    const freight = proposal.freight;
    if (!freight) return true;
    return freight.accepted_trucks >= freight.required_trucks;
  };

  const filterProposalsByStatus = (status: string) => {
    const filtered = filteredProposals;
    if (status === 'pending') return filtered.filter(p => p.status === 'PENDING' && !isFreightFull(p));
    if (status === 'counter_proposed') return filtered.filter(p => p.status === 'COUNTER_PROPOSED' && !isFreightFull(p));
    if (status === 'accepted') return filtered.filter(p => p.status === 'ACCEPTED');
    if (status === 'rejected') return filtered.filter(p => p.status === 'REJECTED');
    return filtered;
  };

  // Removed renderProposalCard function - now using ProposalCard component

  // ✅ Contadores excluem propostas de fretes lotados nas abas ativas
  const pendingCount = proposals.filter(p => p.status === 'PENDING' && !isFreightFull(p)).length;
  const counterProposedCount = proposals.filter(p => p.status === 'COUNTER_PROPOSED' && !isFreightFull(p)).length;
  const acceptedCount = proposals.filter(p => p.status === 'ACCEPTED').length;
  const rejectedCount = proposals.filter(p => p.status === 'REJECTED').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Propostas de Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <CenteredSpinner />
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
            {(pendingCount + counterProposedCount) > 0 && (
              <Badge variant="default" className="h-6 px-3">
                {pendingCount + counterProposedCount} {(pendingCount + counterProposedCount) === 1 ? 'nova' : 'novas'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto mb-6 -mx-1 px-1">
              <TabsList className="inline-flex w-max min-w-full gap-1">
                <TabsTrigger value="pending" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                  Pendentes {pendingCount > 0 && `(${pendingCount})`}
                </TabsTrigger>
                <TabsTrigger value="counter_proposed" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                  Contrapropostas {counterProposedCount > 0 && `(${counterProposedCount})`}
                </TabsTrigger>
                <TabsTrigger value="accepted" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                  Aceitas {acceptedCount > 0 && `(${acceptedCount})`}
                </TabsTrigger>
                <TabsTrigger value="rejected" className="whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
                  Rejeitadas {rejectedCount > 0 && `(${rejectedCount})`}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Filtros Avançados */}
            {activeTab === 'pending' && proposals.filter(p => p.status === 'PENDING').length > 0 && (
              <Card className="mb-4 border border-border/60 bg-card/95">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {/* Filtro de Preço */}
                    <div className="space-y-2">
                      <Label className="text-sm">Faixa de Preço</Label>
                      <div className="grid grid-cols-2 gap-2">
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
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <Select
                          value={proposalFilters.sortBy}
                          onValueChange={(value) => setProposalFilters({
                            ...proposalFilters,
                            sortBy: value as any
                          })}
                        >
                          <SelectTrigger className="h-9 min-w-0">
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
                          className="h-9 w-9 shrink-0"
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

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
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
                  {filterProposalsByStatus('pending').map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      producerId={producerId}
                      loadingAction={loadingAction}
                      onDetails={(p) => setDetailsDialog({ open: true, proposal: p })}
                      onAccept={(p) => setConfirmDialog({ open: true, proposal: p })}
                      onReject={handleRejectProposal}
                      onCounterProposal={(p) => setCounterProposalOpen({ open: true, proposal: p })}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="counter_proposed">
              {filterProposalsByStatus('counter_proposed').length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma contraproposta aguardando resposta</p>
                  <p className="text-xs text-muted-foreground mt-1">Contrapropostas enviadas ao motorista aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposalsByStatus('counter_proposed').map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      producerId={producerId}
                      loadingAction={loadingAction}
                      onDetails={(p) => setDetailsDialog({ open: true, proposal: p })}
                      onAccept={(p) => setConfirmDialog({ open: true, proposal: p })}
                      onReject={handleRejectProposal}
                      onCounterProposal={(p) => setCounterProposalOpen({ open: true, proposal: p })}
                    />
                  ))}
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
                  {filterProposalsByStatus('accepted').map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      producerId={producerId}
                      loadingAction={loadingAction}
                      onDetails={(p) => setDetailsDialog({ open: true, proposal: p })}
                      onAccept={(p) => setConfirmDialog({ open: true, proposal: p })}
                      onReject={handleRejectProposal}
                      onCounterProposal={(p) => setCounterProposalOpen({ open: true, proposal: p })}
                    />
                  ))}
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
                  {filterProposalsByStatus('rejected').map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      producerId={producerId}
                      loadingAction={loadingAction}
                      onDetails={(p) => setDetailsDialog({ open: true, proposal: p })}
                      onAccept={(p) => setConfirmDialog({ open: true, proposal: p })}
                      onReject={handleRejectProposal}
                      onCounterProposal={(p) => setCounterProposalOpen({ open: true, proposal: p })}
                    />
                  ))}
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

      {/* Proposal Details Dialog */}
      <Dialog 
        open={detailsDialog.open} 
        onOpenChange={(open) => setDetailsDialog({ open, proposal: null })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="proposal-details-dialog">
          <DialogHeader>
            <DialogTitle>Detalhes da Proposta</DialogTitle>
            <DialogDescription>
              Revise todas as informações antes de decidir
            </DialogDescription>
          </DialogHeader>

          {detailsDialog.proposal && detailsDialog.proposal.freight && (
            <div className="space-y-6 py-4">
              {/* Driver Info */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={detailsDialog.proposal.driver?.profile_photo_url} />
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-xl">{detailsDialog.proposal.driver?.full_name || 'Motorista'}</h3>
                  {detailsDialog.proposal.driver?.rating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <span className="text-lg">{detailsDialog.proposal.driver.rating.toFixed(1)}★</span>
                      {detailsDialog.proposal.driver.total_ratings && (
                        <span>({detailsDialog.proposal.driver.total_ratings} avaliações)</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Proposta enviada {formatDistanceToNow(new Date(detailsDialog.proposal.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
                <Badge variant={
                  detailsDialog.proposal.status === 'PENDING' || detailsDialog.proposal.status === 'COUNTER_PROPOSED'
                    ? 'default'
                    : detailsDialog.proposal.status === 'ACCEPTED'
                      ? 'default'
                      : 'destructive'
                }>
                  {detailsDialog.proposal.status === 'PENDING'
                    ? 'Pendente'
                    : detailsDialog.proposal.status === 'COUNTER_PROPOSED'
                      ? 'Contraproposta'
                      : detailsDialog.proposal.status === 'ACCEPTED'
                        ? 'Aceita'
                        : 'Rejeitada'}
                </Badge>
              </div>

              <Separator />

              {/* Route and Details */}
              {(() => {
                const freight = detailsDialog.proposal.freight;

                const originFallback = [freight.origin_city, freight.origin_state]
                  .filter(Boolean)
                  .join('/') || freight.origin_address || 'Origem não informada';

                const destinationFallback = [freight.destination_city, freight.destination_state]
                  .filter(Boolean)
                  .join('/') || freight.destination_address || 'Destino não informado';

                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        Origem
                      </div>
                      <p className="pl-6 text-base font-semibold break-words">
                        {originFallback}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        Destino
                      </div>
                      <p className="pl-6 text-base font-semibold break-words">
                        {destinationFallback}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Truck className="h-4 w-4" />
                        Vagas Disponíveis
                      </div>
                      <p className="pl-6 text-base font-semibold">
                        {detailsDialog.proposal.freight.required_trucks - detailsDialog.proposal.freight.accepted_trucks} de {detailsDialog.proposal.freight.required_trucks}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">
                        Tipo de Carga
                      </div>
                      <p className="text-base font-semibold break-words">
                        {detailsDialog.proposal.freight.cargo_type || 'Não informado'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <Separator />

              {/* Price Details */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Valor Proposto:</span>
                  <Badge 
                    variant={
                      detailsDialog.proposal.freight.minimum_antt_price && 
                      detailsDialog.proposal.proposed_price < detailsDialog.proposal.freight.minimum_antt_price 
                        ? 'destructive' 
                        : 'default'
                    } 
                    className="text-xl px-4 py-1"
                  >
                    {formatBRL(detailsDialog.proposal.proposed_price)}
                  </Badge>
                </div>
                
                {detailsDialog.proposal.freight.minimum_antt_price && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor Mínimo ANTT:</span>
                    <span className={
                      detailsDialog.proposal.proposed_price < detailsDialog.proposal.freight.minimum_antt_price 
                        ? 'text-destructive font-semibold' 
                        : 'text-muted-foreground'
                    }>
                      {formatBRL(detailsDialog.proposal.freight.minimum_antt_price)}
                    </span>
                  </div>
                )}

                {detailsDialog.proposal.freight.minimum_antt_price && 
                 detailsDialog.proposal.proposed_price < detailsDialog.proposal.freight.minimum_antt_price && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-semibold text-destructive">
                          ⚠️ Valor Abaixo do Mínimo ANTT
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Esta proposta está <span className="font-bold">
                            {formatBRL(detailsDialog.proposal.freight.minimum_antt_price - detailsDialog.proposal.proposed_price)}
                          </span> abaixo do valor mínimo estabelecido pela ANTT.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message */}
              {detailsDialog.proposal.message && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <MessageSquare className="h-4 w-4" />
                      Mensagem do Motorista
                    </div>
                    <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">
                      "{detailsDialog.proposal.message}"
                    </p>
                  </div>
                </>
              )}

              {/* Chat de Negociação */}
              <Separator />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
                  <MessageSquare className="h-4 w-4" />
                  Chat de Negociação
                </div>
            <Suspense fallback={<CenteredSpinner className="h-32" />}>
              <ProposalChatPanel
                proposalId={detailsDialog.proposal.id}
                currentUserId={producerId}
                currentUserName="Você"
                userRole="producer"
              />
            </Suspense>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 justify-end flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setDetailsDialog({ open: false, proposal: null })}
            >
              Fechar
            </Button>
            
            {detailsDialog.proposal && (detailsDialog.proposal.status === 'PENDING' || detailsDialog.proposal.status === 'COUNTER_PROPOSED') && (
              <>
                {detailsDialog.proposal.status === 'PENDING' && (
                  <Button 
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
                    onClick={() => {
                      setCounterProposalOpen({ open: true, proposal: detailsDialog.proposal });
                      setDetailsDialog({ open: false, proposal: null });
                    }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Fazer Contraproposta
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (detailsDialog.proposal) {
                      handleRejectProposal(detailsDialog.proposal.id);
                      setDetailsDialog({ open: false, proposal: null });
                    }
                  }}
                  disabled={loadingAction.proposalId === detailsDialog.proposal?.id}
                >
                  {loadingAction.proposalId === detailsDialog.proposal?.id && loadingAction.action === 'reject' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Rejeitando...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      {detailsDialog.proposal.status === 'COUNTER_PROPOSED' ? 'Rejeitar contraproposta' : 'Rejeitar'}
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={() => {
                    if (detailsDialog.proposal) {
                      setConfirmDialog({ open: true, proposal: detailsDialog.proposal });
                      setDetailsDialog({ open: false, proposal: null });
                    }
                  }}
                  disabled={!canAcceptProposal(detailsDialog.proposal) || loadingAction.proposalId === detailsDialog.proposal?.id}
                >
                  {loadingAction.proposalId === detailsDialog.proposal?.id && loadingAction.action === 'accept' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aceitando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {!canAcceptProposal(detailsDialog.proposal) 
                        ? 'Sem vagas' 
                        : detailsDialog.proposal.status === 'COUNTER_PROPOSED' 
                          ? 'Aceitar contraproposta' 
                          : 'Aceitar'}
                    </>
                  )}
                </Button>
              </>
            )}
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
          proposal_pricing_type: counterProposalOpen.proposal.proposal_pricing_type,
          proposal_unit_price: counterProposalOpen.proposal.proposal_unit_price,
          message: counterProposalOpen.proposal.message || '',
          driver_name: counterProposalOpen.proposal.driver?.full_name || 'Motorista',
          driver_id: counterProposalOpen.proposal.driver_id
        } : null}
        freightPrice={counterProposalOpen.proposal?.freight?.price || 0}
        freightDistance={counterProposalOpen.proposal?.freight?.distance_km || 0}
        freightWeight={(counterProposalOpen.proposal?.freight as any)?.weight || 0}
        requiredTrucks={counterProposalOpen.proposal?.freight?.required_trucks || 1}
        freightPricingType={counterProposalOpen.proposal?.freight?.pricing_type}
        freightPricePerKm={counterProposalOpen.proposal?.freight?.price_per_km}
        onSuccess={() => {
          fetchProposals();
        }}
      />
    </>
  );
};
