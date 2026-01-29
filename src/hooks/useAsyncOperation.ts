/**
 * Hook para operações assíncronas com retry automático, debounce e tratamento de erros
 * Centraliza lógica de resiliência para chamadas de API
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface AsyncOperationOptions {
  /** Número máximo de tentativas (padrão: 3) */
  maxRetries?: number;
  /** Delay inicial entre retries em ms (padrão: 1000) */
  retryDelay?: number;
  /** Multiplicador do delay a cada retry (padrão: 1.5) */
  backoffMultiplier?: number;
  /** Timeout da operação em ms (padrão: 15000) */
  timeout?: number;
  /** Mostrar toast de erro automaticamente */
  showErrorToast?: boolean;
  /** Mensagem de erro customizada */
  errorMessage?: string;
  /** Callback de sucesso */
  onSuccess?: (data: any) => void;
  /** Callback de erro */
  onError?: (error: Error) => void;
  /** Debounce em ms (0 = sem debounce) */
  debounceMs?: number;
  /** ID único para deduplicação de chamadas */
  operationId?: string;
}

interface AsyncOperationResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isRetrying: boolean;
  retryCount: number;
  execute: (...args: any[]) => Promise<T | null>;
  cancel: () => void;
  reset: () => void;
}

const activeOperations = new Map<string, AbortController>();

export function useAsyncOperation<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  options: AsyncOperationOptions = {}
): AsyncOperationResult<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 1.5,
    timeout = 15000,
    showErrorToast = true,
    errorMessage,
    onSuccess,
    onError,
    debounceMs = 0,
    operationId,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (operationId) {
      activeOperations.delete(operationId);
    }
  }, [operationId]);

  const reset = useCallback(() => {
    cancel();
    if (mountedRef.current) {
      setData(null);
      setError(null);
      setIsLoading(false);
      setIsRetrying(false);
      setRetryCount(0);
    }
  }, [cancel]);

  const executeWithRetry = useCallback(async (
    args: any[],
    attempt: number = 0
  ): Promise<T | null> => {
    // Cancelar operação anterior com mesmo ID
    if (operationId && activeOperations.has(operationId)) {
      activeOperations.get(operationId)?.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    if (operationId) {
      activeOperations.set(operationId, abortController);
    }

    // Timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      if (!mountedRef.current) return null;
      
      if (attempt > 0) {
        setIsRetrying(true);
        setRetryCount(attempt);
        console.log(`[useAsyncOperation] Retry ${attempt}/${maxRetries}`);
      }

      const result = await asyncFn(...args);

      clearTimeout(timeoutId);
      
      if (!mountedRef.current) return null;
      if (abortController.signal.aborted) return null;

      setData(result);
      setError(null);
      setIsRetrying(false);
      onSuccess?.(result);
      
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (!mountedRef.current) return null;
      if (abortController.signal.aborted) return null;

      const error = err instanceof Error ? err : new Error(String(err));
      
      // Verificar se deve fazer retry
      const isRetryable = !error.message.includes('aborted') &&
                          !error.message.includes('cancelled') &&
                          attempt < maxRetries;

      if (isRetryable) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
        console.log(`[useAsyncOperation] Aguardando ${delay}ms antes do retry...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (!mountedRef.current || abortController.signal.aborted) return null;
        
        return executeWithRetry(args, attempt + 1);
      }

      // Falhou após todos os retries
      if (mountedRef.current) {
        setError(error);
        setIsRetrying(false);
        
        if (showErrorToast) {
          toast({
            title: 'Erro',
            description: errorMessage || error.message || 'Operação falhou',
            variant: 'destructive',
          });
        }
        
        onError?.(error);
      }
      
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      if (operationId) {
        activeOperations.delete(operationId);
      }
    }
  }, [asyncFn, maxRetries, retryDelay, backoffMultiplier, timeout, showErrorToast, errorMessage, onSuccess, onError, operationId]);

  const execute = useCallback((...args: any[]): Promise<T | null> => {
    return new Promise((resolve) => {
      // Cancelar debounce anterior
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      const runExecution = async () => {
        if (!mountedRef.current) {
          resolve(null);
          return;
        }

        setIsLoading(true);
        setError(null);
        setRetryCount(0);

        const result = await executeWithRetry(args);
        resolve(result);
      };

      if (debounceMs > 0) {
        debounceTimeoutRef.current = setTimeout(runExecution, debounceMs);
      } else {
        runExecution();
      }
    });
  }, [executeWithRetry, debounceMs]);

  return {
    data,
    error,
    isLoading,
    isRetrying,
    retryCount,
    execute,
    cancel,
    reset,
  };
}

/**
 * Hook simplificado para mutations com retry
 */
export function useMutation<T = any, TArgs extends any[] = any[]>(
  mutationFn: (...args: TArgs) => Promise<T>,
  options: Omit<AsyncOperationOptions, 'debounceMs'> = {}
) {
  return useAsyncOperation<T>(mutationFn, {
    ...options,
    debounceMs: 0,
  });
}

/**
 * Hook para queries com debounce automático
 */
export function useDebouncedQuery<T = any>(
  queryFn: (...args: any[]) => Promise<T>,
  debounceMs: number = 300,
  options: Omit<AsyncOperationOptions, 'debounceMs'> = {}
) {
  return useAsyncOperation<T>(queryFn, {
    ...options,
    debounceMs,
    showErrorToast: options.showErrorToast ?? false,
  });
}
