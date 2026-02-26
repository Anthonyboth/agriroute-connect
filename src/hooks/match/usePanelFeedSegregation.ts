import { useMemo } from 'react';
import type { UnifiedMatchItem, UnifiedMatchRole } from './useUnifiedMatchFeed';

export type MarketplaceItemKind = UnifiedMatchItem['kind'];

export interface UsePanelFeedSegregationOptions {
  role: UnifiedMatchRole;
  items: UnifiedMatchItem[];
  debugLabel?: string;
}

export interface UsePanelFeedSegregationResult {
  allowedKinds: MarketplaceItemKind[];
  segregatedItems: UnifiedMatchItem[];
  blockedItems: UnifiedMatchItem[];
  hasBlockedItems: boolean;
}

const ROLE_ALLOWED_KINDS: Record<UnifiedMatchRole, MarketplaceItemKind[]> = {
  MOTORISTA: ['FREIGHT'],
  TRANSPORTADORA: ['FREIGHT'],
  PRESTADOR_SERVICOS: ['SERVICE'],
};

/**
 * Guarda central de segregação de marketplace por painel.
 * Impede qualquer mistura de SERVICE/FREIGHT entre feeds.
 */
export function usePanelFeedSegregation({
  role,
  items,
  debugLabel,
}: UsePanelFeedSegregationOptions): UsePanelFeedSegregationResult {
  const allowedKinds = ROLE_ALLOWED_KINDS[role];

  const segregatedItems = useMemo(
    () => items.filter((item) => allowedKinds.includes(item.kind)),
    [items, allowedKinds]
  );

  const blockedItems = useMemo(
    () => items.filter((item) => !allowedKinds.includes(item.kind)),
    [items, allowedKinds]
  );

  if (import.meta.env.DEV && blockedItems.length > 0) {
    console.group(`[FeedSegregationGuard] ${debugLabel || role}`);
    console.warn('Itens bloqueados por segregação de painel.');
    console.log('Permitidos:', allowedKinds);
    console.log(
      'Bloqueados:',
      blockedItems.map((item) => ({ id: item.id, kind: item.kind }))
    );
    console.groupEnd();
  }

  return {
    allowedKinds,
    segregatedItems,
    blockedItems,
    hasBlockedItems: blockedItems.length > 0,
  };
}
