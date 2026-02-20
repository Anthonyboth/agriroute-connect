/**
 * src/hooks/useCompanyFreightFeed.ts
 *
 * Hook de fonte única para o painel da TRANSPORTADORA.
 * Fretes em andamento: freight_assignments.company_id = minha empresa.
 * Fretes disponíveis: feed da plataforma (OPEN, com vagas).
 *
 * NÃO retorna service_requests no contexto de frete rural.
 * Service_requests de transporte urbano (PET, Pacotes) são tratados
 * separadamente em SmartFreightMatcher para a transportadora.
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useUnifiedMatchFeed, type UnifiedMatchItem } from './match/useUnifiedMatchFeed';
import { invalidateSmartCacheByPrefix } from './useSmartQuery';

export interface CompanyFreightFeedItem extends UnifiedMatchItem {
  kind: 'FREIGHT';
}

export interface UseCompanyFreightFeedResult {
  freights: CompanyFreightFeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refresh: (reason: 'manual' | 'login' | 'focus' | 'interval') => Promise<void>;
  markAction: (item: UnifiedMatchItem, action: 'accepted' | 'rejected' | 'hidden') => void;
}

export function useCompanyFreightFeed(companyId?: string): UseCompanyFreightFeedResult {
  const { profile } = useAuth();

  const activeMode = profile?.active_mode || profile?.role;
  const isCarrierMode = activeMode === 'TRANSPORTADORA';

  const feed = useUnifiedMatchFeed({
    role: 'TRANSPORTADORA',
    companyId: companyId,
    enabled: isCarrierMode && !!profile?.id,
  });

  // Filtrar apenas FREIGHT (nunca SERVICE — UI da transportadora decide se quer misturar)
  const freights = useMemo(
    () => feed.items.filter((i): i is CompanyFreightFeedItem => i.kind === 'FREIGHT'),
    [feed.items]
  );

  if (import.meta.env.DEV && feed.items.length !== freights.length) {
    console.warn(
      '[useCompanyFreightFeed] AVISO: Itens SERVICE encontrados no feed da transportadora.',
      { total: feed.items.length, freights: freights.length }
    );
  }

  return {
    freights,
    isLoading: feed.isLoading,
    isRefreshing: feed.isRefreshing,
    error: feed.error,
    lastUpdatedAt: feed.lastUpdatedAt,
    refresh: feed.refresh,
    markAction: feed.markAction,
  };
}

/** Invalida o cache do feed de transportadoras */
export function invalidateCompanyFreightFeedCache(companyId?: string): void {
  if (companyId) {
    invalidateSmartCacheByPrefix(`freights:company:${companyId}`);
  } else {
    invalidateSmartCacheByPrefix('freights:company:');
  }
}
