import React, { useState, useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Separator } from '@/components/ui/separator';
import { FileText, CheckCircle, XCircle, Clock, DollarSign, User, Package, MapPin, MessageSquare, Phone, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL, formatKm } from '@/lib/formatters';
import { UI_TEXTS } from '@/lib/ui-texts';
import { resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';
import { getCanonicalFreightPrice } from '@/lib/freightPriceContract';

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  message?: string;
  status: string;
  created_at: string;
  freight: {
    id: string;
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    price: number;
    distance_km: number;
    weight: number;
    producer_id: string;
  };
  driver: {
    full_name: string;
    rating?: number;
    total_ratings?: number;
    contact_phone?: string;
    profile_photo_url?: string;
  };
}

export const CompanyProposalsManager: React.FC = () => {
  const { company, drivers } = useTransportCompany();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    proposal: Proposal | null;
  }>({ open: false, proposal: null });

  useEffect(() => {
    if (company?.id && drivers) {
      fetchProposals();
    }
  }, [company, drivers]);

  const fetchProposals = async () => {
    if (!company?.id || !drivers) return;

    try {
      const driverIds = drivers.filter(d => d.status === 'ACTIVE').map(d => d.driver_profile_id);
      
      if (driverIds.length === 0) {
        setProposals([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(
            id,
            cargo_type,
            origin_address,
            destination_address,
            pickup_date,
            price,
            distance_km,
            weight,
            producer_id
          ),
          driver:profiles!driver_id(
            full_name,
            rating,
            total_ratings,
            contact_phone,
            profile_photo_url
          )
        `)
        .in('driver_id', driverIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProposals(data || []);
    } catch (error) {
      console.error('Erro ao buscar propostas:', error);
      toast.error('Erro ao carregar propostas');
    } finally {
      setLoading(false);
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
      setDetailsDialog({ open: false, proposal: null });
    } catch (error) {
      console.error('Erro ao aceitar proposta:', error);
      toast.error('Erro ao aceitar proposta');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    if (!confirm('Tem certeza que deseja rejeitar esta proposta?')) return;

    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta rejeitada');
      fetchProposals();
      setDetailsDialog({ open: false, proposal: null });
    } catch (error) {
      console.error('Erro ao rejeitar proposta:', error);
      toast.error('Erro ao rejeitar proposta');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      PENDING: { label: 'Pendente', variant: 'outline' },
      ACCEPTED: { label: 'Aceita', variant: 'default' },
      REJECTED: { label: 'Rejeitada', variant: 'destructive' },
      CANCELLED: { label: 'Cancelada', variant: 'secondary' }
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filterProposals = (status: string) => {
    if (status === 'pending') return proposals.filter(p => p.status === 'PENDING');
    if (status === 'accepted') return proposals.filter(p => p.status === 'ACCEPTED');
    if (status === 'rejected') return proposals.filter(p => p.status === 'REJECTED' || p.status === 'CANCELLED');
    return proposals;
  };

  const renderProposalCard = (proposal: Proposal) => {
    const priceDiff = proposal.proposed_price - proposal.freight.price;

    return (
      <Card 
        key={proposal.id} 
        className="border-l-4 border-l-blue-500 cursor-pointer hover:bg-muted/50 transition-colors"
        role="button"
        tabIndex={0}
        onClick={() => setDetailsDialog({ open: true, proposal })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailsDialog({ open: true, proposal });
          }
        }}
        data-testid="company-proposal-card"
      >
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{proposal.driver.full_name}</span>
                  {proposal.driver.rating && (
                    <Badge variant="outline" className="text-xs">
                      {proposal.driver.rating.toFixed(1)}★
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Enviada {formatDistanceToNow(new Date(proposal.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
              {getStatusBadge(proposal.status)}
            </div>

            <div className="bg-muted/30 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{proposal.freight.cargo_type}</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground flex-1 truncate">{proposal.freight.origin_address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground flex-1 truncate">{proposal.freight.destination_address}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Valor Original</p>
                <p className="text-lg font-semibold">
                  {(() => {
                    const pd = getCanonicalFreightPrice({
                      pricing_type: (proposal.freight as any)?.pricing_type,
                      price_per_ton: (proposal.freight as any)?.price_per_ton,
                      price_per_km: (proposal.freight as any)?.price_per_km,
                      price: proposal.freight.price || 0,
                      required_trucks: (proposal.freight as any)?.required_trucks,
                      weight: (proposal.freight as any)?.weight,
                      distance_km: (proposal.freight as any)?.distance_km,
                    });
                    return pd.primaryLabel;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Proposto</p>
                <p className={`text-lg font-semibold ${priceDiff > 0 ? 'text-red-600' : priceDiff < 0 ? 'text-green-600' : ''}`}>
                  R$ {formatBRL(proposal.proposed_price)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <CenteredSpinner />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gestão de Propostas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">
                {proposals.filter(p => p.status === 'PENDING').length}
              </div>
              <div className="text-sm text-muted-foreground">Pendentes</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {proposals.filter(p => p.status === 'ACCEPTED').length}
              </div>
              <div className="text-sm text-muted-foreground">Aceitas</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold text-red-600">
                {proposals.filter(p => p.status === 'REJECTED').length}
              </div>
              <div className="text-sm text-muted-foreground">Rejeitadas</div>
            </div>
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold text-primary">
                R$ {(proposals
                  .filter(p => p.status === 'ACCEPTED')
                  .reduce((sum, p) => sum + p.proposed_price, 0) / 1000
                ).toFixed(1)}k
              </div>
              <div className="text-sm text-muted-foreground">Total Aceito</div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="accepted">Aceitas</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {filterProposals('pending').length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhuma proposta pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('pending').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="accepted" className="space-y-4">
              {filterProposals('accepted').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhuma proposta aceita ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('accepted').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {filterProposals('rejected').length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
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

      {/* Modal de Detalhes */}
      <Dialog 
        open={detailsDialog.open}
        onOpenChange={(open) => setDetailsDialog({ open, proposal: null })}
      >
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          data-testid="company-proposal-details-dialog"
        >
          <DialogHeader>
            <DialogTitle>{UI_TEXTS.DETALHES_PROPOSTA}</DialogTitle>
            <DialogDescription>
              Proposta enviada por motorista afiliado à sua transportadora
            </DialogDescription>
          </DialogHeader>
          
          {detailsDialog.proposal && (
            <div className="space-y-6 py-4">
              {/* Informações do Motorista Afiliado */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <SignedAvatarImage src={detailsDialog.proposal.driver.profile_photo_url} />
                  <AvatarFallback>
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-xl">
                    {detailsDialog.proposal.driver.full_name}
                  </h3>
                  {detailsDialog.proposal.driver.rating ? (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <span className="text-lg">{detailsDialog.proposal.driver.rating.toFixed(1)}★</span>
                      {detailsDialog.proposal.driver.total_ratings && (
                        <span>({detailsDialog.proposal.driver.total_ratings} avaliações)</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1">
                      {UI_TEXTS.SEM_AVALIACOES}
                    </div>
                  )}
                  <Badge variant="secondary" className="mt-2">
                    {UI_TEXTS.MOTORISTA_DA_EMPRESA} {company?.company_name}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Informações do Frete */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Package className="h-4 w-4" />
                    {UI_TEXTS.TIPO_CARGA}
                  </div>
                  <p className="text-base font-semibold pl-6">
                    {detailsDialog.proposal.freight.cargo_type}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {UI_TEXTS.DISTANCIA}
                  </div>
                  <p className="text-base font-semibold pl-6">
                    {formatKm(detailsDialog.proposal.freight.distance_km)}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    {UI_TEXTS.ORIGEM}
                  </div>
                  <p className="text-sm">{detailsDialog.proposal.freight.origin_address}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    {UI_TEXTS.DESTINO}
                  </div>
                  <p className="text-sm">{detailsDialog.proposal.freight.destination_address}</p>
                </div>
              </div>

              <Separator />

              {/* Valores */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{UI_TEXTS.VALOR_ORIGINAL_FRETE}:</span>
                  <span className="text-lg font-semibold">
                    R$ {formatBRL(detailsDialog.proposal.freight.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{UI_TEXTS.VALOR_PROPOSTO}:</span>
                  <Badge variant="default" className="text-xl px-4 py-1">
                    R$ {formatBRL(detailsDialog.proposal.proposed_price)}
                  </Badge>
                </div>
                {detailsDialog.proposal.proposed_price !== detailsDialog.proposal.freight.price && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{UI_TEXTS.DIFERENCA}:</span>
                    <span className={
                      detailsDialog.proposal.proposed_price > detailsDialog.proposal.freight.price
                        ? 'text-red-600 font-semibold flex items-center gap-1'
                        : 'text-green-600 font-semibold flex items-center gap-1'
                    }>
                      {detailsDialog.proposal.proposed_price > detailsDialog.proposal.freight.price ? (
                        <>
                          <TrendingUp className="h-3 w-3" />
                          +R$ {formatBRL(Math.abs(detailsDialog.proposal.proposed_price - detailsDialog.proposal.freight.price))}
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3" />
                          -R$ {formatBRL(Math.abs(detailsDialog.proposal.proposed_price - detailsDialog.proposal.freight.price))}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Mensagem */}
              {detailsDialog.proposal.message && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <MessageSquare className="h-4 w-4" />
                      {UI_TEXTS.MENSAGEM_MOTORISTA}
                    </div>
                    <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">
                      "{detailsDialog.proposal.message}"
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDetailsDialog({ open: false, proposal: null })}
            >
              Fechar
            </Button>
            {detailsDialog.proposal?.status === 'PENDING' && (
              <>
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectProposal(detailsDialog.proposal!.id);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptProposal(detailsDialog.proposal!.id);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aceitar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
