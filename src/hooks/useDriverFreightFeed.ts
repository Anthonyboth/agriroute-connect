/**
 * src/hooks/useDriverFreightFeed.ts
 *
 * Hook de fonte única para o painel do MOTORISTA (autônomo e afiliado).
 * Envolve useUnifiedMatchFeed com a role e companyId corretos.
 *
 * Regras de visibilidade:
 * - MOTORISTA autônomo → RPC get_freights_for_driver (filtragem por cidade/raio/tipo)
 * - MOTORISTA afiliado SEM canAcceptFreights → fretes da transportadora (company feed)
 * - MOTORISTA afiliado COM canAcceptFreights → feed autônomo normal
 * - active_mode !== 'MOTORISTA'/'MOTORISTA_AFILIADO' → lista vazia
 *
 * NÃO retorna service_requests. Apenas freights.
 */

import { useAuth } from './useAuth';
import { useCompanyDriver } from './useCompanyDriver';
import { useDriverPermissions } from './useDriverPermissions';
import { useUnifiedMatchFeed, type UnifiedMatchItem } from './match/useUnifiedMatchFeed';
import { usePanelFeedSegregation } from './match/usePanelFeedSegregation';
import { invalidateSmartCacheByPrefix } from './useSmartQuery';

export interface DriverFreightFeedItem extends UnifiedMatchItem {
  kind: 'FREIGHT';
}

export interface UseDriverFreightFeedResult {
  freights: DriverFreightFeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refresh: (reason: 'manual' | 'login' | 'focus' | 'interval') => Promise<void>;
  markAction: (item: UnifiedMatchItem, action: 'accepted' | 'rejected' | 'hidden') => void;
  /** Motorista está restrito ao feed da transportadora (afiliado sem canAcceptFreights) */
  isCompanyRestricted: boolean;
  /** Motorista não tem cidades configuradas */
  hasNoCities: boolean;
}

export function useDriverFreightFeed(): UseDriverFreightFeedResult {
  const { profile } = useAuth();
  const { isCompanyDriver, companyId, isAffiliated } = useCompanyDriver();
  const { canAcceptFreights } = useDriverPermissions();

  // Validar active_mode (respeitar modo ativo, não apenas role cadastrada)
  const activeMode = profile?.active_mode || profile?.role;
  const isDriverMode = ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(activeMode || '');

  // Motorista afiliado SEM permissão de aceitar fretes autônomos
  // → usa company feed (vê apenas fretes da transportadora)
  const isCompanyRestricted = !!(isCompanyDriver && companyId && !canAcceptFreights);
  const effectiveCompanyId = isCompanyRestricted ? companyId : undefined;

  const feedRole: 'MOTORISTA' | 'TRANSPORTADORA' = 'MOTORISTA';

  const feed = useUnifiedMatchFeed({
    role: feedRole,
    companyId: effectiveCompanyId || undefined,
    enabled: isDriverMode && !!profile?.id,
  });

  const segregation = usePanelFeedSegregation({
    role: 'MOTORISTA',
    items: feed.items,
    debugLabel: 'useDriverFreightFeed',
  });

  const freights = segregation.segregatedItems as DriverFreightFeedItem[];

  return {
    freights,
    isLoading: feed.isLoading,
    isRefreshing: feed.isRefreshing,
    error: feed.error,
    lastUpdatedAt: feed.lastUpdatedAt,
    refresh: feed.refresh,
    markAction: feed.markAction,
    isCompanyRestricted,
    hasNoCities: !feed.isLoading && freights.length === 0,
  };
}

/** Invalida o cache do feed de motoristas (ex: após aceitar frete ou mudar cidades) */
export function invalidateDriverFreightFeedCache(): void {
  invalidateSmartCacheByPrefix('freights:driver:');
  invalidateSmartCacheByPrefix('freights:company:');
}
