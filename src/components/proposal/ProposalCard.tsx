import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Clock, DollarSign, Truck, User, MapPin, AlertTriangle, CheckCircle, XCircle, MessageSquare, Loader2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/formatters';
import { useProposalChatUnreadCount } from '@/hooks/useProposalChatUnreadCount';
import { getPricePerTruck, getRequiredTrucks, hasMultipleTrucks as checkMultipleTrucks } from '@/lib/proposal-utils';
import { getFreightPriceDisplay } from '@/hooks/useFreightPriceDisplay';
import { getCanonicalPriceFromTotal } from '@/lib/freightPriceContract';
import { SafeStatusBadge } from '@/components/security';

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number; // ✅ Este valor JÁ É por carreta (motorista envia por unidade)
  proposal_pricing_type?: string; // FIXED, PER_KM, PER_TON
  proposal_unit_price?: number; // Valor unitário (R$/km, R$/ton, ou total fixo)
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
    weight?: number;
    pricing_type?: string;
    price_per_km?: number;
  };
}

interface ProposalCardProps {
  proposal: Proposal;
  producerId: string;
  loadingAction: { proposalId: string | null; action: 'accept' | 'reject' | null };
  onDetails: (proposal: Proposal) => void;
  onAccept: (proposal: Proposal) => void;
  onReject: (proposalId: string) => void;
  onCounterProposal: (proposal: Proposal) => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  producerId,
  loadingAction,
  onDetails,
  onAccept,
  onReject,
  onCounterProposal
}) => {
  // ✅ Hook usado corretamente no topo do componente
  const { unreadCount: proposalUnreadCount } = useProposalChatUnreadCount(
    proposal.id,
    producerId
  );

  const freight = proposal.freight;
  if (!freight) return null;

  // ✅ CRÍTICO: Cálculos por carreta
  const requiredTrucks = getRequiredTrucks(freight);
  const multipleTrucks = checkMultipleTrucks(freight);
  const freightPricePerTruck = getPricePerTruck(freight.price, requiredTrucks);
  
  // A proposta do motorista JÁ É por carreta (padrão do sistema)
  const proposalPricePerTruck = proposal.proposed_price;
  
  // ANTT mínimo POR CARRETA
  const minAnttPerTruck = freight.minimum_antt_price
    ? getPricePerTruck(freight.minimum_antt_price, requiredTrucks)
    : 0;

  const availableSlots = freight.required_trucks - freight.accepted_trucks;
  const belowAntt = minAnttPerTruck > 0 && proposalPricePerTruck < minAnttPerTruck;
  const timeAgo = formatDistanceToNow(new Date(proposal.created_at), { 
    addSuffix: true, 
    locale: ptBR 
  });
  // Só pode aceitar quando o frete estiver OPEN e houver vagas
  const freightStatusUpper = freight.status?.toUpperCase?.() || '';
  const canAccept = freightStatusUpper === 'OPEN' && availableSlots > 0;

  return (
    <Card 
      role="button"
      tabIndex={0}
      onClick={() => onDetails(proposal)}
      onKeyDown={(e) => { 
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDetails(proposal);
        }
      }}
      className="mb-4 cursor-pointer border border-border/60 bg-card shadow-sm transition-all hover:bg-secondary/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
      data-testid="proposal-card"
    >
      <CardContent className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <SignedAvatarImage src={proposal.driver?.profile_photo_url} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              {proposalUnreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {proposalUnreadCount}
                </Badge>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base break-words">{proposal.driver?.full_name || 'Motorista'}</h3>
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
          <div className="w-full sm:w-auto sm:pl-2">
            {/* ✅ SEGURANÇA: Status via SafeStatusBadge - NUNCA exibe inglês cru */}
            <SafeStatusBadge status={proposal.status} type="proposal" />
          </div>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center gap-2 text-sm mb-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Rota:</span>
            </div>
            <p className="text-sm text-muted-foreground break-words">
              {([freight.origin_city, freight.origin_state].filter(Boolean).join('/') || freight.origin_address || 'Origem não informada')} → {([freight.destination_city, freight.destination_state].filter(Boolean).join('/') || freight.destination_address || 'Destino não informado')}
            </p>
          </div>

          <div className="rounded-md border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center gap-2 text-sm mb-1">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Vagas:</span>
            </div>
            <p className="text-sm text-muted-foreground break-words">
              {availableSlots} de {freight.required_trucks} disponíveis
            </p>
          </div>
        </div>

        {/* ✅ VALORES POR CARRETA */}
        <div className="rounded-lg border border-border/60 bg-secondary/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              Valor proposto:
            </span>
            <Badge variant={belowAntt ? 'destructive' : 'default'} className="text-sm">
              {proposal.proposal_pricing_type === 'PER_KM' && proposal.proposal_unit_price
                ? `R$ ${proposal.proposal_unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`
                : proposal.proposal_pricing_type === 'PER_TON' && proposal.proposal_unit_price
                  ? `R$ ${proposal.proposal_unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ton`
                  : (() => {
                      // Use canonical contract to derive display from freight's pricing_type
                      const pd = getFreightPriceDisplay({
                        price: proposalPricePerTruck * requiredTrucks, // reconstruct total
                        pricing_type: freight.pricing_type,
                        price_per_km: freight.price_per_km,
                        required_trucks: freight.required_trucks,
                        distance_km: freight.distance_km,
                        weight: freight.weight,
                      });
                      // If freight has a unit type, derive proposal in that unit
                      if (pd.pricingType === 'PER_TON' || pd.pricingType === 'PER_KM') {
                        const proposalDisplay = getCanonicalPriceFromTotal(proposalPricePerTruck * requiredTrucks, {
                          pricing_type: freight.pricing_type,
                          weight: freight.weight,
                          distance_km: freight.distance_km,
                          required_trucks: freight.required_trucks,
                        });
                        return proposalDisplay.primaryLabel;
                      }
                      return pd.pricingType === 'PER_VEHICLE' && multipleTrucks
                        ? `${formatBRL(proposalPricePerTruck, true)}/veíc`
                        : formatBRL(proposalPricePerTruck, true);
                    })()
              }
            </Badge>
          </div>
          
          {/* Valor original do frete — usa pipeline centralizado */}
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Valor original:</span>
            <span className="text-muted-foreground">
              {(() => {
                const pd = getFreightPriceDisplay({
                  price: freight.price || 0,
                  pricing_type: freight.pricing_type,
                  price_per_km: freight.price_per_km,
                  required_trucks: freight.required_trucks,
                  distance_km: freight.distance_km,
                  weight: freight.weight,
                });
                return pd.primaryLabel;
              })()}
            </span>
          </div>
          
          {minAnttPerTruck > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mínimo ANTT:</span>
              <span className={belowAntt ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                {formatBRL(minAnttPerTruck, true)}
              </span>
            </div>
          )}
          
          {/* Info de múltiplas carretas */}
          {multipleTrucks && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="h-3 w-3" />
                <span>Frete com {requiredTrucks} carretas • Proposta para 1 unidade</span>
              </div>
            </div>
          )}
        </div>

        {/* Aviso ANTT Expandido */}
        {belowAntt && freight.minimum_antt_price && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold text-destructive">
                  ⚠️ Valor Abaixo do Mínimo ANTT
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta proposta está <span className="font-bold">{formatBRL(minAnttPerTruck - proposalPricePerTruck, true)}</span> abaixo do valor mínimo estabelecido pela ANTT{multipleTrucks ? ' por carreta' : ''}.
                </p>
                <p className="text-xs text-muted-foreground">
                  Mínimo ANTT{multipleTrucks ? ' /carreta' : ''}: <span className="font-semibold">{formatBRL(minAnttPerTruck, true)}</span>
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
        {proposal.status === 'PENDING' && (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReject(proposal.id);
              }}
              disabled={loadingAction.proposalId === proposal.id}
              className="h-10 w-full justify-center rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-all duration-200 font-medium text-xs sm:text-sm"
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
              onClick={(e) => {
                e.stopPropagation();
                onCounterProposal(proposal);
              }}
              className="h-10 w-full justify-center rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:border-primary shadow-sm transition-all duration-200 font-medium text-xs sm:text-sm"
              data-testid="counter-proposal-button"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Contraproposta
            </Button>
            
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAccept(proposal);
              }}
              disabled={!canAccept || loadingAction.proposalId === proposal.id}
              className="h-10 w-full justify-center rounded-xl shadow-sm transition-all duration-200 font-medium text-xs sm:text-sm sm:col-span-2 lg:col-span-1"
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
                  {!canAccept ? 'Sem vagas' : 'Aceitar Proposta'}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Contraproposta recebida */}
        {proposal.status === 'COUNTER_PROPOSED' && (
          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Contraproposta recebida — escolha aceitar ou rejeitar</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(proposal.id);
                }}
                disabled={loadingAction.proposalId === proposal.id}
                className="h-10 w-full justify-center rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-all duration-200 font-medium text-xs sm:text-sm"
                data-testid="reject-counter-proposal-button"
              >
                {loadingAction.proposalId === proposal.id && loadingAction.action === 'reject' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejeitando...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeitar contraproposta
                  </>
                )}
              </Button>

              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept(proposal);
                }}
                disabled={!canAccept || loadingAction.proposalId === proposal.id}
                className="h-10 w-full justify-center rounded-xl shadow-sm transition-all duration-200 font-medium text-xs sm:text-sm"
                data-testid="accept-counter-proposal-button"
              >
                {loadingAction.proposalId === proposal.id && loadingAction.action === 'accept' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {!canAccept ? 'Sem vagas' : 'Aceitar contraproposta'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
