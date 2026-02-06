/**
 * src/hooks/useServicesSmart.ts
 *
 * Hook centralizado para listagens de serviços (PRESTADOR DE SERVIÇOS).
 * Substitui useServicesOnly e useSmartServiceMatching.
 *
 * Regras:
 * - Cache global via useSmartQuery com TTL de 10 min
 * - Atualiza ao: login, focus/visibility (se stale), botão "Atualizar", auto 10min
 * - Deduplicação automática
 * - Proibido: setInterval agressivo, channel().on() sem filtro
 */

import { useCallback, useMemo } from 'react';
import { useSmartQuery, invalidateSmartCacheByPrefix } from './useSmartQuery';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

const SERVICES_TTL_MS = 10 * 60 * 1000; // 10 minutos

export interface SmartService {
  id: string;
  service_type: string;
  location_address: string;
  problem_description: string;
  urgency: string;
  contact_phone: string;
  contact_name: string;
  status: string;
  created_at: string;
  client_id: string;
  city_name: string;
  state: string;
  location_lat: number | null;
  location_lng: number | null;
  distance_km: number | null;
}

export interface UserCityConfig {
  id: string;
  city_id: string;
  city_name: string;
  state: string;
  radius_km: number;
  service_types: string[];
  is_active: boolean;
}

export function useServicesSmart() {
  const { profile } = useAuth();

  const activeMode = profile?.active_mode || profile?.role;
  const isProvider = activeMode === 'PRESTADOR_SERVICOS';

  const cacheKey = useMemo(() => {
    if (!profile?.id || !isProvider) return '';
    return `services:provider:${profile.id}`;
  }, [profile?.id, isProvider]);

  const fetcher = useCallback(async (): Promise<{ services: SmartService[]; userCities: UserCityConfig[] }> => {
    if (!profile?.id || !isProvider) {
      return { services: [], userCities: [] };
    }

    // Buscar cidades e serviços em paralelo
    const [citiesResult, servicesResult] = await Promise.all([
      supabase
        .from('user_cities')
        .select(`id, city_id, radius_km, service_types, is_active, cities (name, state)`)
        .eq('user_id', profile.user_id)
        .eq('type', 'PRESTADOR_SERVICO' as any)
        .eq('is_active', true),
      supabase.rpc('get_services_for_provider', { p_provider_id: profile.id }),
    ]);

    const userCities = (citiesResult.data || []).map((uc: any) => ({
      id: uc.id,
      city_id: uc.city_id,
      city_name: uc.cities?.name || '',
      state: uc.cities?.state || '',
      radius_km: uc.radius_km || 50,
      service_types: uc.service_types || [],
      is_active: uc.is_active,
    }));

    if (servicesResult.error) throw servicesResult.error;

    const services = (servicesResult.data || []).map((s: any) => ({
      id: s.id,
      service_type: s.service_type,
      location_address: s.location_address,
      problem_description: s.problem_description,
      urgency: s.urgency,
      contact_phone: s.contact_phone,
      contact_name: s.contact_name,
      status: s.status,
      created_at: s.created_at,
      client_id: s.client_id,
      city_name: s.city_name,
      state: s.state,
      location_lat: s.location_lat,
      location_lng: s.location_lng,
      distance_km: s.distance_km,
    }));

    return { services, userCities };
  }, [profile?.id, profile?.user_id, isProvider]);

  const result = useSmartQuery({
    key: cacheKey,
    fetcher,
    ttlMs: SERVICES_TTL_MS,
    enabled: !!cacheKey,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'stale',
  });

  const services = result.data?.services ?? [];
  const userCities = result.data?.userCities ?? [];

  const hasConfiguredCities = userCities.length > 0;
  const hasConfiguredServiceTypes =
    (profile?.service_types && profile.service_types.length > 0) ||
    userCities.some(uc => uc.service_types?.length > 0);

  return {
    services,
    userCities,
    loading: result.isLoading,
    isRefreshing: result.isRefreshing,
    error: result.error,
    refetch: result.refetch,
    hasConfiguredCities,
    hasConfiguredServiceTypes,
  };
}

/** Invalidar todo o cache de serviços (ex: após criar novo serviço) */
export function invalidateServicesCache(): void {
  invalidateSmartCacheByPrefix('services:');
}
