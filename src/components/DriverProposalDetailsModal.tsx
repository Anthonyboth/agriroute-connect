import React, { Suspense, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { User, Package, MapPin, Calendar, DollarSign, MessageSquare, Phone, XCircle, TrendingUp, TrendingDown, CheckCircle, Truck } from 'lucide-react';
import { formatBRL, formatKm, formatDate } from '@/lib/formatters';
import { UI_TEXTS } from '@/lib/ui-texts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { formatPriceForUser, type PriceContext } from '@/security/multiTruckPriceGuard';
import { SafeStatusBadge, SafePrice } from '@/components/security';

// Lazy load ProposalChatPanel with retry for chunk loading resilience
const ProposalChatPanel = lazyWithRetry(() => 
  import('@/components/proposal/ProposalChatPanel').then(m => ({ default: m.ProposalChatPanel }))
);

interface ProposalForModal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  proposal_unit_price?: number | null;
  proposal_pricing_type?: string | null;
  status: string;
  created_at: string;
  message?: string;
  freight: {
    id: string;
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    price: number;
    distance_km: number;
    weight: number;
    producer_id: string | null;
    required_trucks?: number;
    pricing_type?: string;
    price_per_km?: number;
    producer?: {
      id: string;
      full_name: string;
      rating?: number;
      total_ratings?: number;
      contact_phone?: string;
      farm_name?: string;
    };
  };
}

interface CounterOffer {
  id: string;
  freight_id: string;
  counter_proposed_price: string;
  message?: string;
  created_at: string;
}

interface DriverProposalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ProposalForModal | null;
  counterOffers: CounterOffer[];
  onCancelProposal: (proposalId: string) => Promise<void>;
  onAcceptCounterOffer: (counterOfferId: string) => Promise<void>;
  onRejectCounterOffer: (counterOfferId: string) => Promise<void>;
}

