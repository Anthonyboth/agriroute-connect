/**
 * src/components/security/SafeStatusBadge.tsx
 *
 * Componente OBRIGATÓRIO para exibição de status em telas de frete/proposta.
 * Internamente aplica:
 *   - guardStatusDisplay() do i18nGuard
 *   - Fallback PT-BR (NUNCA renderiza string crua em inglês)
 *   - Variante de cor baseada no status
 *
 * PROIBIDO exibir status diretamente — use este componente.
 */

import React, { useMemo } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { guardStatusDisplay } from '@/security/i18nGuard';
import { getFreightStatusVariant } from '@/lib/freight-status';

// =============================================================================
// TIPOS
// =============================================================================

interface SafeStatusBadgeProps {
  /** Status cru (pode vir em inglês do banco) */
  status: string;
  /** Tipo de status para determinar variante de cor */
  type?: 'freight' | 'proposal' | 'payment' | 'assignment';
  /** Emoji/ícone prefix (ex: ✅, ⏳) */
  showEmoji?: boolean;
  /** Classes adicionais */
  className?: string;
  /** Variante forçada (ignora auto-detecção) */
  variant?: BadgeProps['variant'];
  /** Tamanho */
  size?: 'sm' | 'md';
}

// Mapa de emojis por status
const STATUS_EMOJIS: Record<string, string> = {
  NEW: '🆕',
  APPROVED: '✅',
  OPEN: '📂',
  ACCEPTED: '🤝',
  LOADING: '🚛',
  LOADED: '📦',
  IN_TRANSIT: '🛣️',
  DELIVERED_PENDING_CONFIRMATION: '📋',
  DELIVERED: '✅',
  COMPLETED: '🏁',
  CANCELLED: '❌',
  REJECTED: '🚫',
  PENDING: '⏳',
  EXPIRED: '⏰',
  PROCESSING: '⚙️',
  FAILED: '⚠️',
  CONFIRMED: '✅',
  PAID_BY_PRODUCER: '💰',
  PROPOSED: '💬',
  REFUNDED: '↩️',
  ACTIVE: '🟢',
  INACTIVE: '🔴',
  WAITING: '⏳',
};

// Variantes para propostas
function getProposalVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toUpperCase().trim();
  switch (normalized) {
    case 'ACCEPTED':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'destructive';
    default:
      return 'outline';
  }
}

// Variantes para pagamentos
function getPaymentVariant(status: string): BadgeProps['variant'] {
  const normalized = status.toUpperCase().trim();
  switch (normalized) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'default';
    case 'PAID_BY_PRODUCER':
    case 'PROCESSING':
    case 'PENDING':
      return 'secondary';
    case 'FAILED':
    case 'REFUNDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const SafeStatusBadge: React.FC<SafeStatusBadgeProps> = ({
  status,
  type = 'freight',
  showEmoji = false,
  className = '',
  variant: forcedVariant,
  size = 'md',
}) => {
  // ✅ SEGURANÇA: Traduzir via guardStatusDisplay (NUNCA retorna inglês cru)
  const translatedStatus = useMemo(() => guardStatusDisplay(status), [status]);

  // Determinar variante de cor
  const autoVariant = useMemo((): BadgeProps['variant'] => {
    switch (type) {
      case 'freight':
        return getFreightStatusVariant(status) as BadgeProps['variant'];
      case 'proposal':
        return getProposalVariant(status);
      case 'payment':
        return getPaymentVariant(status);
      case 'assignment':
        return getProposalVariant(status);
      default:
        return 'outline';
    }
  }, [status, type]);

  const variant = forcedVariant || autoVariant;
  const emoji = showEmoji ? STATUS_EMOJIS[status.toUpperCase().trim()] || '' : '';
  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Badge
      variant={variant}
      className={`font-medium whitespace-nowrap ${sizeClass} ${className}`}
      data-raw-status={status}
    >
      {emoji && <span className="mr-1">{emoji}</span>}
      {translatedStatus}
    </Badge>
  );
};
