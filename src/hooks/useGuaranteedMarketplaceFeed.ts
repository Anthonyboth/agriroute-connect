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
  debug: {
    freight: UnifiedFeedDebugSummary | null;
    service: UnifiedFeedDebugSummary | null;
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
    const resolvedCompanyId = profile?.company_id || null;

    if (panel === 'TRANSPORTADORA' && !resolvedCompanyId) {
      throw new Error('Configuração inválida: p_company_id é obrigatório para TRANSPORTADORA.');
    }

    // ✅ RPCs DETERMINÍSTICAS — nunca escondem itens elegíveis
    const [freightRpc, serviceRpc] = await Promise.all([
      supabase.rpc('get_unified_freight_feed', {
        p_panel: panel === 'TRANSPORTADORA' ? 'TRANSPORTADORA' : 'MOTORISTA',
        p_profile_id: profile?.id,
        p_company_id: resolvedCompanyId,
        p_debug: debug,
      }),
      supabase.rpc('get_unified_service_feed', {
        p_profile_id: profile?.id,
        p_debug: debug,
      }),
    ]);

    if (freightRpc.error) throw freightRpc.error;
    if (serviceRpc.error) {
      console.warn('[useGuaranteedMarketplaceFeed] Service RPC falhou (não bloqueante):', serviceRpc.error);
    }

    const freightPayload = (freightRpc.data || {}) as any;
    const servicePayload = (serviceRpc.data || {}) as any;

    const freights = Array.isArray(freightPayload.items) ? freightPayload.items.slice(0, freightLimit) : [];

    // Para transportadora: mantemos apenas serviços urbanos de transporte
    const rawServices = Array.isArray(servicePayload?.items) ? servicePayload.items : [];
    const serviceRequests = rawServices
      .filter((item: any) => allowedTransportTypes.includes(String(item.service_type || '').toUpperCase()))
      .slice(0, serviceLimit);

    if (debug && import.meta.env.DEV) {
      console.group('🔍 [useGuaranteedMarketplaceFeed] Debug');
      console.log('Fretes:', freights.length, 'Serviços:', serviceRequests.length);
      console.log('Tipos urbanos permitidos:', allowedTransportTypes);
      if (freightPayload.debug) console.log('Debug freight:', freightPayload.debug);
      if (servicePayload?.debug) console.log('Debug service:', servicePayload.debug);
      console.groupEnd();
    }

    return {
      freights,
      serviceRequests,
      allowedTransportTypes,
      debug: {
        freight: debug ? (freightPayload.debug as UnifiedFeedDebugSummary) : null,
        service: debug ? (servicePayload?.debug as UnifiedFeedDebugSummary) : null,
      },
    };
  }, [resolveAllowedTransportTypes]);

  return {
    fetchAvailableMarketplaceItems,
    resolveAllowedTransportTypes,
  };
}