export const DriverProposalDetailsModal: React.FC<DriverProposalDetailsModalProps> = ({
  isOpen,
  onClose,
  proposal,
  counterOffers,
  onCancelProposal,
  onAcceptCounterOffer,
  onRejectCounterOffer,
}) => {
  // ✅ SEGURANÇA: Multi-carreta - calcular preço POR CARRETA para o motorista
  const requiredTrucks = proposal?.freight?.required_trucks || 1;
  const isMultiTruck = requiredTrucks > 1;

  // ✅ SEGURANÇA: Usar multiTruckPriceGuard para exibir preço correto ao motorista
  const freightPriceGuard = useMemo(() => formatPriceForUser({
    freightPrice: proposal?.freight?.price ?? 0,
    requiredTrucks,
    agreedPrice: proposal?.proposed_price ?? null,
    context: 'DRIVER' as PriceContext,
  }), [proposal?.freight?.price, requiredTrucks, proposal?.proposed_price]);

  // Preço original do frete POR CARRETA (para comparação)
  const originalPricePerTruck = useMemo(() => {
    const result = formatPriceForUser({
      freightPrice: proposal?.freight?.price ?? 0,
      requiredTrucks,
      agreedPrice: null,
      context: 'DRIVER' as PriceContext,
    });
    return result;
  }, [proposal?.freight?.price, requiredTrucks]);

  if (!proposal) return null;

  // ✅ SEGURANÇA: Diferença de preço calculada POR CARRETA (não total)
  const priceDiff = proposal.proposed_price - originalPricePerTruck.displayPrice;
  const relevantCounterOffers = counterOffers.filter(co => co.freight_id === proposal.freight_id);
  const hasRegisteredProducer = Boolean(proposal.freight?.producer_id || proposal.freight?.producer?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="driver-proposal-details-dialog"
      >
        <DialogHeader>
          <DialogTitle>{UI_TEXTS.DETALHES_PROPOSTA}</DialogTitle>
          <DialogDescription>
            Proposta enviada {formatDistanceToNow(new Date(proposal.created_at), {
              addSuffix: true,
              locale: ptBR
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 1. INFORMAÇÕES DO PRODUTOR */}
          {proposal.freight.producer && (
            <>
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-3">
                  {UI_TEXTS.INFORMACOES_PRODUTOR}
                </h4>
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback>
                      <User className="h-7 w-7" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {proposal.freight.producer.full_name}
                    </h3>
                    {proposal.freight.producer.rating ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <span className="text-base">{proposal.freight.producer.rating.toFixed(1)}★</span>
                        {proposal.freight.producer.total_ratings && (
                          <span>({proposal.freight.producer.total_ratings} avaliações)</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-1">
                        {UI_TEXTS.SEM_AVALIACOES}
                      </div>
                    )}
                    {proposal.freight.producer.farm_name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Fazenda: {proposal.freight.producer.farm_name}
                      </p>
                    )}
                    {proposal.freight.producer.contact_phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="mt-2 h-8"
                      >
                        <a
                          href={`https://wa.me/55${proposal.freight.producer.contact_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Phone className="h-3 w-3 mr-1" />
                          {UI_TEXTS.CONTATAR_PRODUTOR}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* 2. INFORMAÇÕES DO FRETE */}
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-3">
              {UI_TEXTS.INFORMACOES_FRETE}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="h-4 w-4" />
                  {UI_TEXTS.TIPO_CARGA}
                </div>
                <p className="text-base font-semibold pl-6">
                  {proposal.freight.cargo_type}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {UI_TEXTS.DISTANCIA}
                </div>
                <p className="text-base font-semibold pl-6">
                  {formatKm(proposal.freight.distance_km)}
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">
                  {UI_TEXTS.ORIGEM}
                </div>
                <p className="text-sm">{proposal.freight.origin_address}</p>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">
                  {UI_TEXTS.DESTINO}
                </div>
                <p className="text-sm">{proposal.freight.destination_address}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {UI_TEXTS.DATA_COLETA}
                </div>
                <p className="text-sm pl-6">{formatDate(proposal.freight.pickup_date)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* 3. VALORES - ✅ SEGURANÇA: Usa multiTruckPriceGuard */}
          <div>
            {/* ✅ Aviso multi-carreta */}
            {isMultiTruck && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  Frete com {requiredTrucks} carretas
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Valores exibidos na unidade original do frete.
                </p>
              </div>
            )}

            {(() => {
              const freightPricingType = proposal.freight?.pricing_type;
              const freightUnitPrice = proposal.freight?.price_per_km; // valor unitário do frete (usado para km e ton)
              const unitLabel = freightPricingType === 'PER_TON' ? '/ton' : freightPricingType === 'PER_KM' ? '/km' : '';
              
              // Valor original do frete: unitário se disponível
              const originalDisplay = freightUnitPrice && unitLabel
                ? `R$ ${freightUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unitLabel}`
                : originalPricePerTruck.formattedPrice;
              
              // Proposta do motorista: usar unit_price se disponível, senão derivar do total
              let driverUnitPrice = proposal.proposal_unit_price;
              const driverPricingType = proposal.proposal_pricing_type;
              const effectivePricingType = (driverPricingType && driverPricingType !== 'FIXED') 
                ? driverPricingType 
                : freightPricingType;
              
              // Derivar valor unitário se não disponível diretamente
              if (!driverUnitPrice && effectivePricingType && effectivePricingType !== 'FIXED' && proposal.proposed_price) {
                const weight = proposal.freight?.weight;
                const distance = proposal.freight?.distance_km;
                if (effectivePricingType === 'PER_TON' && weight) {
                  const weightInTons = weight >= 1000 ? weight / 1000 : weight;
                  if (weightInTons > 0) driverUnitPrice = proposal.proposed_price / weightInTons;
                } else if (effectivePricingType === 'PER_KM' && distance) {
                  if (distance > 0) driverUnitPrice = proposal.proposed_price / distance;
                }
              }
              
              const effectiveUnitLabel = (effectivePricingType === 'PER_TON') ? '/ton' : (effectivePricingType === 'PER_KM') ? '/km' : unitLabel;
              
              const driverDisplay = driverUnitPrice && effectiveUnitLabel
                ? `R$ ${driverUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${effectiveUnitLabel}`
                : formatBRL(proposal.proposed_price, true);
              
              // Diferença calculada em valores unitários quando possível
              const diffValue = (driverUnitPrice && freightUnitPrice)
                ? driverUnitPrice - freightUnitPrice
                : priceDiff;
              const diffDisplay = unitLabel && driverUnitPrice && freightUnitPrice
                ? `${diffValue > 0 ? '+' : '-'}R$ ${Math.abs(diffValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unitLabel}`
                : `${diffValue > 0 ? '+' : '-'}${formatBRL(Math.abs(diffValue), true)}`;

              return (
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Valor do Frete{unitLabel ? ` (${unitLabel})` : ''}:
                    </span>
                    <span className="text-lg font-semibold">
                      {originalDisplay}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Sua Proposta{unitLabel ? ` (${unitLabel})` : ''}:
                    </span>
                    <Badge variant="default" className="text-xl px-4 py-1">
                      {driverDisplay}
                    </Badge>
                  </div>
                  {diffValue !== 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Diferença:</span>
                      <span className={diffValue > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        <div className="flex items-center gap-1">
                          {diffValue > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {diffDisplay}
                        </div>
                      </span>
                    </div>
                  )}

                  {/* ✅ Info multi-carreta */}
                  {isMultiTruck && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        <span>Frete com {requiredTrucks} carretas • Proposta para 1 unidade</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 4. MENSAGEM DA PROPOSTA */}
          {proposal.message && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Sua Mensagem
                </div>
                <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">
                  "{proposal.message}"
                </p>
              </div>
            </>
          )}

          {/* 5. CONTRAPROPOSTAS RECEBIDAS */}
          {hasRegisteredProducer && relevantCounterOffers.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  {UI_TEXTS.CONTRAPROPOSTAS_RECEBIDAS}
                </h4>
                <div className="space-y-3">
                  {relevantCounterOffers.map((counterOffer) => (
                    <div 
                      key={counterOffer.id} 
                      className="p-3 bg-primary/10 border border-primary/30 rounded-md"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          Novo valor sugerido pelo produtor:
                        </span>
                        <Badge variant="default" className="text-base px-3">
                          {formatBRL(parseFloat(counterOffer.counter_proposed_price), true)}
                        </Badge>
                      </div>
                      {counterOffer.message && (
                        <p className="text-sm text-muted-foreground italic mt-2">
                          "{counterOffer.message}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Recebida {formatDistanceToNow(new Date(counterOffer.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => onAcceptCounterOffer(counterOffer.id)}
                          data-testid="accept-counter-offer-button"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {UI_TEXTS.ACEITAR_CONTRAPROPOSTA}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRejectCounterOffer(counterOffer.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          {UI_TEXTS.REJEITAR_CONTRAPROPOSTA}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 6. STATUS DA PROPOSTA - ✅ SEGURANÇA: Usa SafeStatusBadge, NUNCA fallback em inglês */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <span className="text-sm font-medium">{UI_TEXTS.STATUS}:</span>
            <SafeStatusBadge
              status={proposal.status}
              type="proposal"
              showEmoji
            />
          </div>

          {/* CHAT DE NEGOCIAÇÃO */}
          <Separator />
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <MessageSquare className="h-4 w-4" />
              Chat de Negociação
            </div>
            {hasRegisteredProducer ? (
              <Suspense fallback={<CenteredSpinner className="h-32" />}>
                <ProposalChatPanel
                  proposalId={proposal.id}
                  currentUserId={proposal.driver_id}
                  currentUserName="Você"
                  userRole="driver"
                />
              </Suspense>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Este frete foi criado por solicitante sem cadastro. Chat e contraproposta ficam desabilitados.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-between sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {proposal.status === 'PENDING' && (
            <Button
              variant="destructive"
              onClick={() => onCancelProposal(proposal.id)}
              data-testid="cancel-proposal-button"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {UI_TEXTS.CANCELAR_PROPOSTA}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};