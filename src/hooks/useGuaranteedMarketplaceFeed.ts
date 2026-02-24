import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GuaranteedMarketplaceFeedParams {
  profile: any;
  freightLimit?: number;
  serviceLimit?: number;
  debug?: boolean;
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

  const fetchAvailableMarketplaceItems = useCallback(async ({
    profile,
    freightLimit = 80,
    serviceLimit = 50,
    debug = false,
  }: GuaranteedMarketplaceFeedParams): Promise<GuaranteedMarketplaceResult> => {
    const panel = String(profile?.active_mode || profile?.role || 'TRANSPORTADORA').toUpperCase();
    const allowedTransportTypes = resolveAllowedTransportTypes(profile);

    const { data, error } = await supabase.rpc('get_authoritative_feed', {
      p_user_id: profile?.user_id || null,
      p_role: panel,
      p_debug: debug,
    });

    if (error) throw error;

    const payload = (data || {}) as any;
    const freights = Array.isArray(payload?.freights) ? payload.freights.slice(0, freightLimit) : [];
    const serviceRequests = Array.isArray(payload?.service_requests) ? payload.service_requests.slice(0, serviceLimit) : [];

    const metrics = {
      feed_total_eligible: Number(payload?.metrics?.feed_total_eligible || 0),
      feed_total_displayed: Number(payload?.metrics?.feed_total_displayed || freights.length + serviceRequests.length),
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
  }, [resolveAllowedTransportTypes]);

  return {
    fetchAvailableMarketplaceItems,
    resolveAllowedTransportTypes,
  };
}

