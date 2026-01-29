/**
 * src/hooks/maplibre/useMapLibreSafeRaf.ts
 * 
 * Hook para agendar requestAnimationFrame e setTimeout de forma segura.
 * Limpa automaticamente todos os agendamentos no unmount.
 * Evita vazamento de memória e travamentos.
 */

import { useRef, useCallback, useEffect } from 'react';

interface SafeRafHandle {
  /** Agenda um requestAnimationFrame, retorna ID para cancelar */
  raf: (callback: () => void) => number;
  /** Agenda um setTimeout, retorna ID para cancelar */
  timeout: (callback: () => void, delay: number) => number;
  /** Cancela um raf específico */
  cancelRaf: (id: number) => void;
  /** Cancela um timeout específico */
  cancelTimeout: (id: number) => void;
  /** Cancela todos os agendamentos */
  cancelAll: () => void;
}

/**
 * Hook que gerencia requestAnimationFrame e setTimeout de forma segura
 */
export function useMapLibreSafeRaf(): SafeRafHandle {
  const rafIdsRef = useRef<Set<number>>(new Set());
  const timeoutIdsRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);

  // Cleanup no unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      
      // Cancelar todos os rafs
      rafIdsRef.current.forEach((id) => {
        cancelAnimationFrame(id);
      });
      rafIdsRef.current.clear();

      // Cancelar todos os timeouts
      timeoutIdsRef.current.forEach((id) => {
        clearTimeout(id);
      });
      timeoutIdsRef.current.clear();
    };
  }, []);

  const raf = useCallback((callback: () => void): number => {
    const id = requestAnimationFrame(() => {
      rafIdsRef.current.delete(id);
      if (mountedRef.current) {
        try {
          callback();
        } catch (error) {
          console.error('[MapLibre] Erro em raf callback:', error);
        }
      }
    });
    rafIdsRef.current.add(id);
    return id;
  }, []);

  const timeout = useCallback((callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      timeoutIdsRef.current.delete(id);
      if (mountedRef.current) {
        try {
          callback();
        } catch (error) {
          console.error('[MapLibre] Erro em timeout callback:', error);
        }
      }
    }, delay);
    timeoutIdsRef.current.add(id);
    return id;
  }, []);

  const cancelRaf = useCallback((id: number) => {
    if (rafIdsRef.current.has(id)) {
      cancelAnimationFrame(id);
      rafIdsRef.current.delete(id);
    }
  }, []);

  const cancelTimeout = useCallback((id: number) => {
    if (timeoutIdsRef.current.has(id)) {
      clearTimeout(id);
      timeoutIdsRef.current.delete(id);
    }
  }, []);

  const cancelAll = useCallback(() => {
    rafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
    rafIdsRef.current.clear();
    
    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current.clear();
  }, []);

  return {
    raf,
    timeout,
    cancelRaf,
    cancelTimeout,
    cancelAll,
  };
}
