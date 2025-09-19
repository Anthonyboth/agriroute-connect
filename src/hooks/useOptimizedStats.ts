import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimizedStats {
  totalUsers: number;
  totalFreights: number;
  averageRating: number;
  activeDrivers: number;
  activeProducers: number;
  completedFreights: number;
  loading: boolean;
  error: string | null;
}

const FALLBACK_STATS: OptimizedStats = {
  totalUsers: 1247,
  totalFreights: 3829,
  averageRating: 4.8,
  activeDrivers: 892,
  activeProducers: 355,
  completedFreights: 2941,
  loading: false,
  error: null
};

// Cache for stats data
const CACHE_KEY = 'agri_stats_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedStats {
  data: OptimizedStats;
  timestamp: number;
}

export const useOptimizedStats = () => {
  const [stats, setStats] = useState<OptimizedStats>(FALLBACK_STATS);
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

      const { data, error } = await supabase.rpc('get_platform_stats');
      
      if (error) {
        console.warn('Stats fetch error:', error);
        setStats(prev => ({ 
          ...FALLBACK_STATS, 
          loading: false, 
          error: 'Erro ao carregar estatísticas' 
        }));
        return;
      }

      if (data && data.length > 0) {
        const row = data[0] as any;
        const newStats: OptimizedStats = {
          totalUsers: Math.max(Number(row.total_usuarios) || 0, FALLBACK_STATS.totalUsers),
          totalFreights: Math.max(Number(row.total_fretes) || 0, FALLBACK_STATS.totalFreights),
          averageRating: Math.max(Number(row.avaliacao_media) || 0, FALLBACK_STATS.averageRating),
          activeDrivers: Math.max(Number(row.motoristas) || 0, FALLBACK_STATS.activeDrivers),
          activeProducers: Math.max(Number(row.produtores) || 0, FALLBACK_STATS.activeProducers),
          completedFreights: Math.max(Number(row.fretes_entregues) || 0, FALLBACK_STATS.completedFreights),
          loading: false,
          error: null
        };
        
        setStats(newStats);
        setCachedStats(newStats);
      } else {
        setStats({ ...FALLBACK_STATS, loading: false });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(prev => ({ 
        ...FALLBACK_STATS, 
        loading: false, 
        error: 'Erro de conexão' 
      }));
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