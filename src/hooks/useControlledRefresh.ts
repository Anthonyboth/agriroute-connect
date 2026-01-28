import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Intervalo padrão de auto-refresh: 10 minutos
 * Configurável para aumentar facilmente no futuro
 */
export const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Debounce mínimo para refresh manual (evita spam de clique)
 */
const MANUAL_DEBOUNCE_MS = 2000;

export interface UseControlledRefreshOptions {
  /** Chave única para identificar este refresh (logs/debug) */
  refreshKey: string;
  /** Função que busca os dados */
  refetchFn: () => Promise<void>;
  /** Intervalo de auto-refresh em ms (padrão: 10 min) */
  autoRefreshMs?: number;
  /** Só inicia quando enabled = true */
  enabled?: boolean;
  /** Callback após refresh completo */
  onRefreshComplete?: () => void;
}

export interface UseControlledRefreshReturn {
  /** Dispara refresh controlado manualmente */
  refreshNow: (reason?: string) => void;
  /** Se está atualizando agora */
  isRefreshing: boolean;
  /** Timestamp do último refresh bem-sucedido */
  lastRefreshAt: Date | null;
  /** Texto formatado do último refresh */
  lastRefreshLabel: string;
}

/**
 * Hook centralizado para controlar atualização de dados.
 * 
 * Regras:
 * - Atualiza no mount (quando enabled fica true)
 * - Atualiza ao chamar refreshNow() (com anti-spam)
 * - Auto-refresh a cada X minutos (padrão 10)
 * - NÃO atualiza ao focar janela/aba
 * - NÃO usa polling de segundos
 */
export function useControlledRefresh({
  refreshKey,
  refetchFn,
  autoRefreshMs = AUTO_REFRESH_MS,
  enabled = true,
  onRefreshComplete,
}: UseControlledRefreshOptions): UseControlledRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  
  const isRefreshingRef = useRef(false);
  const lastManualClickRef = useRef(0);
  const isMountedRef = useRef(true);
  const hasInitialFetchRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Executa o refresh de forma controlada
   */
  const doRefresh = useCallback(async (reason: string) => {
    // Evita refresh duplicado se já está em andamento
    if (isRefreshingRef.current) {
      if (import.meta.env.DEV) {
        console.log(`[${refreshKey}] ⏳ Refresh já em andamento, ignorando (${reason})`);
      }
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    if (import.meta.env.DEV) {
      console.log(`[${refreshKey}] 🔄 Iniciando refresh (${reason})`);
    }

    try {
      await refetchFn();
      
      if (isMountedRef.current) {
        setLastRefreshAt(new Date());
        onRefreshComplete?.();
        
        if (import.meta.env.DEV) {
          console.log(`[${refreshKey}] ✅ Refresh concluído (${reason})`);
        }
      }
    } catch (error) {
      console.error(`[${refreshKey}] ❌ Erro no refresh (${reason}):`, error);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
      isRefreshingRef.current = false;
    }
  }, [refreshKey, refetchFn, onRefreshComplete]);

  /**
   * Função exposta para refresh manual (botão "Atualizar")
   */
  const refreshNow = useCallback((reason = 'manual') => {
    const now = Date.now();
    
    // Anti-spam: mínimo de 2s entre cliques
    if (now - lastManualClickRef.current < MANUAL_DEBOUNCE_MS) {
      if (import.meta.env.DEV) {
        console.log(`[${refreshKey}] ⚠️ Debounce: aguarde antes de clicar novamente`);
      }
      return;
    }
    
    lastManualClickRef.current = now;
    doRefresh(reason);
  }, [refreshKey, doRefresh]);

  /**
   * Efeito: refresh inicial quando enabled fica true
   */
  useEffect(() => {
    if (!enabled || hasInitialFetchRef.current) return;
    
    hasInitialFetchRef.current = true;
    doRefresh('mount');
  }, [enabled, doRefresh]);

  /**
   * Efeito: auto-refresh por intervalo
   */
  useEffect(() => {
    if (!enabled) {
      // Limpa intervalo se desabilitado
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Configura intervalo de auto-refresh
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        doRefresh('auto-interval');
      }
    }, autoRefreshMs);

    if (import.meta.env.DEV) {
      console.log(`[${refreshKey}] ⏰ Auto-refresh configurado: ${autoRefreshMs / 60000}min`);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, autoRefreshMs, refreshKey, doRefresh]);

  /**
   * Efeito: cleanup ao desmontar
   */
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  /**
   * Label formatado do último refresh
   */
  const lastRefreshLabel = (() => {
    if (!lastRefreshAt) return 'Nunca atualizado';
    
    const now = new Date();
    const diffMs = now.getTime() - lastRefreshAt.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffSec < 10) return 'Atualizado agora';
    if (diffSec < 60) return `Atualizado há ${diffSec}s`;
    if (diffMin < 60) return `Atualizado há ${diffMin}min`;
    
    return `Atualizado às ${lastRefreshAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  })();

  return {
    refreshNow,
    isRefreshing,
    lastRefreshAt,
    lastRefreshLabel,
  };
}

/**
 * Componente de botão de atualização padronizado
 */
export { RefreshButton } from '@/components/ui/RefreshButton';
