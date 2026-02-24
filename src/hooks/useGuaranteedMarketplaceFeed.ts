import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  normalizeServiceType,
  getAllowedServiceTypesFromProfile,
  type CanonicalServiceType,
} from '@/lib/service-type-normalization';

const TRANSPORT_QUERY_TYPES = [
  'TRANSPORTE_PET',
  'ENTREGA_PACOTES',
  'GUINCHO',
  'REBOQUE',
  'GUINCHO_FREIGHT',
  'MUDANCA',
  'MUDANCAS',
  'MUDANCA_RESIDENCIAL',
  'MUDANCA_COMERCIAL',
  'FRETE_MOTO',
  'FRETE_URBANO',
] as const;

const OPEN_FREIGHT_STATUSES = ['OPEN', 'IN_NEGOTIATION'] as const;

interface GuaranteedMarketplaceFeedParams {
  profile: any;
  freightLimit?: number;
  serviceLimit?: number;
}

export function useGuaranteedMarketplaceFeed() {
  const resolveAllowedTransportTypes = useCallback((profile: any): string[] => {
    const allowedCanonical = getAllowedServiceTypesFromProfile(profile, 'TRANSPORTADORA');

    return TRANSPORT_QUERY_TYPES.filter((rawType) => {
      const canonical = normalizeServiceType(rawType);
      return allowedCanonical.includes(canonical as CanonicalServiceType);
    });
  }, []);

  const fetchUrbanServices = useCallback(async (allowedTransportTypes: string[], serviceLimit = 50) => {
    if (allowedTransportTypes.length === 0) return [];

    const secureQuery = await supabase
      .from('service_requests_secure')
      .select(
        `id, service_type, status, provider_id, location_address, destination_address,
         location_city, location_state, destination_city, destination_state,
         urgency, estimated_price, created_at, preferred_datetime, problem_description, contact_name`
      )
      .in('status', ['OPEN'])
      .is('provider_id', null)
      .in('service_type', allowedTransportTypes)
      .order('created_at', { ascending: false })
      .limit(serviceLimit);

    if (!secureQuery.error) {
      return secureQuery.data || [];
    }

    // Fallback defensivo: alguns ambientes podem negar SELECT na view segura.
    // Mantemos SELECT estrito em campos necessários da UI.
    const fallbackQuery = await supabase
      .from('service_requests')
      .select(
        `id, service_type, status, provider_id, location_address, destination_address,
         location_city, location_state, destination_city, destination_state,
         urgency, estimated_price, created_at, preferred_datetime, problem_description, contact_name`
      )
      .in('status', ['OPEN'])
      .is('provider_id', null)
      .in('service_type', allowedTransportTypes)
      .order('created_at', { ascending: false })
      .limit(serviceLimit);

    if (fallbackQuery.error) throw fallbackQuery.error;

    if (import.meta.env.DEV) {
      console.warn('[useGuaranteedMarketplaceFeed] Fallback para service_requests aplicado:', {
        secureError: secureQuery.error?.message,
        returned: fallbackQuery.data?.length || 0,
      });
    }

    return fallbackQuery.data || [];
  }, []);

  const fetchAvailableMarketplaceItems = useCallback(async ({
    profile,
    freightLimit = 80,
    serviceLimit = 50,
  }: GuaranteedMarketplaceFeedParams) => {
    const allowedTransportTypes = resolveAllowedTransportTypes(profile);

    const [freightsResult, services] = await Promise.all([
      supabase
        .from('freights')
        .select(
          `
          id, cargo_type, weight, origin_address, destination_address, origin_city, origin_state,
          destination_city, destination_state, pickup_date, delivery_date, price, urgency, status,
          distance_km, minimum_antt_price, service_type, required_trucks, accepted_trucks, created_at, driver_id
        `,
        )
        .in('status', OPEN_FREIGHT_STATUSES)
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(freightLimit),
      fetchUrbanServices(allowedTransportTypes, serviceLimit),
    ]);

    if (freightsResult.error) throw freightsResult.error;

    return {
      freights: freightsResult.data || [],
      serviceRequests: services || [],
      allowedTransportTypes,
    };
  }, [fetchUrbanServices, resolveAllowedTransportTypes]);

  return {
    fetchAvailableMarketplaceItems,
    resolveAllowedTransportTypes,
  };
}
