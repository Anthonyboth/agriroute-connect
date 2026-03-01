/**
 * MadeProposalsList.tsx
 * 
 * Lista de propostas FEITAS pelo usuário em fretes de terceiros.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { MapPin, DollarSign, Package, Clock, CheckCircle, XCircle, ArrowRight, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/formatters';
import { useMyMadeProposals, type MadeProposal } from '@/hooks/useMyMadeProposals';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface MadeProposalsListProps {
  userId?: string;
  driverIds?: string[];
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'PENDING':
      return { label: '⏳ Pendente', variant: 'secondary' as const, color: 'text-yellow-600' };
    case 'COUNTER_PROPOSED':
      return { label: '🔄 Contraproposta', variant: 'outline' as const, color: 'text-orange-600' };
    case 'ACCEPTED':
      return { label: '✅ Aceita', variant: 'default' as const, color: 'text-green-600' };
    case 'REJECTED':
      return { label: '❌ Rejeitada', variant: 'destructive' as const, color: 'text-red-600' };
    default:
      return { label: status, variant: 'outline' as const, color: 'text-muted-foreground' };
  }
};

export const MadeProposalsList: React.FC<MadeProposalsListProps> = ({ userId, driverIds }) => {
  const { proposals, loading, pendingCount } = useMyMadeProposals({
    userId,
    driverIds,
    enabled: !!(userId || (driverIds && driverIds.length > 0)),
  });

  if (loading) return <CenteredSpinner />;

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center">
          <Send className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Nenhuma proposta enviada</h3>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            Quando você enviar propostas para fretes de outros usuários, elas aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {proposals.length} proposta{proposals.length !== 1 ? 's' : ''} enviada{proposals.length !== 1 ? 's' : ''}
        </p>
        {pendingCount > 0 && (
          <Badge variant="secondary">
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="grid gap-3">
        {proposals.map((proposal) => (
          <MadeProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
};

const MadeProposalCard: React.FC<{ proposal: MadeProposal }> = ({ proposal }) => {
  const statusConfig = getStatusConfig(proposal.status);
  const freight = proposal.freight;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header: status + date */}
        <div className="flex items-center justify-between">
          <Badge variant={statusConfig.variant} className="text-xs">
            {statusConfig.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {/* Route */}
        {freight && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{([freight.origin_city, freight.origin_state].filter(Boolean).join('/') || freight.origin_address || 'Origem não informada')}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{([freight.destination_city, freight.destination_state].filter(Boolean).join('/') || freight.destination_address || 'Destino não informado')}</span>
          </div>
        )}

        {/* Cargo + prices */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{freight?.cargo_type || 'N/A'}</span>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold text-primary">
                R$ {formatBRL(proposal.proposed_price)}
              </span>
            </div>
            {freight?.id && (
              <span className="text-xs text-muted-foreground line-through">
                {precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText}
              </span>
            )}
          </div>
        </div>

        {/* Owner name */}
        {proposal.freight_owner?.full_name && (
          <p className="text-xs text-muted-foreground">
            Frete de: {proposal.freight_owner.full_name}
          </p>
        )}

        {/* Message */}
        {proposal.message && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground line-clamp-2">{proposal.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
