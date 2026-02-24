import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type FeedPanelRole = 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA';

interface GuaranteedMarketplaceFeedParams {
  profile: any;
  freightLimit?: number;
  serviceLimit?: number;
  debug?: boolean;
  /** Força o papel do feed quando active_mode estiver inconsistente com o painel atual */
  roleOverride?: FeedPanelRole;
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
      console.error('[useGuaranteedMarketplaceFeed] Falha ao resolver auth user para blindagem de cidade:', error);
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
  }: GuaranteedMarketplaceFeedParams): Promise<GuaranteedMarketplaceResult> => {
    const rawPanel = roleOverride || profile?.active_mode || profile?.role || 'TRANSPORTADORA';
    const panel = String(rawPanel).toUpperCase();
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
      debug: {
        freight: null,
        service: null,
        excludedItems: [],
      },
    };

    const resolvedUserId = await resolveAuthenticatedUserId(profile);
    if (!resolvedUserId) {
      if (import.meta.env.DEV) {
        console.error('[useGuaranteedMarketplaceFeed] BLOQUEADO: não foi possível resolver user_id autenticado para feed autoritativo. Retornando feed vazio (fail-closed).', {
          panel,
          profile_id: profile?.id,
        });
      }
      return emptyResult;
    }

    const { data, error } = await supabase.rpc('get_authoritative_feed', {
      p_user_id: resolvedUserId,
      p_role: panel,
      p_debug: debug,
    });

    if (error) throw error;

    const payload = (data || {}) as any;

    let freights = Array.isArray(payload?.freights) ? payload.freights.slice(0, freightLimit) : [];
    let serviceRequests = Array.isArray(payload?.service_requests) ? payload.service_requests.slice(0, serviceLimit) : [];

    // 🔒 Blindagem estrita por cidade para perfis individuais (fail-closed)
    // Evita vazamento de itens fora das cidades explicitamente marcadas pelo usuário.
    const shouldEnforceStrictCity = panel === 'MOTORISTA' || panel === 'MOTORISTA_AFILIADO' || panel === 'PRESTADOR_SERVICOS';
    if (shouldEnforceStrictCity) {
      const { data: userCities, error: userCitiesError } = await supabase
        .from('user_cities')
        .select('city_id')
        .eq('user_id', resolvedUserId)
        .eq('is_active', true);

      if (userCitiesError) {
        // Fail-closed: se não conseguimos validar cidades ativas, não exibimos itens.
        console.error('[useGuaranteedMarketplaceFeed] Falha ao carregar user_cities. Aplicando fail-closed para evitar vazamento regional.', {
          panel,
          user_id: resolvedUserId,
          error: userCitiesError,
        });
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
      role: String(payload?.metrics?.role || panel),
    };

    const debugPayload = payload?.debug || null;

    if (import.meta.env.DEV) {
      if (metrics.fallback_used && (freights.length > 0 || serviceRequests.length > 0)) {
        console.error('[FeedIntegrity] Fallback autoritativo ativado: itens exibidos via fail-safe simplificado.', {
          role: metrics.role,
          freights: freights.length,
          services: serviceRequests.length,
          eligible: metrics.feed_total_eligible,
          displayed: metrics.feed_total_displayed,
        });
      }

      if (debug) {
        console.group('🔍 [useGuaranteedMarketplaceFeed] Authoritative Feed Debug');
        console.log('Fretes:', freights.length, 'Serviços:', serviceRequests.length);
        console.log('Tipos urbanos permitidos (perfil):', allowedTransportTypes);
        console.log('Metrics:', metrics);
        if (debugPayload?.freight) console.log('Debug freight:', debugPayload.freight);
        if (debugPayload?.service) console.log('Debug service:', debugPayload.service);
        console.groupEnd();
      }
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

