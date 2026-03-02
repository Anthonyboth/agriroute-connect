/**
 * ServiceProposalSection.tsx
 * 
 * Seção de propostas e contrapropostas para serviços.
 * Usado tanto no painel do prestador quanto no painel do cliente.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSign, Send, Check, X, Clock, ChevronDown, ChevronUp, MessageSquare
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ServiceProposal } from '@/hooks/useServiceProposals';

interface ServiceProposalSectionProps {
  proposals: ServiceProposal[];
  currentUserProfileId: string;
  /** 'CLIENT' or 'PROVIDER' - role of the current user viewing this section */
  viewerRole: 'CLIENT' | 'PROVIDER';
  onSubmitProposal: (price: number, message?: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string, returnToOpen?: boolean) => void;
  submitting?: boolean;
  /** If true, shows compact inline version for cards */
  compact?: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-500' },
  ACCEPTED: { label: 'Aceita', color: 'bg-green-500' },
  REJECTED: { label: 'Rejeitada', color: 'bg-red-500' },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-500' },
};

export const ServiceProposalSection: React.FC<ServiceProposalSectionProps> = ({
  proposals,
  currentUserProfileId,
  viewerRole,
  onSubmitProposal,
  onAcceptProposal,
  onRejectProposal,
  submitting = false,
  compact = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Filter out REJECTED and CANCELLED proposals entirely - they're no longer relevant
  const activeProposals = proposals.filter(p => p.status === 'PENDING' || p.status === 'ACCEPTED');
  const pendingProposals = activeProposals.filter(p => p.status === 'PENDING');
  const otherProposals = activeProposals.filter(p => p.status !== 'PENDING');
  const myRejectedProposals: ServiceProposal[] = []; // No longer show rejected notices
  const hasPendingFromMe = pendingProposals.some(p => p.proposer_id === currentUserProfileId);

  const handleSubmit = () => {
    const numPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(numPrice) || numPrice <= 0) return;
    onSubmitProposal(numPrice, message || undefined);
    setPrice('');
    setMessage('');
    setShowForm(false);
  };

  if (compact) {
    // Compact view for cards in "Disponível" tab - show latest proposal price
    const latestPending = pendingProposals[0];
    if (!latestPending && activeProposals.length === 0) return null;

    return (
      <div className="space-y-1">
        {latestPending && (
          <div className="flex items-center gap-2 text-xs">
            <DollarSign className="h-3 w-3 text-blue-600" />
            <span className="font-medium text-blue-700 dark:text-blue-400">
              Proposta: {formatCurrency(latestPending.proposed_price)}
            </span>
            <span className="text-muted-foreground">
              por {latestPending.proposer_role === 'CLIENT' ? 'Cliente' : 'Prestador'}
            </span>
          </div>
        )}
        {pendingProposals.length > 1 && (
          <span className="text-[10px] text-muted-foreground">
            +{pendingProposals.length - 1} proposta(s) pendente(s)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-blue-50/50 dark:bg-blue-950/20">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-blue-600" />
          Propostas de Valor
          {pendingProposals.length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
              {pendingProposals.length}
            </Badge>
          )}
        </h4>
        {activeProposals.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Menos' : `${activeProposals.length} proposta(s)`}
          </Button>
        )}
      </div>

      {/* Pending proposals - always visible */}
      {pendingProposals.map(proposal => (
        <div key={proposal.id} className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(proposal.proposed_price)}
              </span>
              <Badge className={`${STATUS_LABELS[proposal.status].color} text-[10px] px-1.5 py-0`}>
                {STATUS_LABELS[proposal.status].label}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {proposal.proposer_role === 'CLIENT' ? '👤 Cliente' : '🔧 Prestador'}
            </span>
          </div>
          
          {proposal.proposer_name && (
            <p className="text-xs text-muted-foreground">
              Por: {proposal.proposer_name}
            </p>
          )}
          
          {proposal.message && (
            <div className="flex items-start gap-1.5 text-xs bg-muted/50 rounded px-2 py-1">
              <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span>{proposal.message}</span>
            </div>
          )}
          
          <p className="text-[10px] text-muted-foreground">
            <Clock className="inline h-2.5 w-2.5 mr-0.5" />
            {format(parseISO(proposal.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>

          {/* Action buttons - only for the OTHER party */}
          {proposal.status === 'PENDING' && proposal.proposer_id !== currentUserProfileId && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => onAcceptProposal(proposal.id)}
                disabled={submitting}
              >
                <Check className="h-3 w-3 mr-1" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 h-7 text-xs"
                onClick={() => onRejectProposal(proposal.id, viewerRole === 'CLIENT')}
                disabled={submitting}
              >
                <X className="h-3 w-3 mr-1" />
                Recusar
              </Button>
            </div>
          )}

          {proposal.status === 'PENDING' && proposal.proposer_id === currentUserProfileId && (
            <p className="text-[10px] text-amber-600 italic">
              Aguardando resposta...
            </p>
          )}
        </div>
      ))}

      {/* Historical proposals - collapsed by default */}
      {expanded && otherProposals.map(proposal => (
        <div key={proposal.id} className="bg-muted/30 rounded-lg p-2 border border-dashed space-y-1 opacity-70">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {formatCurrency(proposal.proposed_price)}
            </span>
            <Badge className={`${STATUS_LABELS[proposal.status].color} text-[10px] px-1.5 py-0`}>
              {STATUS_LABELS[proposal.status].label}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {proposal.proposer_role === 'CLIENT' ? 'Cliente' : 'Prestador'} • 
            {format(parseISO(proposal.created_at), " dd/MM HH:mm", { locale: ptBR })}
          </p>
          {proposal.rejection_reason && (
            <p className="text-[10px] text-red-500">Motivo: {proposal.rejection_reason}</p>
          )}
        </div>
      ))}

      {/* Show latest rejection notice to the provider */}
      {myRejectedProposals.length > 0 && !hasPendingFromMe && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2.5 text-xs">
          <p className="font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
            <X className="h-3 w-3" />
            Sua proposta de {formatCurrency(myRejectedProposals[0].proposed_price)} foi recusada
          </p>
          {myRejectedProposals[0].rejection_reason && (
            <p className="text-red-600/70 dark:text-red-400/70 mt-0.5">
              Motivo: {myRejectedProposals[0].rejection_reason}
            </p>
          )}
          <p className="text-muted-foreground mt-1">Você pode enviar uma nova proposta.</p>
        </div>
      )}

      {!hasPendingFromMe && (
        <>
          {!showForm ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-400"
              onClick={() => setShowForm(true)}
            >
              <DollarSign className="h-3 w-3 mr-1" />
              {viewerRole === 'PROVIDER' ? 'Propor Valor' : 'Oferecer Valor'}
            </Button>
          ) : (
            <div className="space-y-2 bg-white dark:bg-gray-900 rounded-lg p-2.5 border">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="h-8 text-sm pl-8"
                    autoFocus
                  />
                </div>
              </div>
              <Textarea
                placeholder="Mensagem opcional..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="h-16 text-xs resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmit}
                  disabled={submitting || !price}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Enviar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { setShowForm(false); setPrice(''); setMessage(''); }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
