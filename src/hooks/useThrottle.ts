/**
 * Hook para throttle de funções - evita chamadas excessivas
 * Diferente do debounce, garante execução a cada intervalo
 */

import { useCallback, useRef, useEffect } from 'react';

interface ThrottleOptions {
  /** Intervalo mínimo entre execuções em ms */
  intervalMs: number;
  /** Executar imediatamente na primeira chamada */
  leading?: boolean;
  /** Executar após o intervalo se houve chamadas pendentes */
  trailing?: boolean;
}

interface ThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  options: ThrottleOptions
): ThrottledFunction<T> {
  const { intervalMs, leading = true, trailing = true } = options;

  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const pendingRef = useRef(false);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = false;
    lastArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (pendingRef.current && lastArgsRef.current) {
      fn(...lastArgsRef.current);
      lastCallRef.current = Date.now();
      pendingRef.current = false;
      lastArgsRef.current = null;
    }
    cancel();
  }, [fn, cancel]);

  useEffect(() => {
    return cancel;
  }, [cancel]);

  const throttled = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    lastArgsRef.current = args;

    if (timeSinceLastCall >= intervalMs) {
      // Pode executar imediatamente
      if (leading || lastCallRef.current > 0) {
        fn(...args);
        lastCallRef.current = now;
        pendingRef.current = false;
      } else {
        pendingRef.current = true;
      }
    } else {
      // Agendar para depois
      pendingRef.current = true;
      
      if (!timeoutRef.current && trailing) {
        const remaining = intervalMs - timeSinceLastCall;
        timeoutRef.current = setTimeout(() => {
          if (pendingRef.current && lastArgsRef.current) {
            fn(...lastArgsRef.current);
            lastCallRef.current = Date.now();
            pendingRef.current = false;
            lastArgsRef.current = null;
          }
          timeoutRef.current = null;
        }, remaining);
      }
    }
  }, [fn, intervalMs, leading, trailing]) as ThrottledFunction<T>;

  throttled.cancel = cancel;
  throttled.flush = flush;

  return throttled;
}

/**
 * Hook para criar uma função que só pode ser chamada uma vez por vez
 * Ignora chamadas enquanto uma execução está em andamento
 */
export function useSingleFlight<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  const inFlightRef = useRef(false);

  return useCallback(async (...args: Parameters<T>) => {
    if (inFlightRef.current) {
      console.log('[useSingleFlight] Chamada ignorada - execução em andamento');
      return undefined;
    }

    inFlightRef.current = true;
    try {
      return await fn(...args);
    } finally {
      inFlightRef.current = false;
    }
  }, [fn]) as T;
}

/**
 * Hook para criar uma função que só executa após um delay desde a última chamada
 * Cancela chamadas anteriores automaticamente
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): ThrottledFunction<T> {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (lastArgsRef.current) {
      fn(...lastArgsRef.current);
      lastArgsRef.current = null;
    }
    cancel();
  }, [fn, cancel]);

  useEffect(() => {
    return cancel;
  }, [cancel]);

  const debounced = useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;
    cancel();
    
    timeoutRef.current = setTimeout(() => {
      if (lastArgsRef.current) {
        fn(...lastArgsRef.current);
        lastArgsRef.current = null;
      }
    }, delayMs);
  }, [fn, delayMs, cancel]) as ThrottledFunction<T>;

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced;
}
