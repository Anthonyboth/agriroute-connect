/**
 * Hook para gerenciar estado de loading com múltiplas operações
 * Evita conflitos de loading entre componentes
 */

import { useState, useCallback, useRef, useMemo } from 'react';

interface LoadingOperation {
  id: string;
  startedAt: number;
  label?: string;
}

interface LoadingState {
  /** Se alguma operação está em andamento */
  isLoading: boolean;
  /** Lista de operações em andamento */
  operations: LoadingOperation[];
  /** Se uma operação específica está em andamento */
  isOperationLoading: (id: string) => boolean;
  /** Iniciar uma operação de loading */
  startLoading: (id: string, label?: string) => void;
  /** Finalizar uma operação de loading */
  stopLoading: (id: string) => void;
  /** Wrapper para função async com loading automático */
  withLoading: <T>(id: string, fn: () => Promise<T>, label?: string) => Promise<T>;
  /** Limpar todos os loadings */
  clearAll: () => void;
  /** Obter label de uma operação */
  getOperationLabel: (id: string) => string | undefined;
}

export function useLoadingState(): LoadingState {
  const [operations, setOperations] = useState<LoadingOperation[]>([]);
  const operationsRef = useRef<Map<string, LoadingOperation>>(new Map());

  const isLoading = useMemo(() => operations.length > 0, [operations]);

  const isOperationLoading = useCallback((id: string): boolean => {
    return operationsRef.current.has(id);
  }, []);

  const getOperationLabel = useCallback((id: string): string | undefined => {
    return operationsRef.current.get(id)?.label;
  }, []);

  const startLoading = useCallback((id: string, label?: string) => {
    // Evitar duplicatas
    if (operationsRef.current.has(id)) {
      return;
    }

    const operation: LoadingOperation = {
      id,
      startedAt: Date.now(),
      label,
    };

    operationsRef.current.set(id, operation);
    setOperations(Array.from(operationsRef.current.values()));
  }, []);

  const stopLoading = useCallback((id: string) => {
    if (!operationsRef.current.has(id)) {
      return;
    }

    operationsRef.current.delete(id);
    setOperations(Array.from(operationsRef.current.values()));
  }, []);

  const clearAll = useCallback(() => {
    operationsRef.current.clear();
    setOperations([]);
  }, []);

  const withLoading = useCallback(async <T>(
    id: string, 
    fn: () => Promise<T>,
    label?: string
  ): Promise<T> => {
    startLoading(id, label);
    try {
      return await fn();
    } finally {
      stopLoading(id);
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    operations,
    isOperationLoading,
    startLoading,
    stopLoading,
    withLoading,
    clearAll,
    getOperationLabel,
  };
}

/**
 * Hook simplificado para um único estado de loading
 */
export function useSimpleLoading(initialState: boolean = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const loadingRef = useRef(initialState);

  const startLoading = useCallback(() => {
    loadingRef.current = true;
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    loadingRef.current = false;
    setIsLoading(false);
  }, []);

  const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    startLoading();
    try {
      return await fn();
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
    // Getter para evitar stale closures
    getIsLoading: () => loadingRef.current,
  };
}

/**
 * Hook para loading com timeout automático
 */
export function useLoadingWithTimeout(timeoutMs: number = 30000) {
  const [isLoading, setIsLoading] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setIsTimedOut(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setIsTimedOut(true);
    }, timeoutMs);
  }, [timeoutMs]);

  const stopLoading = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stopLoading();
    setIsTimedOut(false);
  }, [stopLoading]);

  return {
    isLoading,
    isTimedOut,
    startLoading,
    stopLoading,
    reset,
  };
}
