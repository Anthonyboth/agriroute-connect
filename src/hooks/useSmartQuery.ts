/**
 * src/hooks/useSmartQuery.ts
 *
 * Camada central de cache, deduplicação e refresh controlado.
 *
 * Regras:
 * - Cache global em memória (Map) por key
 * - TTL: se não expirou, retorna cache sem re-fetch
 * - Dedupe: se já existe Promise pendente para mesma key, reutiliza
 * - Abort/cancel: se componente desmontar, não atualiza state
 * - refetchOnFocus/reconnect respeitam TTL (só busca se stale)
 * - Nenhum polling agressivo
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logRequestStart, logRequestEnd } from '@/lib/net-debug';

// ── Cache global ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const globalCache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();

// ── Tipos públicos ────────────────────────────────────────────

export interface UseSmartQueryOptions<T> {
  /** Chave única (ex: "profile:userId", "freights:driverId") */
  key: string;
  /** Função que busca os dados */
  fetcher: () => Promise<T>;
  /** Tempo de vida do cache em ms (ex: 10 * 60 * 1000 = 10 min) */
  ttlMs: number;
  /** Só inicia quando true (default: true) */
  enabled?: boolean;
  /** Refetch ao focar a aba/janela, somente se stale (default: true) */
  refetchOnFocus?: boolean;
  /** Refetch ao reconectar, somente se stale (default: true) */
  refetchOnReconnect?: boolean;
  /** Comportamento no mount: "always" | "stale" | "never" (default: "stale") */
  refetchOnMount?: 'always' | 'stale' | 'never';
}

export interface UseSmartQueryReturn<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: (opts?: { force?: boolean }) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────

function isCacheValid<T>(key: string, ttlMs: number): CacheEntry<T> | null {
  const entry = globalCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    globalCache.delete(key);
    return null;
  }
  return entry;
}

function isStale(key: string, ttlMs: number): boolean {
  return !isCacheValid(key, ttlMs);
}

// ── Hook ──────────────────────────────────────────────────────

export function useSmartQuery<T>(options: UseSmartQueryOptions<T>): UseSmartQueryReturn<T> {
  const {
    key,
    fetcher,
    ttlMs,
    enabled = true,
    refetchOnFocus = true,
    refetchOnReconnect = true,
    refetchOnMount = 'stale',
  } = options;

  // Inicializar com cache se existente
  const cached = useMemo(() => isCacheValid<T>(key, ttlMs), [key, ttlMs]);

  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!cached && enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // ── Core fetch com dedupe ────────────────────────────────
  const executeFetch = useCallback(async (force: boolean = false) => {
    // Se não forçado, verificar cache
    if (!force) {
      const validCache = isCacheValid<T>(key, ttlMs);
      if (validCache) {
        const log = logRequestStart(key, { cacheHit: true, dedupeHit: false });
        if (mountedRef.current) {
          setData(validCache.data);
          setIsLoading(false);
          setError(null);
        }
        logRequestEnd(log);
        return;
      }
    }

    // Dedupe: reutilizar promise existente
    const existing = inFlightPromises.get(key);
    if (existing) {
      const log = logRequestStart(key, { cacheHit: false, dedupeHit: true });
      try {
        const result = await existing;
        if (mountedRef.current) {
          setData(result);
          setError(null);
        }
        logRequestEnd(log);
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
        logRequestEnd(log, String(err));
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
      return;
    }

    // Novo fetch
    const log = logRequestStart(key, { cacheHit: false, dedupeHit: false });

    if (mountedRef.current) {
      // Se já temos dados, mostrar "refreshing" ao invés de "loading"
      if (data !== null || globalCache.has(key)) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
    }

    const fetchPromise = fetcherRef.current();
    inFlightPromises.set(key, fetchPromise);

    try {
      const result = await fetchPromise;

      // Salvar no cache global
      globalCache.set(key, { data: result, timestamp: Date.now() });

      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
      logRequestEnd(log);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      logRequestEnd(log, String(err));
    } finally {
      inFlightPromises.delete(key);
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [key, ttlMs, data]);

  // ── Refetch exposto ──────────────────────────────────────
  const refetch = useCallback(async (opts?: { force?: boolean }) => {
    await executeFetch(opts?.force ?? false);
  }, [executeFetch]);

  // ── Mount behavior ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    if (refetchOnMount === 'always') {
      executeFetch(true);
    } else if (refetchOnMount === 'stale') {
      executeFetch(false);
    }
    // "never": não busca no mount

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  // ── Focus/visibility refresh (somente se stale) ──────────
  useEffect(() => {
    if (!enabled || !refetchOnFocus) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isStale(key, ttlMs)) {
        executeFetch(false);
      }
    };

    const handleFocus = () => {
      if (isStale(key, ttlMs)) {
        executeFetch(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, refetchOnFocus, key, ttlMs, executeFetch]);

  // ── Reconnect refresh (somente se stale) ─────────────────
  useEffect(() => {
    if (!enabled || !refetchOnReconnect) return;

    const handleOnline = () => {
      if (isStale(key, ttlMs)) {
        executeFetch(false);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, refetchOnReconnect, key, ttlMs, executeFetch]);

  // ── Auto-refresh a cada 10 min ───────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        executeFetch(false); // Respeitará TTL
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, executeFetch]);

  return { data, error, isLoading, isRefreshing, refetch };
}

// ── Utilitários globais ──────────────────────────────────────

/** Invalidar cache de uma key específica */
export function invalidateSmartCache(key: string): void {
  globalCache.delete(key);
}

/** Invalidar caches que começam com um prefixo */
export function invalidateSmartCacheByPrefix(prefix: string): void {
  for (const k of globalCache.keys()) {
    if (k.startsWith(prefix)) {
      globalCache.delete(k);
    }
  }
}

/** Limpar todo o cache (útil no logout) */
export function clearSmartCache(): void {
  globalCache.clear();
  inFlightPromises.clear();
}
