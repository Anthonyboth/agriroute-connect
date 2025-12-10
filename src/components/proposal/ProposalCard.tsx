import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, DollarSign, Truck, User, MapPin, AlertTriangle, CheckCircle, XCircle, MessageSquare, Loader2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/formatters';
import { useProposalChatUnreadCount } from '@/hooks/useProposalChatUnreadCount';

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

  const availableSlots = freight.required_trucks - freight.accepted_trucks;
  const belowAntt = freight.minimum_antt_price && proposal.proposed_price < freight.minimum_antt_price;
  const timeAgo = formatDistanceToNow(new Date(proposal.created_at), { 
    addSuffix: true, 
    locale: ptBR 
  });
  const canAccept = availableSlots > 0 && freight.status !== 'CANCELLED';

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
      className="mb-4 transition-colors cursor-pointer hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
      data-testid="proposal-card"
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={proposal.driver?.profile_photo_url} />
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
        {proposal.status === 'PENDING' && (
          <div className="mt-4 flex gap-2 justify-end flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReject(proposal.id);
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                onCounterProposal(proposal);
              }}
              className="border-primary text-primary hover:bg-primary/10"
              data-testid="counter-proposal-button"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Fazer Contraproposta
            </Button>
            
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAccept(proposal);
              }}
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
