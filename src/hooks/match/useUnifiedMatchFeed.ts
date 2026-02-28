import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMatchExposures } from '@/hooks/useMatchExposures';
import { useMatchDebug, isMatchDebugEnabled } from '@/hooks/useMatchDebug';
import { useMatchScoring, type ScoreBreakdown } from './useMatchScoring';
import { normalizeServiceType } from '@/lib/service-type-normalization';

// =============================================
// Types
// =============================================

export type UnifiedMatchRole = 'MOTORISTA' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA';

export interface UnifiedMatchItem {
  id: string;
  kind: 'FREIGHT' | 'SERVICE';
  city_id: string;
  distance_km?: number | null;
  service_type?: string | null;
  freight_type?: string | null;
  urgency?: string | null;
  created_at: string;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
  payload: any; // minimal card data, no PII
}

export interface UseUnifiedMatchFeedResult {
  items: UnifiedMatchItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refresh: (reason: 'manual' | 'login' | 'focus' | 'interval') => Promise<void>;
  markAction: (item: UnifiedMatchItem, action: 'accepted' | 'rejected' | 'hidden') => void;
}

export interface UseUnifiedMatchFeedOptions {
  role: UnifiedMatchRole;
  companyId?: string;
  affiliateDriverIds?: string[];
  enabled?: boolean;
}

// =============================================
// Constants
// =============================================

const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 min
const MANUAL_DEBOUNCE_MS = 2000;
const VISIBILITY_DEBOUNCE_MS = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

// In-memory cache per role
const feedCache = new Map<string, { items: UnifiedMatchItem[]; ts: number }>();

// =============================================
// Hook
// =============================================

