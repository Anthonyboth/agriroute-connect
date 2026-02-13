/**
 * src/hooks/useDashboardDataRefresh.ts
 * 
 * HOOK CENTRALIZADO DE REFRESH DE DADOS
 * 
 * Controla quando os dashboards devem atualizar dados:
 * - No login (automático)
 * - Ao voltar para a aba (visibilitychange)
 * - Ao voltar foco na janela (window.focus)
 * - Manualmente via botão "Atualizar"
 * - Automaticamente a cada 10 minutos
 * 
 * NÃO faz polling de segundos.
 * Deduplica requests em paralelo.
 * Cancela requests ao sair da tela.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Configurações de timing
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const DEBOUNCE_MS = 2000; // 2 segundos entre refreshes
const FOCUS_DEBOUNCE_MS = 5000; // 5 segundos entre refreshes por foco

export interface DashboardRefreshConfig {
  /** Identificador único do dashboard (ex: 'driver', 'company', 'provider') */
  dashboardId: string;
  /** Funções de fetch a serem chamadas no refresh */
  fetchFunctions: (() => Promise<void>)[];
  /** Se deve habilitar refresh automático no intervalo */
  enableAutoRefresh?: boolean;
  /** Se deve habilitar refresh ao voltar para a aba */
  enableVisibilityRefresh?: boolean;
  /** Se deve habilitar refresh ao voltar foco na janela */
  enableFocusRefresh?: boolean;
  /** Intervalo customizado em ms (default: 10 min) */
  intervalMs?: number;
}

export interface DashboardRefreshResult {
  /** Última vez que os dados foram atualizados */
  lastRefreshedAt: Date | null;
  /** Se está carregando dados agora */
  isRefreshing: boolean;
  /** Função para forçar refresh manual */
  refreshNow: () => Promise<void>;
  /** Tempo desde o último refresh em segundos */
  secondsSinceRefresh: number | null;
}

// Mapa global de requests em andamento para evitar duplicatas
const inFlightRequests = new Map<string, Promise<void>>();

// Mapa global de última execução para debounce entre dashboards
const lastRefreshTimestamp = new Map<string, number>();

export function useDashboardDataRefresh(config: DashboardRefreshConfig): DashboardRefreshResult {
  const {
    dashboardId,
    fetchFunctions,
    enableAutoRefresh = true,
    enableVisibilityRefresh = true,
    enableFocusRefresh = true,
    intervalMs = REFRESH_INTERVAL_MS,
  } = config;

  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFocusRefreshRef = useRef<number>(0);

  // Função principal de refresh
  const executeRefresh = useCallback(async (source: 'manual' | 'interval' | 'visibility' | 'focus' | 'mount') => {
    const now = Date.now();
    const lastRefresh = lastRefreshTimestamp.get(dashboardId) || 0;

    // Debounce: evitar refreshes muito próximos
    const debounceTime = source === 'focus' ? FOCUS_DEBOUNCE_MS : DEBOUNCE_MS;
    if (source !== 'manual' && now - lastRefresh < debounceTime) {
      if (import.meta.env.DEV) console.log(`[DashboardRefresh:${dashboardId}] Debounce ativo (${source}), ignorando`);
      return;
    }

    // Single-flight: se já existe um request em andamento, aguardar
    const existingRequest = inFlightRequests.get(dashboardId);
    if (existingRequest) {
      if (import.meta.env.DEV) console.log(`[DashboardRefresh:${dashboardId}] Request em andamento, aguardando...`);
      await existingRequest;
      return;
    }

    // Criar AbortController para este refresh
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    if (import.meta.env.DEV) console.log(`[DashboardRefresh:${dashboardId}] Iniciando refresh (source: ${source})`);
    setIsRefreshing(true);
    lastRefreshTimestamp.set(dashboardId, now);

    // Criar promise que será compartilhada
    const refreshPromise = (async () => {
      try {
        // Executar todas as funções de fetch em paralelo
        await Promise.all(
          fetchFunctions.map(fn => {
            // Envolver cada função para ignorar erros de abort
            return fn().catch(err => {
              if (err?.name === 'AbortError') {
                if (import.meta.env.DEV) console.log(`[DashboardRefresh:${dashboardId}] Fetch abortado`);
                return;
              }
              console.error(`[DashboardRefresh:${dashboardId}] Erro no fetch:`, err);
            });
          })
        );

        if (mountedRef.current) {
          const refreshTime = new Date();
          setLastRefreshedAt(refreshTime);
          if (import.meta.env.DEV) console.log(`[DashboardRefresh:${dashboardId}] ✅ Refresh concluído`);
        }
      } finally {
        if (mountedRef.current) {
          setIsRefreshing(false);
        }
        inFlightRequests.delete(dashboardId);
      }
    })();

    inFlightRequests.set(dashboardId, refreshPromise);
    await refreshPromise;
  }, [dashboardId, fetchFunctions]);

  // Refresh manual exposto ao usuário
  const refreshNow = useCallback(async () => {
    await executeRefresh('manual');
  }, [executeRefresh]);

  // Setup do intervalo automático
  useEffect(() => {
    if (!enableAutoRefresh) return;

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        executeRefresh('interval');
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enableAutoRefresh, intervalMs, executeRefresh]);

  // Listener de visibilidade (aba ativa/inativa)
  useEffect(() => {
    if (!enableVisibilityRefresh) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeRefresh('visibility');
      } else {
        // Cancelar requests quando sair da aba
        abortControllerRef.current?.abort();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableVisibilityRefresh, executeRefresh]);

  // Listener de foco da janela
  useEffect(() => {
    if (!enableFocusRefresh) return;

    const handleFocus = () => {
      const now = Date.now();
      // Debounce adicional para foco (evitar múltiplos eventos seguidos)
      if (now - lastFocusRefreshRef.current < FOCUS_DEBOUNCE_MS) {
        return;
      }
      lastFocusRefreshRef.current = now;
      executeRefresh('focus');
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [enableFocusRefresh, executeRefresh]);

  // Atualizar contador de segundos desde último refresh
  useEffect(() => {
    if (!lastRefreshedAt) return;

    const updateSeconds = () => {
      const seconds = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
      setSecondsSinceRefresh(seconds);
    };

    updateSeconds();
    const interval = setInterval(updateSeconds, 10000); // Atualizar a cada 10s

    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  // Refresh inicial no mount
  useEffect(() => {
    executeRefresh('mount');

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [executeRefresh]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    lastRefreshedAt,
    isRefreshing,
    refreshNow,
    secondsSinceRefresh,
  };
}

/**
 * Hook simples para usar com React Query
 * Fornece configurações otimizadas para eliminar polling
 */
export function useOptimizedQueryConfig() {
  return {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos no garbage collection
    refetchOnMount: false,
    refetchOnWindowFocus: true, // Usar o evento nativo do React Query
    refetchOnReconnect: true,
    refetchInterval: false as const, // NUNCA fazer polling
    retry: 1,
  };
}

/**
 * Utilitário para criar AbortController com cleanup
 */
export function createAbortableRequest() {
  const controller = new AbortController();
  
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    cleanup: () => controller.abort(),
  };
}
