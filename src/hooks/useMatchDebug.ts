import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MatchDebugStats {
  candidates: number;
  filtered_by_type: number;
  filtered_by_city: number;
  filtered_by_radius: number;
  filtered_by_status: number;
  filtered_by_exposure: number;
  returned: number;
}

export interface MatchDebugSampleItem {
  item_type: 'FREIGHT' | 'SERVICE';
  item_id: string;
  reason: Record<string, unknown>;
}

export interface MatchDebugSample {
  included: MatchDebugSampleItem[];
  excluded: MatchDebugSampleItem[];
}

export interface MatchDebugResult {
  requestId: string;
  feedType: string;
  filters: Record<string, unknown>;
  stats: MatchDebugStats;
  sample: MatchDebugSample;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/**
 * Verifica se o modo debug de match está ativo.
 * Ativado por: ?matchDebug=1 na URL OU VITE_MATCH_DEBUG=true (dev only)
 */
export function isMatchDebugEnabled(): boolean {
  // Check URL param
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('matchDebug') === '1') return true;
  }
  // Check env (dev only)
  if (import.meta.env.DEV && import.meta.env.VITE_MATCH_DEBUG === 'true') return true;
  return false;
}

/**
 * Hook para instrumentação e debug do match feed.
 * 
 * Quando ativo (matchDebug=1), registra logs de cada chamada do feed
 * com filtros aplicados, estatísticas de exclusão e amostras.
 */
export function useMatchDebug() {
  const { user } = useAuth();
  const activeRequestRef = useRef<string | null>(null);
  const debugEnabled = isMatchDebugEnabled();

  const startDebug = useCallback(async (
    feedType: 'DRIVER_FEED' | 'PROVIDER_FEED' | 'COMPANY_FEED',
    filters: Record<string, unknown>
  ): Promise<string | null> => {
    if (!debugEnabled || !user?.id) return null;

    try {
      const { data, error } = await supabase.rpc('start_match_debug', {
        p_feed_type: feedType,
        p_filters: filters as any,
      });

      if (error) {
        console.error('[MatchDebug] Failed to start:', error);
        return null;
      }

      const requestId = data as string;
      activeRequestRef.current = requestId;

      if (import.meta.env.DEV) {
        console.log('[MatchDebug] Started request:', requestId, 'filters:', filters);
      }

      return requestId;
    } catch (err) {
      console.error('[MatchDebug] Failed to start:', err);
      return null;
    }
  }, [debugEnabled, user?.id]);

  const finishDebug = useCallback(async (
    requestId: string | null,
    stats: MatchDebugStats,
    sample: MatchDebugSample,
    error?: string
  ) => {
    if (!debugEnabled || !requestId || !user?.id) return;

    try {
      // Cap samples (safety net, backend also caps)
      const cappedSample = {
        included: sample.included.slice(0, 10),
        excluded: sample.excluded.slice(0, 10),
      };

      await supabase.rpc('finish_match_debug', {
        p_request_id: requestId,
        p_stats: stats as any,
        p_sample: cappedSample as any,
        p_error: error || null,
      });

      if (import.meta.env.DEV) {
        console.log('[MatchDebug] Finished request:', requestId, 'stats:', stats);
      }

      activeRequestRef.current = null;
    } catch (err) {
      console.error('[MatchDebug] Failed to finish:', err);
    }
  }, [debugEnabled, user?.id]);

  /**
   * Busca os últimos logs de debug do usuário.
   */
  const fetchRecentLogs = useCallback(async (limit = 5): Promise<MatchDebugResult[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('match_debug_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((log: any) => ({
        requestId: log.request_id,
        feedType: log.feed_type,
        filters: log.filters || {},
        stats: log.stats || {},
        sample: log.sample || { included: [], excluded: [] },
        error: log.error,
        startedAt: log.started_at,
        finishedAt: log.finished_at,
      }));
    } catch (err) {
      console.error('[MatchDebug] Failed to fetch logs:', err);
      return [];
    }
  }, [user?.id]);

  return {
    debugEnabled,
    startDebug,
    finishDebug,
    fetchRecentLogs,
  };
}
