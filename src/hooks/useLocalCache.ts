/**
 * Hook para cache local de dados com TTL e invalidação
 * Reduz chamadas desnecessárias ao servidor
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  /** Tempo de vida do cache em ms (padrão: 5 minutos) */
  ttlMs?: number;
  /** Chave única do cache */
  cacheKey: string;
  /** Usar localStorage para persistência */
  persistent?: boolean;
  /** Callback quando cache expira */
  onExpire?: () => void;
}

interface CacheResult<T> {
  /** Dados em cache */
  data: T | null;
  /** Se os dados estão stale (expirados mas ainda disponíveis) */
  isStale: boolean;
  /** Se está carregando dados novos */
  isLoading: boolean;
  /** Atualizar cache com novos dados */
  setCache: (data: T) => void;
  /** Invalidar cache */
  invalidate: () => void;
  /** Buscar dados frescos */
  refresh: () => Promise<T | null>;
  /** Idade do cache em ms */
  age: number;
}

// Cache em memória global
const memoryCache = new Map<string, CacheEntry<any>>();

// Prefixo para localStorage
const STORAGE_PREFIX = 'cache_';

export function useLocalCache<T>(
  fetchFn: () => Promise<T>,
  options: CacheOptions
): CacheResult<T> {
  const {
    ttlMs = 5 * 60 * 1000,
    cacheKey,
    persistent = false,
    onExpire,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [age, setAge] = useState(0);

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Carregar do cache na montagem
  useEffect(() => {
    mountedRef.current = true;
    loadFromCache();
    
    return () => {
      mountedRef.current = false;
    };
  }, [cacheKey]);

  // Atualizar idade periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const entry = getCacheEntry();
      if (entry) {
        const currentAge = Date.now() - entry.timestamp;
        setAge(currentAge);
        
        if (Date.now() > entry.expiresAt && !isStale) {
          setIsStale(true);
          onExpire?.();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cacheKey, isStale, onExpire]);

  const getCacheEntry = useCallback((): CacheEntry<T> | null => {
    // Tentar memória primeiro
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey) as CacheEntry<T>;
    }

    // Tentar localStorage se persistente
    if (persistent) {
      try {
        const stored = localStorage.getItem(STORAGE_PREFIX + cacheKey);
        if (stored) {
          const entry = JSON.parse(stored) as CacheEntry<T>;
          // Restaurar para memória
          memoryCache.set(cacheKey, entry);
          return entry;
        }
      } catch (error) {
        console.warn('[useLocalCache] Erro ao ler localStorage:', error);
      }
    }

    return null;
  }, [cacheKey, persistent]);

  const loadFromCache = useCallback(() => {
    const entry = getCacheEntry();
    
    if (entry) {
      setData(entry.data);
      setAge(Date.now() - entry.timestamp);
      setIsStale(Date.now() > entry.expiresAt);
    }
  }, [getCacheEntry]);

  const setCache = useCallback((newData: T) => {
    const entry: CacheEntry<T> = {
      data: newData,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };

    // Salvar em memória
    memoryCache.set(cacheKey, entry);

    // Salvar em localStorage se persistente
    if (persistent) {
      try {
        localStorage.setItem(STORAGE_PREFIX + cacheKey, JSON.stringify(entry));
      } catch (error) {
        console.warn('[useLocalCache] Erro ao salvar localStorage:', error);
      }
    }

    if (mountedRef.current) {
      setData(newData);
      setAge(0);
      setIsStale(false);
    }
  }, [cacheKey, ttlMs, persistent]);

  const invalidate = useCallback(() => {
    memoryCache.delete(cacheKey);
    
    if (persistent) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + cacheKey);
      } catch (error) {
        console.warn('[useLocalCache] Erro ao remover localStorage:', error);
      }
    }

    if (mountedRef.current) {
      setData(null);
      setAge(0);
      setIsStale(false);
    }
  }, [cacheKey, persistent]);

  const refresh = useCallback(async (): Promise<T | null> => {
    if (fetchingRef.current) {
      return data;
    }

    fetchingRef.current = true;
    setIsLoading(true);

    try {
      const freshData = await fetchFn();
      
      if (mountedRef.current) {
        setCache(freshData);
      }
      
      return freshData;
    } catch (error) {
      console.error('[useLocalCache] Erro ao buscar dados:', error);
      return null;
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchFn, setCache, data]);

  return {
    data,
    isStale,
    isLoading,
    setCache,
    invalidate,
    refresh,
    age,
  };
}

/**
 * Invalida todos os caches que começam com um prefixo
 */
export function invalidateCacheByPrefix(prefix: string) {
  // Memória
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  // localStorage
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX + prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('[invalidateCacheByPrefix] Erro ao limpar localStorage:', error);
  }
}

/**
 * Limpa todo o cache
 */
export function clearAllCache() {
  memoryCache.clear();
  
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('[clearAllCache] Erro ao limpar localStorage:', error);
  }
}
