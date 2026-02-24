import { useEffect, useRef, useCallback } from 'react';

interface UseMarketplaceAvailabilityGuaranteeOptions {
  enabled: boolean;
  refresh: () => Promise<void> | void;
  dependencies: Array<string | number | boolean | null | undefined>;
  minIntervalMs?: number;
  intervalMs?: number;
}

/**
 * Garante que listas de fretes/serviços sejam recarregadas quando:
 * - parâmetros críticos mudarem (tipo de serviço, empresa, etc.)
 * - aba voltar ao foco
 * - conexão voltar (online)
 *
 * Inclui throttle simples para evitar rajadas de requests.
 */
export function useMarketplaceAvailabilityGuarantee({
  enabled,
  refresh,
  dependencies,
  minIntervalMs = 1200,
  intervalMs = 10 * 60 * 1000,
}: UseMarketplaceAvailabilityGuaranteeOptions) {
  const lastRefreshAtRef = useRef(0);

  const runRefresh = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    if (now - lastRefreshAtRef.current < minIntervalMs) return;

    lastRefreshAtRef.current = now;
    void Promise.resolve(refresh());
  }, [enabled, minIntervalMs, refresh]);

  const depsSignature = JSON.stringify(dependencies);

  // Recarregar ao montar e quando dependências críticas mudarem
  useEffect(() => {
    runRefresh();
  }, [enabled, depsSignature, runRefresh]);

  // Recarregar ao voltar foco/visibilidade/conectividade
  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') runRefresh();
    };

    const onFocus = () => runRefresh();
    const onOnline = () => runRefresh();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, runRefresh]);

  // Auto-refresh controlado (10min por padrão)
  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const intervalId = window.setInterval(() => {
      runRefresh();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, runRefresh]);

  return { forceRefresh: runRefresh };
}
