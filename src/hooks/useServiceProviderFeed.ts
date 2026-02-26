/**
 * src/hooks/useServiceProviderFeed.ts
 *
 * Hook de fonte única para o painel do PRESTADOR DE SERVIÇOS.
 * Retorna APENAS service_requests — NUNCA freights.
 *
 * Regras de visibilidade:
 * - active_mode !== 'PRESTADOR_SERVICOS' → lista vazia (guard obrigatório)
 * - Disponíveis: RPC get_services_for_provider (status=OPEN, provider_id IS NULL,
 *   compatível com service_types e user_cities do prestador)
 * - Sem vazamento de freights, independente do role cadastrado
 *
 * Invalide o cache após:
 * - Aceitar um serviço
 * - Mudar user_cities
 * - Mudar service_types do perfil
 */

import { useAuth } from './useAuth';
import { useUnifiedMatchFeed, type UnifiedMatchItem } from './match/useUnifiedMatchFeed';
import { usePanelFeedSegregation } from './match/usePanelFeedSegregation';
import { invalidateSmartCacheByPrefix } from './useSmartQuery';

export interface ServiceProviderFeedItem extends UnifiedMatchItem {
  kind: 'SERVICE';
}

export interface UseServiceProviderFeedResult {
  services: ServiceProviderFeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refresh: (reason: 'manual' | 'login' | 'focus' | 'interval') => Promise<void>;
  markAction: (item: UnifiedMatchItem, action: 'accepted' | 'rejected' | 'hidden') => void;
  /** Prestador não tem cidades configuradas */
  hasNoCities: boolean;
  /** Prestador não tem tipos de serviço configurados */
  hasNoServiceTypes: boolean;
}

export function useServiceProviderFeed(): UseServiceProviderFeedResult {
  const { profile } = useAuth();

  // Guard obrigatório: apenas PRESTADOR_SERVICOS pode ver este feed
  const activeMode = profile?.active_mode || profile?.role;
  const isProviderMode = activeMode === 'PRESTADOR_SERVICOS';

  const feed = useUnifiedMatchFeed({
    role: 'PRESTADOR_SERVICOS',
    enabled: isProviderMode && !!profile?.id,
  });

  const segregation = usePanelFeedSegregation({
    role: 'PRESTADOR_SERVICOS',
    items: feed.items,
    debugLabel: 'useServiceProviderFeed',
  });

  const services = segregation.segregatedItems as ServiceProviderFeedItem[];

  const hasNoCities = !feed.isLoading && services.length === 0;
  const hasNoServiceTypes = !profile?.service_types || profile.service_types.length === 0;

  if (import.meta.env.DEV) {
    console.group('[useServiceProviderFeed] Estado');
    console.log({
      activeMode,
      isProviderMode,
      total_items: feed.items.length,
      services: services.length,
      isLoading: feed.isLoading,
      error: feed.error,
      hasNoCities,
      hasNoServiceTypes,
    });
    console.groupEnd();
  }

  return {
    services,
    isLoading: feed.isLoading,
    isRefreshing: feed.isRefreshing,
    error: feed.error,
    lastUpdatedAt: feed.lastUpdatedAt,
    refresh: feed.refresh,
    markAction: feed.markAction,
    hasNoCities,
    hasNoServiceTypes,
  };
}

/** Invalida o cache do feed de prestadores (ex: após aceitar serviço ou mudar cidades/tipos) */
export function invalidateServiceProviderFeedCache(): void {
  invalidateSmartCacheByPrefix('services:provider:');
}
