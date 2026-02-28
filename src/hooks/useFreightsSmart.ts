/**
 * src/hooks/useFreightsSmart.ts
 *
 * Hook centralizado para listagens de fretes (MOTORISTA / TRANSPORTADORA).
 * Substitui useFreightsOnly e useSmartFreightMatching.
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
import { normalizeServiceType, CANONICAL_SERVICE_TYPES } from '@/lib/service-type-normalization';

const FREIGHTS_TTL_MS = 10 * 60 * 1000; // 10 minutos

export interface SmartFreight {
  id: string;
  cargo_type: string | null;
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
  distance_to_origin_km?: number | null;
  pricing_type?: string | null;
  price_per_km?: number | null;
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

interface UseFreightsSmartOptions {
  /** Painel: "driver" | "company" */
  panel?: 'driver' | 'company';
  /** ID da transportadora (para fretes da empresa) */
  companyId?: string;
}

export function useFreightsSmart(options: UseFreightsSmartOptions = {}) {
  const { panel = 'driver', companyId } = options;
  const { profile } = useAuth();

  const activeMode = profile?.active_mode || profile?.role;
  const isValidRole = ['MOTORISTA', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'].includes(activeMode || '');

  // Chave determinística
  const cacheKey = useMemo(() => {
    if (!profile?.id || !isValidRole) return '';
    return companyId
      ? `freights:company:${companyId}`
      : `freights:driver:${profile.id}`;
  }, [profile?.id, isValidRole, companyId]);

  const fetcher = useCallback(async (): Promise<{ freights: SmartFreight[]; userCities: UserCityConfig[] }> => {
    if (!profile?.id || !isValidRole) {
      return { freights: [], userCities: [] };
    }

    // Buscar configuração de cidades do usuário
    let userCities: UserCityConfig[] = [];
    try {
      const { data } = await supabase
        .from('user_cities')
        .select(`id, city_id, radius_km, service_types, is_active, cities (name, state)`)
        .eq('user_id', profile.user_id)
        .eq('is_active', true);

      userCities = (data || []).map((uc: any) => ({
        id: uc.id,
        city_id: uc.city_id,
        city_name: uc.cities?.name || '',
        state: uc.cities?.state || '',
        radius_km: uc.radius_km || 50,
        service_types: uc.service_types || [],
        is_active: uc.is_active,
      }));
    } catch (err) {
      console.error('[useFreightsSmart] Erro ao buscar cidades:', err);
    }

    let freights: SmartFreight[] = [];

    if (companyId) {
      // Fretes da transportadora
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

      if (error) throw error;

      freights = (data || []).map((f: any) => ({
        id: f.id,
        cargo_type: f.cargo_type,
        weight: f.weight,
        origin_address: f.origin_address,
        origin_city: f.origin_city,
        origin_state: f.origin_state,
        destination_address: f.destination_address,
        destination_city: f.destination_city,
        destination_state: f.destination_state,
        price: f.price,
        distance_km: f.distance_km,
        pickup_date: f.pickup_date,
        delivery_date: f.delivery_date,
        urgency: f.urgency,
        status: f.status,
        service_type: f.service_type,
        created_at: f.created_at,
        distance_to_origin_km: null,
        pricing_type: f.pricing_type,
        price_per_km: f.price_per_km,
      }));
    } else {
      // RPC para motoristas independentes
      const { data, error } = await supabase.rpc(
        'get_freights_for_driver',
        { p_driver_id: profile.id }
      );

      if (error) throw error;

      // CORREÇÃO MOTO: buscar fretes FRETE_MOTO diretamente
      let motoFreights: any[] = [];
      try {
        const { data: motoData } = await supabase
          .from('freights')
          .select('*')
          .eq('status', 'OPEN')
          .eq('service_type', 'FRETE_MOTO')
          .order('created_at', { ascending: false });
        motoFreights = motoData || [];
      } catch (e) {
        console.warn('[useFreightsSmart] Erro ao buscar fretes MOTO:', e);
      }

      // Combinar, deduplicar e normalizar
      const allFreights = [...(data || []), ...motoFreights];
      const uniqueMap = new Map(allFreights.map(f => [f.id, f]));
      const uniqueFreights = Array.from(uniqueMap.values());

      freights = uniqueFreights
        .map((f: any) => ({
          id: f.id,
          cargo_type: f.cargo_type,
          weight: f.weight,
          origin_address: f.origin_address,
          origin_city: f.origin_city,
          origin_state: f.origin_state,
          destination_address: f.destination_address,
          destination_city: f.destination_city,
          destination_state: f.destination_state,
          price: f.price,
          distance_km: f.distance_km,
          pickup_date: f.pickup_date,
          delivery_date: f.delivery_date,
          urgency: f.urgency,
          status: f.status,
          service_type: normalizeServiceType(f.service_type),
          created_at: f.created_at,
          distance_to_origin_km: f.distance_to_origin_km ?? null,
          pricing_type: f.pricing_type,
          price_per_km: f.price_per_km,
        }))
        .filter((f) =>
          f.service_type && CANONICAL_SERVICE_TYPES.includes(f.service_type)
        );
    }

    return { freights, userCities };
  }, [profile?.id, profile?.user_id, isValidRole, companyId]);

  const result = useSmartQuery({
    key: cacheKey,
    fetcher,
    ttlMs: FREIGHTS_TTL_MS,
    enabled: !!cacheKey,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'stale',
  });

  const freights = result.data?.freights ?? [];
  const userCities = result.data?.userCities ?? [];

  const hasConfiguredCities = userCities.length > 0;
  const hasConfiguredServiceTypes =
    (profile?.service_types && profile.service_types.length > 0) ||
    userCities.some(uc => uc.service_types?.length > 0);

  return {
    freights,
    userCities,
    loading: result.isLoading,
    isRefreshing: result.isRefreshing,
    error: result.error,
    refetch: result.refetch,
    hasConfiguredCities,
    hasConfiguredServiceTypes,
  };
}

/** Invalidar todo o cache de fretes (ex: após criar um novo frete) */
export function invalidateFreightsCache(): void {
  invalidateSmartCacheByPrefix('freights:');
}