export function useUnifiedMatchFeed({
  role,
  companyId,
  affiliateDriverIds,
  enabled = true,
}: UseUnifiedMatchFeedOptions): UseUnifiedMatchFeedResult {
  const { profile, user } = useAuth();
  const { registerExposures, clearExpiredExposures, acceptExposure, dismissExposure } = useMatchExposures();
  const { startDebug, finishDebug } = useMatchDebug();
  const { scoreItems } = useMatchScoring();

  const [items, setItems] = useState<UnifiedMatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const isRefreshingRef = useRef(false);
  const lastManualRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialRef = useRef(false);
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheKey = `${role}_${companyId || 'solo'}_${profile?.id || 'none'}`;

  // =============================================
  // Fetch logic
  // =============================================

  const doFetch = useCallback(async (reason: string) => {
    if (!profile?.id || !user?.id || !enabled) return;
    if (isRefreshingRef.current) return;

    // Check cache (except manual refresh)
    if (reason !== 'manual') {
      const cached = feedCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        setItems(cached.items);
        setIsLoading(false);
        return;
      }
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    if (!items.length) setIsLoading(true);

    // Abort previous
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Clear expired exposures on manual refresh
    if (reason === 'manual') {
      await clearExpiredExposures();
    }

    const feedType = role === 'PRESTADOR_SERVICOS' ? 'PROVIDER_FEED'
      : role === 'TRANSPORTADORA' ? 'COMPANY_FEED'
      : 'DRIVER_FEED';

    const debugFilters = {
      radius_km: 300,
      role,
      company_id: companyId || null,
      service_types: profile?.service_types || [],
      only_status: ['OPEN'],
    };

    let debugRequestId: string | null = null;

    try {
      debugRequestId = await startDebug(feedType as any, debugFilters);

      let rawItems: UnifiedMatchItem[] = [];

      if (role === 'PRESTADOR_SERVICOS') {
        rawItems = await fetchProviderFeed(profile.id);
      } else {
        // MOTORISTA or TRANSPORTADORA
        rawItems = await fetchDriverFeed(profile.id, companyId);
      }

      // Score items
      const scored = await scoreItems(
        rawItems.map(item => ({
          ...item,
          distance_km: item.distance_km,
          created_at: item.created_at,
          service_type: item.service_type,
          freight_type: item.freight_type,
          urgency: item.urgency,
          city_id: item.city_id,
          payload: item.payload,
        })),
        profile?.service_types
      );

      const finalItems: UnifiedMatchItem[] = scored.map(s => ({
        id: s.id,
        kind: s.kind,
        city_id: s.city_id,
        distance_km: s.distance_km,
        service_type: s.service_type,
        freight_type: s.freight_type,
        urgency: s.urgency,
        created_at: s.created_at,
        score: s.score,
        scoreBreakdown: s.scoreBreakdown,
        payload: s.payload,
      }));

      if (isMountedRef.current) {
        setItems(finalItems);
        setError(null);
        setLastUpdatedAt(new Date().toISOString());
        feedCache.set(cacheKey, { items: finalItems, ts: Date.now() });

        // Register exposures
        registerExposures(finalItems.map(i => ({
          item_type: i.kind,
          item_id: i.id,
          city_id: i.city_id,
          distance_km: i.distance_km,
        })));
      }

      // Debug finish
      if (debugRequestId) {
        const debugSample = {
          included: finalItems.slice(0, 10).map(i => ({
            item_type: i.kind as 'FREIGHT' | 'SERVICE',
            item_id: i.id,
            reason: {
              score: i.score,
              ...(i.scoreBreakdown || {}),
              city_id: i.city_id,
              distance_km: i.distance_km,
            },
          })),
          excluded: [] as any[],
        };
        await finishDebug(debugRequestId, {
          candidates: -1,
          filtered_by_type: 0,
          filtered_by_city: 0,
          filtered_by_radius: 0,
          filtered_by_status: 0,
          filtered_by_exposure: 0,
          returned: finalItems.length,
        }, debugSample);
      }

      if (import.meta.env.DEV) {
        console.log(`[UnifiedMatchFeed] ${reason}: ${finalItems.length} items (${role})`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('[UnifiedMatchFeed] Error:', err);
      if (isMountedRef.current) {
        setError(err?.message || 'Erro ao buscar feed');
      }
      // Debug finish with error
      if (debugRequestId) {
        await finishDebug(debugRequestId, {
          candidates: 0, filtered_by_type: 0, filtered_by_city: 0,
          filtered_by_radius: 0, filtered_by_status: 0, filtered_by_exposure: 0, returned: 0,
        }, { included: [], excluded: [] }, err?.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      isRefreshingRef.current = false;
    }
  }, [profile?.id, profile?.service_types, user?.id, role, companyId, enabled, cacheKey,
    clearExpiredExposures, startDebug, finishDebug, registerExposures, scoreItems]);

  // =============================================
  // Backend fetchers
  // =============================================

  const fetchDriverFeed = async (profileId: string, companyId?: string): Promise<UnifiedMatchItem[]> => {
    if (companyId) {
      // Company: direct query for OPEN freights
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map(mapFreightToItem);
    }

    // Driver: RPC (authoritative, server-side filtered)
    const { data, error } = await supabase.rpc('get_freights_for_driver', {
      p_driver_id: profileId,
    });
    if (error) throw error;
    return (data || []).map(mapFreightToItem);
  };

  const fetchProviderFeed = async (profileId: string): Promise<UnifiedMatchItem[]> => {
    const { data, error } = await supabase.rpc('get_services_for_provider', {
      p_provider_id: profileId,
    });
    if (error) throw error;
    return (data || []).map(mapServiceToItem);
  };

  // =============================================
  // Mappers
  // =============================================

  const mapFreightToItem = (f: any): UnifiedMatchItem => ({
    id: f.id || f.freight_id,
    kind: 'FREIGHT',
    city_id: f.origin_city_id || '',
    distance_km: f.distance_to_origin_km ?? f.distance_km ?? null,
    service_type: normalizeServiceType(f.service_type),
    freight_type: f.cargo_type || null,
    urgency: f.urgency || 'LOW',
    created_at: f.created_at,
    score: 0,
    payload: {
      cargo_type: f.cargo_type,
      weight: f.weight,
      origin_city: f.origin_city,
      origin_state: f.origin_state,
      destination_city: f.destination_city,
      destination_state: f.destination_state,
      price: f.price,
      distance_km: f.distance_km,
      pickup_date: f.pickup_date,
      delivery_date: f.delivery_date,
      status: f.status,
      required_trucks: f.required_trucks,
      accepted_trucks: f.accepted_trucks,
      minimum_antt_price: f.minimum_antt_price,
      origin_address: f.origin_address,
      destination_address: f.destination_address,
      distance_to_origin_km: f.distance_to_origin_km,
      vehicle_type_required: f.vehicle_type_required || undefined,
      vehicle_axles_required: f.vehicle_axles_required || undefined,
      pricing_type: (f.pricing_type as 'FIXED' | 'PER_KM' | 'PER_TON') || 'FIXED',
      price_per_km: f.price_per_km != null ? Number(f.price_per_km) : undefined,
    },
  });

  const mapServiceToItem = (s: any): UnifiedMatchItem => ({
    id: s.id,
    kind: 'SERVICE',
    city_id: s.city_id || '',
    distance_km: s.distance_km || null,
    service_type: s.service_type || null,
    freight_type: null,
    urgency: s.urgency || 'LOW',
    created_at: s.created_at,
    score: 0,
    payload: {
      service_type: s.service_type,
      location_address: s.location_address,
      problem_description: s.problem_description,
      urgency: s.urgency,
      status: s.status,
      city_name: s.city_name,
      state: s.state,
    },
  });

  // =============================================
  // Public refresh (debounced)
  // =============================================

  const refresh = useCallback(async (reason: 'manual' | 'login' | 'focus' | 'interval') => {
    if (reason === 'manual') {
      const now = Date.now();
      if (now - lastManualRef.current < MANUAL_DEBOUNCE_MS) return;
      lastManualRef.current = now;
    }
    await doFetch(reason);
  }, [doFetch]);

  // =============================================
  // markAction: remove from list + register interaction
  // =============================================

  const markAction = useCallback((item: UnifiedMatchItem, action: 'accepted' | 'rejected' | 'hidden') => {
    // Remove from local list immediately
    setItems(prev => prev.filter(i => i.id !== item.id));

    // Update cache
    const cached = feedCache.get(cacheKey);
    if (cached) {
      cached.items = cached.items.filter(i => i.id !== item.id);
    }

    // Register exposure status
    if (action === 'accepted') {
      acceptExposure(item.kind, item.id);
    } else {
      dismissExposure(item.kind, item.id);
    }

    // Record interaction (non-blocking)
    if (user?.id) {
      supabase.from('match_interactions').insert({
        user_id: user.id,
        role: role,
        item_kind: item.kind,
        item_id: item.id,
        action: action,
        metadata: {
          distance_km: item.distance_km,
          service_type: item.service_type || item.freight_type,
          score: item.score,
        },
      }).then(({ error }) => {
        if (error && import.meta.env.DEV) {
          console.error('[UnifiedMatchFeed] interaction insert error:', error);
        }
      });
    }
  }, [cacheKey, role, user?.id, acceptExposure, dismissExposure]);

  // =============================================
  // Effects: mount, interval, visibility
  // =============================================

  // Initial fetch
  useEffect(() => {
    if (!enabled || !profile?.id || hasInitialRef.current) return;
    hasInitialRef.current = true;
    doFetch('login');
  }, [enabled, profile?.id, doFetch]);

  // Auto-refresh interval (10 min)
  useEffect(() => {
    if (!enabled || !profile?.id) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) doFetch('interval');
    }, AUTO_REFRESH_MS);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [enabled, profile?.id, doFetch]);

  // Visibility change (tab focus)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Debounce to avoid multiple triggers
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = setTimeout(() => {
        // Only refresh if cache is stale
        const cached = feedCache.get(cacheKey);
        if (!cached || Date.now() - cached.ts > CACHE_TTL_MS) {
          doFetch('focus');
        }
      }, VISIBILITY_DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
    };
  }, [enabled, cacheKey, doFetch]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
    };
  }, []);

  return {
    items,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
    markAction,
  };
}
