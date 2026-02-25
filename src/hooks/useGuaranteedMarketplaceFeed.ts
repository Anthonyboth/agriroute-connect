import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ExpiryBucket, SortOption } from '@/components/MarketplaceFilters';

type FeedPanelRole = 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA';

interface GuaranteedMarketplaceFeedParams {
  profile: any;
  freightLimit?: number;
  serviceLimit?: number;
  debug?: boolean;
  roleOverride?: FeedPanelRole;
  /** Filtros de marketplace */
  filterTypes?: string[];
  filterExpiryBucket?: ExpiryBucket;
  filterSort?: SortOption;
}

interface UnifiedFeedDebugSummary {
  total_candidates: number;
  total_eligible: number;
  total_excluded: number;
  excluded: Array<{
    item_type: 'FREIGHT' | 'SERVICE';
    item_id: string;
    service_type: string;
    reason: string;
  }>;
}

interface GuaranteedMarketplaceResult {
  freights: any[];
  serviceRequests: any[];
  allowedTransportTypes: string[];
  metrics: {
    feed_total_eligible: number;
    feed_total_displayed: number;
    fallback_used: boolean;
    role: string;
    filters?: { types: string[] | null; expiry_bucket: string; sort: string };
  };
  debug: {
    freight: UnifiedFeedDebugSummary | null;
    service: UnifiedFeedDebugSummary | null;
    excludedItems: Array<{
      item_type: 'FREIGHT' | 'SERVICE';
      item_id: string;
      service_type?: string;
      reason: string;
    }>;
  };
}

const TRANSPORT_SERVICE_TYPES = [
  'TRANSPORTE_PET',
  'ENTREGA_PACOTES',
  'GUINCHO',
  'MUDANCA',
  'FRETE_MOTO',
] as const;

export function useGuaranteedMarketplaceFeed() {
  const resolveAllowedTransportTypes = useCallback((profile: any): string[] => {
    const profileTypes = new Set<string>((profile?.service_types || []).map((t: string) => String(t).toUpperCase()));
    return TRANSPORT_SERVICE_TYPES.filter((t) => profileTypes.has(t));
  }, []);

  const resolveAuthenticatedUserId = useCallback(async (profile: any): Promise<string | null> => {
    if (profile?.user_id) return String(profile.user_id);
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('[useGuaranteedMarketplaceFeed] Falha ao resolver auth user:', error);
      return null;
    }
    return data?.user?.id || null;
  }, []);

  const fetchAvailableMarketplaceItems = useCallback(async ({
    profile,
    freightLimit = 80,
    serviceLimit = 50,
    debug = false,
    roleOverride,
    filterTypes,
    filterExpiryBucket,
    filterSort,
  }: GuaranteedMarketplaceFeedParams): Promise<GuaranteedMarketplaceResult> => {
    const rawPanel = roleOverride || profile?.active_mode || profile?.role || 'TRANSPORTADORA';
    const panel = String(rawPanel).toUpperCase();
    const rpcRole: FeedPanelRole = (
      ['MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA'].includes(panel)
        ? panel
        : 'TRANSPORTADORA'
    ) as FeedPanelRole;
    const allowedTransportTypes = resolveAllowedTransportTypes(profile);

    const emptyResult: GuaranteedMarketplaceResult = {
      freights: [],
      serviceRequests: [],
      allowedTransportTypes,
      metrics: {
        feed_total_eligible: 0,
        feed_total_displayed: 0,
        fallback_used: false,
        role: panel,
      },
      debug: { freight: null, service: null, excludedItems: [] },
    };

    const resolvedUserId = await resolveAuthenticatedUserId(profile);
    if (!resolvedUserId) {
      if (import.meta.env.DEV) {
        console.error('[useGuaranteedMarketplaceFeed] BLOQUEADO: user_id não resolvido. Feed vazio (fail-closed).', { panel, profile_id: profile?.id });
      }
      return emptyResult;
    }

    const rpcParams = {
      p_user_id: resolvedUserId,
      p_role: rpcRole,
      p_debug: debug,
      p_types: (filterTypes && filterTypes.length > 0) ? filterTypes : undefined,
      p_expiry_bucket: (filterExpiryBucket && filterExpiryBucket !== 'ALL') ? filterExpiryBucket : undefined,
      p_sort: filterSort || undefined,
    };

    const { data, error } = await supabase.rpc('get_authoritative_feed', rpcParams);
    if (error) throw error;

    const payload = (data || {}) as any;

    let freights = Array.isArray(payload?.freights) ? payload.freights.slice(0, freightLimit) : [];
    let serviceRequests = Array.isArray(payload?.service_requests) ? payload.service_requests.slice(0, serviceLimit) : [];

    // Blindagem estrita por cidade para perfis individuais (fail-closed)
    const shouldEnforceStrictCity = panel === 'MOTORISTA' || panel === 'PRESTADOR_SERVICOS';
    if (shouldEnforceStrictCity) {
      const { data: userCities, error: userCitiesError } = await supabase
        .from('user_cities')
        .select('city_id')
        .eq('user_id', resolvedUserId)
        .eq('is_active', true);

      if (userCitiesError) {
        console.error('[useGuaranteedMarketplaceFeed] Falha ao carregar user_cities. Fail-closed.', { panel, user_id: resolvedUserId, error: userCitiesError });
        freights = [];
        serviceRequests = [];
      } else {
        const activeCityIds = new Set((userCities || []).map((uc: any) => String(uc.city_id)).filter(Boolean));
        if (activeCityIds.size === 0) {
          freights = [];
          serviceRequests = [];
        } else {
          freights = freights.filter((f: any) => {
            const originCityId = f?.origin_city_id ? String(f.origin_city_id) : '';
            return !!originCityId && activeCityIds.has(originCityId);
          });
          serviceRequests = serviceRequests.filter((s: any) => {
            const cityId = s?.city_id ? String(s.city_id) : '';
            return !!cityId && activeCityIds.has(cityId);
          });
        }
      }
    }

    const metrics = {
      feed_total_eligible: Number(payload?.metrics?.feed_total_eligible || 0),
      feed_total_displayed: freights.length + serviceRequests.length,
      fallback_used: Boolean(payload?.metrics?.fallback_used),
      role: panel,
      filters: payload?.metrics?.filters || undefined,
    };

    const debugPayload = payload?.debug || null;

    if (import.meta.env.DEV && debug) {
      console.group('🔍 [useGuaranteedMarketplaceFeed] Feed Debug');
      console.log('Fretes:', freights.length, 'Serviços:', serviceRequests.length);
      console.log('Filtros aplicados:', metrics.filters);
      console.log('Metrics:', metrics);
      if (debugPayload?.viewer) console.log('Viewer:', debugPayload.viewer);
      console.groupEnd();
    }

    return {
      freights,
      serviceRequests,
      allowedTransportTypes,
      metrics,
      debug: {
        freight: debug ? (debugPayload?.freight as UnifiedFeedDebugSummary) : null,
        service: debug ? (debugPayload?.service as UnifiedFeedDebugSummary) : null,
        excludedItems: debug ? (debugPayload?.excluded_items || []) : [],
      },
    };
  }, [resolveAllowedTransportTypes, resolveAuthenticatedUserId]);

  return {
    fetchAvailableMarketplaceItems,
    resolveAllowedTransportTypes,
  };
}
