import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMatchExposures } from './useMatchExposures';
import { useMatchDebug } from './useMatchDebug';

export interface MatchedService {
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

export interface SmartServiceMatchingResult {
  services: MatchedService[];
  userCities: UserCityConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasConfiguredCities: boolean;
  hasConfiguredServiceTypes: boolean;
}

/**
 * Hook para matching inteligente de serviços para PRESTADORES
 * 
 * Filtra serviços baseado nas cidades e tipos de serviço configurados pelo usuário.
 * A RPC get_services_for_provider já faz toda a filtragem - este hook confia nela!
 * 
 * @returns Serviços filtrados, configuração de cidades e estado de loading
 */
export const useSmartServiceMatching = (): SmartServiceMatchingResult => {
  const { profile } = useAuth();
  const { registerExposures, clearExpiredExposures } = useMatchExposures();
  const { startDebug, finishDebug } = useMatchDebug();
  const [services, setServices] = useState<MatchedService[]>([]);
  const [userCities, setUserCities] = useState<UserCityConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserCities = useCallback(async () => {
    if (!profile?.user_id) return [];

    try {
      // Prestadores usam tipo PRESTADOR_SERVICO
      const { data, error: fetchError } = await supabase
        .from('user_cities')
        .select(`
          id,
          city_id,
          radius_km,
          service_types,
          is_active,
          cities (name, state)
        `)
        .eq('user_id', profile.user_id)
        .eq('type', 'PRESTADOR_SERVICO' as any)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      return (data || []).map((uc: any) => ({
        id: uc.id,
        city_id: uc.city_id,
        city_name: uc.cities?.name || '',
        state: uc.cities?.state || '',
        radius_km: uc.radius_km || 50,
        service_types: uc.service_types || [],
        is_active: uc.is_active
      }));
    } catch (err) {
      console.error('[useSmartServiceMatching] Erro ao buscar cidades:', err);
      return [];
    }
  }, [profile?.user_id]);

  const fetchServices = useCallback(async () => {
    const activeMode = profile?.active_mode || profile?.role;
    
    if (!profile?.id || activeMode !== 'PRESTADOR_SERVICOS') {
      if (import.meta.env.DEV) {
        console.warn('[useSmartServiceMatching] Role/mode inválido:', activeMode);
      }
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [citiesResult, servicesResult] = await Promise.all([
        fetchUserCities(),
        supabase.rpc('get_services_for_provider', { p_provider_id: profile.id })
      ]);

      setUserCities(citiesResult);

      const debugFilters = {
        radius_km: 300,
        city_ids: citiesResult.map(c => c.city_id),
        service_types: profile?.service_types || [],
        only_status: ['OPEN'],
      };
      const debugRequestId = await startDebug('PROVIDER_FEED', debugFilters);

      if (servicesResult.error) throw servicesResult.error;

      const matchedServices = (servicesResult.data || []).map((s: any) => ({
        id: s.id, service_type: s.service_type, location_address: s.location_address,
        problem_description: s.problem_description, urgency: s.urgency,
        contact_phone: s.contact_phone, contact_name: s.contact_name,
        status: s.status, created_at: s.created_at, client_id: s.client_id,
        city_name: s.city_name, state: s.state,
        location_lat: s.location_lat, location_lng: s.location_lng, distance_km: s.distance_km
      }));

      setServices(matchedServices);
      registerExposures(matchedServices.map(s => ({ item_type: 'SERVICE' as const, item_id: s.id })));

      // Debug finish
      if (debugRequestId) {
        await finishDebug(debugRequestId, {
          candidates: -1, filtered_by_type: 0, filtered_by_city: 0,
          filtered_by_radius: 0, filtered_by_status: 0, filtered_by_exposure: 0,
          returned: matchedServices.length,
        }, {
          included: matchedServices.slice(0, 10).map(s => ({
            item_type: 'SERVICE' as const, item_id: s.id,
            reason: { matched_service_type: s.service_type, city_name: s.city_name, distance_km: s.distance_km },
          })),
          excluded: [],
        });
      }

      if (import.meta.env.DEV) {
        console.log('[useSmartServiceMatching] Serviços matched:', matchedServices.length);
      }
    } catch (err: any) {
      console.error('[useSmartServiceMatching] Erro:', err);
      setError(err.message || 'Erro ao buscar serviços');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role, profile?.active_mode, fetchUserCities]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Verificar se o usuário tem configuração válida
  const hasConfiguredCities = userCities.length > 0;
  const hasConfiguredServiceTypes = 
    (profile?.service_types && profile.service_types.length > 0) ||
    userCities.some(uc => uc.service_types && uc.service_types.length > 0);

  const handleRefetch = useCallback(async () => {
    await clearExpiredExposures();
    await fetchServices();
  }, [clearExpiredExposures, fetchServices]);

  return {
    services,
    userCities,
    loading,
    error,
    refetch: handleRefetch,
    hasConfiguredCities,
    hasConfiguredServiceTypes
  };
};
