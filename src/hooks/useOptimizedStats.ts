import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { queryWithTimeout } from '@/lib/query-utils';

interface OptimizedStats {
  totalUsers: number;
  totalFreights: number;
  averageRating: number;
  activeDrivers: number;
  activeProducers: number;
  activeServiceProviders: number;
  totalWeight: number;
  completedFreights: number;
  loading: boolean;
  error: string | null;
}


// Cache for stats data
const CACHE_KEY = 'agri_stats_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedStats {
  data: OptimizedStats;
  timestamp: number;
}

export const useOptimizedStats = () => {
  const [stats, setStats] = useState<OptimizedStats>({
    totalUsers: 0,
    totalFreights: 0,
    averageRating: 0,
    activeDrivers: 0,
    activeProducers: 0,
    activeServiceProviders: 0,
    totalWeight: 0,
    completedFreights: 0,
    loading: true,
    error: null
  });
  const [lastFetch, setLastFetch] = useState(0);

  // Get cached data if available and fresh
  const getCachedStats = useCallback((): OptimizedStats | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsedCache: CachedStats = JSON.parse(cached);
        const isExpired = Date.now() - parsedCache.timestamp > CACHE_DURATION;
        if (!isExpired) {
          return parsedCache.data;
        }
      }
    } catch (error) {
      console.warn('Error reading stats cache:', error);
    }
    return null;
  }, []);

  // Cache stats data
  const setCachedStats = useCallback((data: OptimizedStats) => {
    try {
      const cacheData: CachedStats = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error caching stats:', error);
    }
  }, []);

  // Debounced fetch function
  const fetchStats = useCallback(async () => {
    const now = Date.now();
    
    // Prevent too frequent requests (debounce)
    if (now - lastFetch < 10000) return; // 10 seconds minimum between requests
    
    setLastFetch(now);
    
    try {
      // Check cache first
      const cached = getCachedStats();
      if (cached) {
        setStats(cached);
        return;
      }

      setStats(prev => ({ ...prev, loading: true, error: null }));

      if (import.meta.env.DEV) {
        console.log('[useOptimizedStats] Buscando estatísticas...');
      }
      
      const data = await queryWithTimeout(
        async () => {
          const { data, error } = await supabase.rpc('get_platform_stats');
          if (error) throw error;
          return data;
        },
        { 
          timeoutMs: 8000, 
          operationName: 'fetchPlatformStats',
          retries: 1
        }
      );
      
      if (data && data.length > 0) {
        const row = data[0] as any;
        const newStats: OptimizedStats = {
          totalUsers: Number(row.total_usuarios) || 0,
          totalFreights: Number(row.total_fretes) || 0,
          averageRating: Number(row.avaliacao_media) || 0,
          activeDrivers: Number(row.motoristas) || 0,
          activeProducers: Number(row.produtores) || 0,
          activeServiceProviders: Number(row.prestadores) || 0,
          totalWeight: Math.round(Number(row.peso_total) || 0),
          completedFreights: Number(row.fretes_entregues) || 0,
          loading: false,
          error: null
        };
        
        if (import.meta.env.DEV) {
          console.log('[useOptimizedStats] Estatísticas carregadas:', newStats);
        }
        setStats(newStats);
        setCachedStats(newStats);
      } else {
        setStats({
          totalUsers: 0,
          totalFreights: 0,
          averageRating: 0,
          activeDrivers: 0,
          activeProducers: 0,
          activeServiceProviders: 0,
          totalWeight: 0,
          completedFreights: 0,
          loading: false,
          error: 'Dados não disponíveis'
        });
      }
    } catch (error: any) {
      console.error('[useOptimizedStats] Erro:', error);
      
      // Tentar usar cache mesmo em erro
      const cached = getCachedStats();
      if (cached) {
        if (import.meta.env.DEV) {
          console.log('[useOptimizedStats] Usando cache após erro');
        }
        setStats({ ...cached, error: 'Dados em cache' });
      } else {
        setStats({ 
          totalUsers: 0,
          totalFreights: 0,
          averageRating: 0,
          activeDrivers: 0,
          activeProducers: 0,
          activeServiceProviders: 0,
          totalWeight: 0,
          completedFreights: 0,
          loading: false, 
          error: error.message?.includes('Timeout') ? 'Tempo esgotado' : 'Erro de conexão'
        });
      }
    }
  }, [lastFetch, getCachedStats, setCachedStats]);

  // Initialize with cached data
  useEffect(() => {
    const cached = getCachedStats();
    if (cached) {
      setStats(cached);
    } else {
      // Only fetch if no cache available
      fetchStats();
    }
  }, []);

  // Memoized stats object to prevent unnecessary re-renders
  const memoizedStats = useMemo(() => stats, [
    stats.totalUsers,
    stats.totalFreights,
    stats.averageRating,
    stats.activeDrivers,
    stats.activeProducers,
    stats.activeServiceProviders,
    stats.totalWeight,
    stats.completedFreights,
    stats.loading,
    stats.error
  ]);

  return { 
    stats: memoizedStats, 
    refetchStats: fetchStats,
    isLoading: stats.loading,
    error: stats.error
  };
};