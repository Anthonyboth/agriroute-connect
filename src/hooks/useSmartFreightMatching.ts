import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMatchExposures } from './useMatchExposures';
import { useMatchDebug, isMatchDebugEnabled } from './useMatchDebug';

export interface MatchedFreight {
  id: string;
  cargo_type: string;
  weight: number | null;
  origin_address: string;
  origin_city: string;
  origin_state: string;
  destination_address: string;
  destination_city: string;
  destination_state: string;
  price: number | null;
  distance_km: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  urgency: string;
  status: string;
  service_type: string;
  created_at: string;
  distance_to_origin_km: number | null;
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

export interface SmartFreightMatchingResult {
  freights: MatchedFreight[];
  userCities: UserCityConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasConfiguredCities: boolean;
  hasConfiguredServiceTypes: boolean;
}

/**
 * Hook para matching inteligente de fretes para MOTORISTAS
 * 
 * Filtra fretes baseado nas cidades e tipos de serviço configurados pelo usuário.
 * A RPC get_freights_for_driver faz toda a filtragem - este hook confia nela!
 * 
 * @param companyId - ID da transportadora (opcional, para motoristas afiliados)
 * @returns Fretes filtrados, configuração de cidades e estado de loading
 */
export const useSmartFreightMatching = (companyId?: string): SmartFreightMatchingResult => {
  const { profile } = useAuth();
  const { registerExposures, clearExpiredExposures } = useMatchExposures();
  const { startDebug, finishDebug } = useMatchDebug();
  const [freights, setFreights] = useState<MatchedFreight[]>([]);
  const [userCities, setUserCities] = useState<UserCityConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserCities = useCallback(async () => {
    if (!profile?.user_id) return [];

    try {
      // Motoristas usam MOTORISTA_ORIGEM para buscar fretes de origem
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
      console.error('[useSmartFreightMatching] Erro ao buscar cidades:', err);
      return [];
    }
  }, [profile?.user_id]);

  const fetchFreights = useCallback(async () => {
    const activeMode = profile?.active_mode || profile?.role;
    
    if (!profile?.id || !['MOTORISTA', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'].includes(activeMode || '')) {
      if (import.meta.env.DEV) {
        console.warn('[useSmartFreightMatching] Role/mode inválido:', activeMode);
      }
      setFreights([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Buscar configuração de cidades
      const citiesResult = await fetchUserCities();
      setUserCities(citiesResult);

      const feedType = companyId ? 'COMPANY_FEED' : 'DRIVER_FEED';
      const debugFilters = {
        radius_km: 300,
        city_ids: citiesResult.map(c => c.city_id),
        service_types: profile?.service_types || [],
        only_status: ['OPEN'],
        company_id: companyId || null,
      };

      // Start debug if enabled
      const debugRequestId = await startDebug(feedType as any, debugFilters);

      if (companyId) {
        const { data, error: fetchError } = await supabase
          .from('freights')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'OPEN')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const mappedFreights = (data || []).map((f: any) => ({
          id: f.id, cargo_type: f.cargo_type, weight: f.weight,
          origin_address: f.origin_address, origin_city: f.origin_city, origin_state: f.origin_state,
          destination_address: f.destination_address, destination_city: f.destination_city, destination_state: f.destination_state,
          price: f.price, distance_km: f.distance_km, pickup_date: f.pickup_date, delivery_date: f.delivery_date,
          urgency: f.urgency, status: f.status, service_type: f.service_type, created_at: f.created_at,
          distance_to_origin_km: null
        }));

        setFreights(mappedFreights);
        registerExposures(mappedFreights.map(f => ({ item_type: 'FREIGHT' as const, item_id: f.id })));

        // Debug: company feed returns all OPEN for company
        if (debugRequestId) {
          await finishDebug(debugRequestId, {
            candidates: mappedFreights.length, filtered_by_type: 0, filtered_by_city: 0,
            filtered_by_radius: 0, filtered_by_status: 0, filtered_by_exposure: 0, returned: mappedFreights.length,
          }, {
            included: mappedFreights.slice(0, 10).map(f => ({
              item_type: 'FREIGHT' as const, item_id: f.id,
              reason: { source: 'company_direct', city: f.origin_city, state: f.origin_state },
            })),
            excluded: [],
          });
        }
      } else {
        const { data, error: rpcError } = await supabase.rpc(
          'get_freights_for_driver', { p_driver_id: profile.id }
        );

        if (rpcError) throw rpcError;

        const mappedFreights = (data || []).map((f: any) => ({
          id: f.id, cargo_type: f.cargo_type, weight: f.weight,
          origin_address: f.origin_address, origin_city: f.origin_city, origin_state: f.origin_state,
          destination_address: f.destination_address, destination_city: f.destination_city, destination_state: f.destination_state,
          price: f.price, distance_km: f.distance_km, pickup_date: f.pickup_date, delivery_date: f.delivery_date,
          urgency: f.urgency, status: f.status, service_type: f.service_type, created_at: f.created_at,
          distance_to_origin_km: f.distance_to_origin_km
        }));

        setFreights(mappedFreights);
        registerExposures(mappedFreights.map(f => ({ item_type: 'FREIGHT' as const, item_id: f.id })));

        // Debug: RPC already filters by city + type + exposure
        if (debugRequestId) {
          await finishDebug(debugRequestId, {
            candidates: -1, // unknown pre-filter count from RPC
            filtered_by_type: 0, filtered_by_city: 0, filtered_by_radius: 0,
            filtered_by_status: 0, filtered_by_exposure: 0, returned: mappedFreights.length,
          }, {
            included: mappedFreights.slice(0, 10).map(f => ({
              item_type: 'FREIGHT' as const, item_id: f.id,
              reason: { matched_city: f.origin_city, matched_state: f.origin_state, distance_km: f.distance_km },
            })),
            excluded: [],
          });
        }

        if (import.meta.env.DEV) {
          console.log('[useSmartFreightMatching] Fretes matched:', mappedFreights.length);
        }
      }
    } catch (err: any) {
      console.error('[useSmartFreightMatching] Erro:', err);
      setError(err.message || 'Erro ao buscar fretes');
      setFreights([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role, profile?.active_mode, profile?.user_id, companyId, fetchUserCities]);

  useEffect(() => {
    fetchFreights();
  }, [fetchFreights]);

  // Verificar se o usuário tem configuração válida
  const hasConfiguredCities = userCities.length > 0;
  const hasConfiguredServiceTypes = 
    (profile?.service_types && profile.service_types.length > 0) ||
    userCities.some(uc => uc.service_types && uc.service_types.length > 0);

  const handleRefetch = useCallback(async () => {
    await clearExpiredExposures();
    await fetchFreights();
  }, [clearExpiredExposures, fetchFreights]);

  return {
    freights,
    userCities,
    loading,
    error,
    refetch: handleRefetch,
    hasConfiguredCities,
    hasConfiguredServiceTypes
  };
};
